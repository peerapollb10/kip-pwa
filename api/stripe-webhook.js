// POST /api/stripe-webhook — activates / extends Pro automatically.
import { stripe, supabaseAdmin } from './_lib/server.js';

export const config = { api: { bodyParser: false } };

async function rawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

function addInterval(from, interval) {
  const d = new Date(from);
  if (interval === 'year') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

async function activate({ meta, periodEnd, customer, subscription }) {
  const { error } = await supabaseAdmin.rpc('activate_pro', {
    p_user: meta.user_id,
    p_tier: Number(meta.tier),
    p_interval: meta.interval,
    p_price: Number(meta.locked_price),
    p_method: meta.method,
    p_period_end: periodEnd.toISOString(),
    p_customer: customer || null,
    p_subscription: subscription || null,
  });
  if (error) throw error;
}

// Ledger for the admin "ยอดขายสะสม" stat. Amounts from Stripe are in satang.
// Never throws: a failed ledger write must not make Stripe retry (PromptPay would stack Pro time twice).
async function recordPayment({ userId, amount, method, ref }) {
  const { error } = await supabaseAdmin
    .from('payments')
    .upsert({ user_id: userId, amount: amount / 100, payment_method: method, stripe_ref: ref }, { onConflict: 'stripe_ref', ignoreDuplicates: true });
  if (error) console.error('payment ledger write failed', ref, error);
}

async function handleCheckoutPaid(session) {
  const meta = session.metadata || {};
  if (!meta.user_id) return;

  if (session.mode === 'subscription') {
    const sub = await stripe.subscriptions.retrieve(session.subscription);
    const periodEnd = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
    await activate({ meta, periodEnd: new Date(periodEnd * 1000), customer: session.customer, subscription: sub.id });
  } else {
    // PromptPay one-off: stack on top of any remaining Pro time.
    const { data: profile } = await supabaseAdmin.from('profiles').select('pro_until').eq('id', meta.user_id).single();
    const base = profile?.pro_until && new Date(profile.pro_until) > new Date() ? profile.pro_until : new Date();
    await activate({ meta, periodEnd: addInterval(base, meta.interval), customer: session.customer });
  }
  await recordPayment({ userId: meta.user_id, amount: session.amount_total ?? 0, method: meta.method, ref: session.id });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  let event;
  try {
    event = stripe.webhooks.constructEvent(await rawBody(req), req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return res.status(400).send(`Webhook signature error: ${e.message}`);
  }

  // Idempotency: Stripe retries; skip events we've already processed.
  const { error: dupError } = await supabaseAdmin.from('stripe_events').insert({ id: event.id, type: event.type });
  if (dupError?.code === '23505') return res.status(200).json({ received: true, duplicate: true });

  try {
    const obj = event.data.object;
    switch (event.type) {
      case 'checkout.session.completed':
        // Card is paid immediately; PromptPay may still be pending here.
        if (obj.payment_status === 'paid') await handleCheckoutPaid(obj);
        break;
      case 'checkout.session.async_payment_succeeded':
        await handleCheckoutPaid(obj);
        break;
      case 'invoice.paid': {
        // Renewals only — the first invoice is handled via checkout.session.completed.
        if (obj.billing_reason !== 'subscription_cycle') break;
        const subId = obj.subscription ?? obj.parent?.subscription_details?.subscription;
        const sub = await stripe.subscriptions.retrieve(subId);
        const periodEnd = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
        await activate({ meta: sub.metadata, periodEnd: new Date(periodEnd * 1000), customer: sub.customer, subscription: sub.id });
        await recordPayment({ userId: sub.metadata.user_id, amount: obj.amount_paid ?? 0, method: 'card', ref: obj.id });
        break;
      }
      case 'invoice.payment_failed': {
        const subId = obj.subscription ?? obj.parent?.subscription_details?.subscription;
        if (subId) await supabaseAdmin.from('subscriptions').update({ status: 'past_due' }).eq('stripe_subscription_id', subId);
        break;
      }
      case 'customer.subscription.deleted':
        // Pro stays active until profiles.pro_until; just mark as canceled.
        await supabaseAdmin.from('subscriptions').update({ status: 'canceled', stripe_subscription_id: null }).eq('stripe_subscription_id', obj.id);
        break;
      default:
        break;
    }
  } catch (e) {
    console.error('webhook handling error', event.type, e);
    // Let Stripe retry: forget the event id.
    await supabaseAdmin.from('stripe_events').delete().eq('id', event.id);
    return res.status(500).json({ error: 'HANDLER_FAILED' });
  }

  return res.status(200).json({ received: true });
}
