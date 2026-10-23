// POST /api/checkout { interval: 'month'|'year', method: 'card'|'promptpay' } → { url }
// card      → Stripe subscription (auto-renew at the locked price)
// promptpay → one-time payment for one period (Stripe PromptPay does not support recurring)
import { stripe, supabaseAdmin, getUserFromRequest } from './_lib/server.js';
import { resolveCheckoutPrice } from '../src/lib/pricing.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const { interval, method } = req.body || {};
  if (!['month', 'year'].includes(interval) || !['card', 'promptpay'].includes(method)) {
    return res.status(400).json({ error: 'INVALID_INPUT' });
  }

  try {
    const [{ data: count }, { data: sub }, { data: profile }] = await Promise.all([
      supabaseAdmin.rpc('get_pro_count'),
      supabaseAdmin.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle(),
      supabaseAdmin.from('profiles').select('stripe_customer_id').eq('id', user.id).single(),
    ]);

    if (method === 'card' && sub?.status === 'active' && sub.stripe_subscription_id) {
      return res.status(409).json({ error: 'ALREADY_SUBSCRIBED' });
    }

    // Grandfathering: returning subscribers keep their original tier.
    const { tier, amount } = resolveCheckoutPrice({ proCount: count ?? 0, interval, lockedTier: sub?.tier });
    const lockedAmount = sub?.locked_price && sub.billing_interval === interval ? sub.locked_price : amount;

    let customer = profile?.stripe_customer_id;
    if (!customer) {
      customer = (await stripe.customers.create({ email: user.email, metadata: { user_id: user.id } })).id;
      await supabaseAdmin.from('profiles').update({ stripe_customer_id: customer }).eq('id', user.id);
    }

    const metadata = { user_id: user.id, tier: String(tier), interval, method, locked_price: String(lockedAmount) };
    const productName = `Kip Pro (${interval === 'month' ? 'รายเดือน' : 'รายปี'})`;
    const appUrl = process.env.APP_URL;

    const common = {
      customer,
      client_reference_id: user.id,
      metadata,
      locale: 'th',
      success_url: `${appUrl}/pricing?status=success`,
      cancel_url: `${appUrl}/pricing?status=cancel`,
    };

    const session =
      method === 'card'
        ? await stripe.checkout.sessions.create({
            ...common,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{ quantity: 1, price_data: { currency: 'thb', unit_amount: lockedAmount * 100, recurring: { interval }, product_data: { name: productName } } }],
            subscription_data: { metadata },
          })
        : await stripe.checkout.sessions.create({
            ...common,
            mode: 'payment',
            payment_method_types: ['promptpay'],
            line_items: [{ quantity: 1, price_data: { currency: 'thb', unit_amount: lockedAmount * 100, product_data: { name: productName } } }],
            payment_intent_data: { metadata },
          });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('checkout error', e);
    return res.status(500).json({ error: 'CHECKOUT_FAILED' });
  }
}
