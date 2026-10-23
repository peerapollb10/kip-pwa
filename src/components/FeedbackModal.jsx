import { useState } from 'react';
import { Sheet, Spinner } from './ui.jsx';
import { sendFeedback } from '../lib/api.js';
import { useKip } from '../context/KipContext.jsx';

const KINDS = [
  ['suggestion', '💡 ข้อเสนอแนะ'],
  ['bug', '🐞 แจ้งปัญหา'],
  ['rating', '⭐ ให้คะแนน'],
];

export default function FeedbackModal({ open, onClose }) {
  const { showToast } = useKip();
  const [kind, setKind] = useState('suggestion');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const valid = kind === 'rating' ? rating > 0 : message.trim().length > 0;

  async function submit() {
    setSending(true);
    setError(null);
    try {
      await sendFeedback({ type: kind, message: message.trim(), rating });
      showToast('ขอบคุณสำหรับความคิดเห็น 🙏');
      setMessage('');
      setRating(0);
      onClose();
    } catch {
      setError('ส่งไม่สำเร็จ ลองใหม่อีกครั้ง');
    } finally {
      setSending(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="ส่งข้อเสนอแนะ / แจ้งปัญหา"
      footer={
        <button className="btn-primary w-full" disabled={!valid || sending} onClick={submit}>
          {sending ? <Spinner className="border-white border-t-transparent" /> : 'ส่ง'}
        </button>
      }
    >
      <div className="mb-4 grid grid-cols-3 gap-2">
        {KINDS.map(([k, label]) => (
          <button key={k} onClick={() => setKind(k)} className={`${kind === k ? 'chip-on' : 'chip-off'} justify-center`}>
            {label}
          </button>
        ))}
      </div>

      {kind === 'rating' && (
        <div className="mb-4 flex justify-center gap-1" role="radiogroup" aria-label="คะแนน">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} role="radio" aria-checked={rating === n} aria-label={`${n} ดาว`} onClick={() => setRating(n)} className={`text-4xl transition ${n <= rating ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}>
              ★
            </button>
          ))}
        </div>
      )}

      <textarea
        className="input min-h-[120px]"
        placeholder={kind === 'bug' ? 'เกิดปัญหาอะไร ทำขั้นตอนไหนแล้วเจอ...' : kind === 'rating' ? 'อยากบอกอะไรเพิ่มเติมไหม (ไม่บังคับ)' : 'อยากให้ Kip มีอะไรเพิ่ม...'}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={4000}
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </Sheet>
  );
}
