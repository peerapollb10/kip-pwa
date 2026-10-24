import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKip } from '../context/KipContext.jsx';
import { getLatestSlip, getProCount, getSubscription, startCheckout } from '../lib/api.js';
import { getPricingStatus, getTier, FREE_ITEM_LIMIT } from '../lib/pricing.js';
import PromptPayCheckout from './PromptPayCheckout.jsx';
import { Spinner } from './ui.jsx';

export function usePricing() {
  const { user } = useKip();
  const [state, setState] = useState({ loading: true, status: null, subscription: null, slip: null, error: null });

  useEffect(() => {
    let alive = true;
    Promise.all([
      getProCount(),
      user ? getSubscription(user.id) : null,
      // A missing payment_slips table (migration 0006 not run) must not break the pricing UI.
      user ? getLatestSlip(user.id).catch(() => null) : null,
    ])
      .then(([count, subscription, slip]) => alive && setState({ loading: false, status: getPricingStatus(count), subscription, slip, error: null }))
      .catch(() => alive && setState({ loading: false, status: null, subscription: null, slip: null, error: 'โหลดราคาไม่สำเร็จ' }));
    return () => {
      alive = false;
    };
  }, [user]);
  return state;
}

function SlipStatus({ slip }) {
  if (slip?.status === 'pending') {
    return (
      <div className="mt-5 rounded-xl bg-amber-50 p-3 text-center text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200" data-testid="slip-pending">
        <p className="font-semibold">⏳ ได้รับสลิปแล้ว — รอแอดมินตรวจสอบ</p>
        <p className="mt-0.5 text-xs">ยอด ฿{Number(slip.amount).toLocaleString('th-TH')} · ส่งเมื่อ {new Date(slip.created_at).toLocaleString('th-TH')}</p>
        <p className="mt-0.5 text-xs">เมื่ออนุมัติแล้ว บัญชีจะเป็น Pro อัตโนมัติ</p>
      </div>
    );
  }
  if (slip?.status === 'rejected') {
    return (
      <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300" role="alert">
        สลิปล่าสุดไม่ผ่านการตรวจสอบ{slip.review_note ? `: ${slip.review_note}` : ''} — กรุณาชำระและแนบสลิปใหม่
      </p>
    );
  }
  return null;
}

export default function PricingPanel({ compact = false }) {
  const { user, isPro } = useKip();
  const navigate = useNavigate();
  const { loading, status, subscription, slip: loadedSlip, error } = usePricing();
  const [interval, setBillingInterval] = useState('month');
  const [paying, setPaying] = useState(null);
  const [payError, setPayError] = useState(null);
  const [qrCheckout, setQrCheckout] = useState(false);
  const [submittedSlip, setSubmittedSlip] = useState(null);
  const slip = submittedSlip ?? loadedSlip;

  if (loading) return <Spinner full />;
  if (error) return <p className="py-10 text-center text-sm text-red-600">{error}</p>;

  // Existing subscribers see their grandfathered price.
  // Manual (admin-granted) rows have no tier/price → treated like new subscribers.
  const lockedTier = subscription?.tier ? getTier(subscription.tier) : null;
  const price = !lockedTier
    ? status.price[interval]
    : subscription.billing_interval === interval && subscription.locked_price
      ? subscription.locked_price
      : lockedTier[interval];
  const full = status.fullPrice[interval];
  const unit = interval === 'month' ? '/เดือน' : '/ปี';

  async function pay(method) {
    if (!user) return navigate('/login', { state: { from: '/pricing' } });
    setPaying(method);
    setPayError(null);
    try {
      await startCheckout({ interval, method });
    } catch (e) {
      setPayError('เริ่มการชำระเงินไม่สำเร็จ ลองใหม่อีกครั้ง');
      setPaying(null);
    }
  }

  return (
    <div className={compact ? '' : 'grid gap-4 sm:grid-cols-2'}>
      {!compact && (
        <div className="card p-5">
          <p className="text-sm font-semibold text-slate-500">Free</p>
          <p className="mt-1 text-3xl font-bold">฿0</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>✓ เซฟได้ {FREE_ITEM_LIMIT} รายการ</li>
            <li>✓ ลิงก์ / YouTube / Facebook / รูป / โน้ต</li>
            <li>✓ หมวดหมู่ + รายการโปรด + ค้นหา</li>
            <li className="text-slate-400">✕ Quick Mode</li>
          </ul>
        </div>
      )}

      <div className="card relative overflow-hidden border-brand-500 p-5 ring-2 ring-brand-500/30">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-brand-600">Pro</p>
          {status.isDiscounted && !lockedTier && (
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-100">
              ราคาผู้ใช้กลุ่มแรก
            </span>
          )}
        </div>

        <div className="mt-3 inline-flex rounded-xl bg-slate-100 p-1 text-sm dark:bg-white/10">
          {['month', 'year'].map((i) => (
            <button key={i} disabled={qrCheckout} onClick={() => setBillingInterval(i)} className={`rounded-lg px-3 py-1 ${interval === i ? 'bg-white shadow dark:bg-white/20' : 'text-slate-500'}`}>
              {i === 'month' ? 'รายเดือน' : 'รายปี (ประหยัด ~17%)'}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-end gap-2">
          {price < full && <span className="text-lg text-slate-400 line-through">{full} บาท</span>}
          <span className="text-4xl font-bold">{price}</span>
          <span className="pb-1 text-sm text-slate-500">บาท{unit}</span>
        </div>
        {lockedTier && <p className="mt-1 text-xs text-emerald-600">🔒 ราคาล็อกไว้ให้คุณตลอดการต่ออายุ</p>}

        {/* Urgency: only when ≤ 50 slots left in the current tier */}
        {!lockedTier && status.showUrgency && (
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-red-500" style={{ width: `${Math.round(status.progress * 100)}%` }} />
            </div>
            <p className="mt-1.5 text-sm font-semibold text-red-600">🔥 เหลืออีก {status.remaining} สิทธิ์สุดท้าย!</p>
          </div>
        )}

        <ul className="mt-4 space-y-2 text-sm">
          <li>✓ เซฟได้ไม่จำกัด</li>
          <li>✓ Quick Mode — แชร์ปุ๊บเซฟทันที ไม่ต้องเลือกหมวด</li>
          <li>✓ ทุกฟีเจอร์ของแพ็กเกจฟรี</li>
        </ul>

        {isPro ? (
          <p className="mt-5 rounded-xl bg-emerald-50 p-3 text-center text-sm font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">คุณเป็นสมาชิก Pro แล้ว ✓</p>
        ) : slip?.status === 'pending' ? (
          <SlipStatus slip={slip} />
        ) : qrCheckout ? (
          <PromptPayCheckout
            interval={interval}
            amount={price}
            onBack={() => setQrCheckout(false)}
            onSubmitted={(s) => {
              setSubmittedSlip(s);
              setQrCheckout(false);
            }}
          />
        ) : (
          <div className="mt-5 grid gap-2">
            <SlipStatus slip={slip} />
            {/* PromptPay = scan our QR + attach the slip (admin approves); card = Stripe subscription. */}
            <button className="btn-primary" disabled={Boolean(paying)} onClick={() => (user ? setQrCheckout(true) : navigate('/login', { state: { from: '/pricing' } }))}>
              📱 จ่ายด้วย PromptPay QR
            </button>
            <button className="btn-outline" disabled={Boolean(paying)} onClick={() => pay('card')}>
              {paying === 'card' ? <Spinner /> : '💳 บัตรเครดิต / เดบิต (ต่ออายุอัตโนมัติ)'}
            </button>
            {payError && <p className="text-center text-xs text-red-600">{payError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
