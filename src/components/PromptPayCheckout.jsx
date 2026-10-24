import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useKip } from '../context/KipContext.jsx';
import { PROMPTPAY } from '../lib/supabase.js';
import { submitPaymentSlip } from '../lib/api.js';
import { buildPromptPayPayload, formatPromptPayId, isValidPromptPayId, slipErrorMessage } from '../lib/promptpay.js';
import { Spinner } from './ui.jsx';

const MAX_SLIP_BYTES = 10 * 1024 * 1024; // before compression

// Step 1: scan the QR (fixed amount) → Step 2: attach the transfer slip → pending admin review.
export default function PromptPayCheckout({ interval, amount, onBack, onSubmitted }) {
  const { user, showToast } = useKip();
  const [qr, setQr] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const configured = isValidPromptPayId(PROMPTPAY.id);

  useEffect(() => {
    if (!configured) return;
    let alive = true;
    QRCode.toDataURL(buildPromptPayPayload(PROMPTPAY.id, amount), { width: 480, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => alive && setQr(url))
      .catch(() => alive && setError('สร้าง QR ไม่สำเร็จ'));
    return () => {
      alive = false;
    };
  }, [configured, amount]);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) return setError('กรุณาเลือกไฟล์รูปภาพสลิป');
    if (f.size > MAX_SLIP_BYTES) return setError('ไฟล์ใหญ่เกิน 10 MB');
    setError(null);
    setFile(f);
  }

  async function submit() {
    setSending(true);
    setError(null);
    try {
      const slip = await submitPaymentSlip({ userId: user.id, interval, amount, file });
      showToast('ส่งสลิปแล้ว รอแอดมินตรวจสอบ ✓');
      onSubmitted(slip);
    } catch (e) {
      setError(slipErrorMessage(e));
    } finally {
      setSending(false);
    }
  }

  async function copyId() {
    try {
      await navigator.clipboard.writeText(PROMPTPAY.id.replace(/\D/g, ''));
      showToast('คัดลอกพร้อมเพย์แล้ว');
    } catch {
      /* clipboard blocked — the ID is visible anyway */
    }
  }

  if (!configured) {
    return (
      <div className="mt-5 space-y-3">
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">ยังไม่ได้ตั้งค่าบัญชีพร้อมเพย์ — กรุณาติดต่อทีมงาน</p>
        <button className="btn-ghost w-full" onClick={onBack}>← เลือกวิธีชำระเงินอื่น</button>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-4" data-testid="promptpay-checkout">
      <div className="rounded-2xl border border-slate-200 p-4 text-center dark:border-white/10">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#1a3f6f] dark:text-sky-300">PromptPay · พร้อมเพย์</p>
        <div className="mx-auto mt-3 aspect-square w-52 overflow-hidden rounded-xl bg-white p-2">
          {qr ? <img src={qr} alt={`PromptPay QR ยอด ${amount} บาท`} className="h-full w-full" data-testid="promptpay-qr" /> : <div className="flex h-full items-center justify-center"><Spinner /></div>}
        </div>
        <p className="mt-3 text-sm text-slate-500">ยอดที่ต้องโอน</p>
        <p className="text-3xl font-bold tabular-nums" data-testid="promptpay-amount">฿{Number(amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</p>
        <p className="text-xs text-slate-500">Kip Pro {interval === 'month' ? 'รายเดือน (1 เดือน)' : 'รายปี (1 ปี)'}</p>
        <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-white/5">
          <span className="text-slate-500">พร้อมเพย์</span>
          <span className="font-mono font-semibold" data-testid="promptpay-id">{formatPromptPayId(PROMPTPAY.id)}</span>
          <button type="button" className="btn-ghost px-2 py-0.5 text-xs" onClick={copyId}>คัดลอก</button>
        </div>
        {PROMPTPAY.name && <p className="mt-1 text-xs text-slate-500">ชื่อบัญชี: {PROMPTPAY.name}</p>}
      </div>

      <ol className="list-decimal space-y-1 pl-5 text-xs text-slate-500">
        <li>สแกน QR ด้วยแอปธนาคาร (ยอดเงินถูกกรอกให้อัตโนมัติ)</li>
        <li>บันทึกสลิปแล้วแนบด้านล่าง</li>
        <li>แอดมินตรวจสอบ แล้วเปิด Pro ให้อัตโนมัติ</li>
      </ol>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={pick} data-testid="slip-input" />
      {preview ? (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-2 dark:border-white/10">
          <img src={preview} alt="ตัวอย่างสลิป" className="h-20 w-16 rounded-lg object-cover" />
          <p className="min-w-0 flex-1 truncate text-sm">{file.name}</p>
          <button type="button" className="btn-ghost px-2 text-xs" disabled={sending} onClick={() => inputRef.current?.click()}>เปลี่ยน</button>
        </div>
      ) : (
        <button type="button" className="flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed border-slate-300 py-5 text-sm text-slate-500 hover:border-brand-500 hover:text-brand-600 dark:border-white/15" onClick={() => inputRef.current?.click()}>
          <span className="text-2xl">🧾</span>
          แนบรูปสลิปการโอนเงิน
        </button>
      )}

      {error && <p className="text-center text-xs text-red-600" role="alert">{error}</p>}

      <button className="btn-primary w-full" disabled={!file || sending} onClick={submit}>
        {sending ? <Spinner className="border-white border-t-transparent" /> : 'ส่งสลิปเพื่อยืนยันการชำระเงิน'}
      </button>
      <button className="btn-ghost w-full" disabled={sending} onClick={onBack}>← เลือกวิธีชำระเงินอื่น</button>
    </div>
  );
}
