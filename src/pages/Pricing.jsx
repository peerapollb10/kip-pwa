import { Link, useSearchParams } from 'react-router-dom';
import PricingPanel from '../components/PricingPanel.jsx';
import SupportLinks from '../components/SupportLinks.jsx';

export default function Pricing() {
  const [params] = useSearchParams();
  const status = params.get('status');

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6">
      <Link to="/" className="btn-ghost -ml-3 mb-4">← กลับ</Link>
      <h1 className="text-2xl font-bold">แพ็กเกจ Kip</h1>
      <p className="mt-1 text-sm text-slate-500">ยิ่งสมัครเร็ว ยิ่งได้ราคาถูก และล็อกราคานี้ไว้ตลอดการต่ออายุ</p>

      {status === 'success' && (
        <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          ชำระเงินสำเร็จ 🎉 ระบบกำลังอัปเดตสถานะ Pro (โดยปกติไม่เกิน 1 นาที)
        </div>
      )}
      {status === 'cancel' && (
        <div className="mt-4 rounded-xl bg-slate-100 p-3 text-sm dark:bg-white/5">ยกเลิกการชำระเงินแล้ว</div>
      )}

      <div className="mt-6">
        <PricingPanel />
      </div>

      <section className="mt-10">
        <h2 className="mb-2 font-semibold">มีคำถาม? ติดต่อทีมงาน</h2>
        <SupportLinks />
      </section>
    </div>
  );
}
