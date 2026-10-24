import { Link } from 'react-router-dom';
import InstallBanner from '../components/InstallBanner.jsx';
import { UserAvatar } from '../components/AuthButtons.jsx';
import { useKip } from '../context/KipContext.jsx';

const FEATURES = [
  ['⤴️', 'แชร์ปุ๊บ เซฟปั๊บ', 'กดแชร์จาก YouTube, Facebook หรือเว็บไหนก็ได้ แล้วเลือกหมวดหมู่ได้ทันที'],
  ['🗂️', 'จัดหมวดหมู่สวยงาม', 'Masonry Grid สไตล์ Pinterest หรือ List เรียบๆ สลับได้ในคลิกเดียว'],
  ['🔍', 'ค้นหาเจอในวินาที', 'ค้นหาแบบเรียลไทม์ทั้งชื่อ ลิงก์ และโน้ต + ติดดาวรายการโปรด'],
  ['🖼️', 'รูป โน้ต ลิงก์ ครบ', 'บีบอัดรูปอัตโนมัติก่อนอัปโหลด ประหยัดเน็ตและพื้นที่'],
];

export default function Landing() {
  const { account } = useKip();
  return (
    <div className="mx-auto max-w-5xl px-5 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <nav className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-lg font-bold">
          <img src="/icons/icon.svg" alt="" className="h-8 w-8" /> Kip
        </span>
        <div className="flex gap-1">
          <Link to="/pricing" className="btn-ghost">ราคา</Link>
          {account ? (
            <Link to="/" className="btn-primary pl-1.5" data-testid="member-avatar">
              <UserAvatar account={account} size="h-7 w-7" showProvider={false} /> เปิดคลังของฉัน
            </Link>
          ) : (
            <Link to="/login" className="btn-primary">เข้าสู่ระบบ</Link>
          )}
        </div>
      </nav>

      <header className="mx-auto mt-14 max-w-2xl text-center sm:mt-20">
        <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
          Kip – เซฟลิงก์และไอเดียส่วนตัว <span className="text-brand-600">ค้นหาง่าย</span> ไม่รก LINE Keep
        </h1>
        <p className="mt-4 text-base text-slate-600 dark:text-slate-300 sm:text-lg">
          เลิกส่งลิงก์ดองไว้ในแชท เปลี่ยนมาจัดหมวดหมู่สวยงามด้วย Share Sheet ใน 1 คลิก
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/" className="btn-primary px-6 py-3 text-base">เริ่มใช้ฟรีทันที — ไม่ต้องสมัคร</Link>
          <Link to="/pricing" className="btn-outline px-6 py-3 text-base">ดูแพ็กเกจ Pro</Link>
        </div>
      </header>

      <div className="mx-auto mt-10 max-w-md">
        <InstallBanner />
      </div>

      <section className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(([icon, title, body]) => (
          <div key={title} className="card p-5">
            <div className="text-3xl">{icon}</div>
            <h3 className="mt-3 font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
