import { useState } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useKip } from '../context/KipContext.jsx';
import { signInWithGoogle, signInWithLine } from '../lib/api.js';
import { hasGuestData } from '../lib/guestStore.js';
import { Spinner } from '../components/ui.jsx';

const ERRORS = {
  LINE_CANCELLED: 'ยกเลิกการเข้าสู่ระบบด้วย LINE',
  LINE_STATE: 'เซสชันหมดอายุ ลองใหม่อีกครั้ง',
};

export default function Login() {
  const { session } = useKip();
  const location = useLocation();
  const [params] = useSearchParams();
  const from = location.state?.from || '/';
  const [pending, setPending] = useState(null); // 'google' | 'line'
  const [error, setError] = useState(params.get('error') ? ERRORS[params.get('error')] || 'เข้าสู่ระบบด้วย LINE ไม่สำเร็จ' : null);

  if (session) return <Navigate to={from} replace />;

  async function google() {
    setPending('google');
    setError(null);
    try {
      await signInWithGoogle(from);
    } catch (e) {
      setError(e.message);
      setPending(null);
    }
  }

  function line() {
    setPending('line');
    signInWithLine(from);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5">
      <Link to="/" className="mb-8 flex items-center gap-2 text-lg font-bold">
        <img src="/icons/icon.svg" alt="" className="h-8 w-8" /> Kip
      </Link>
      <h1 className="text-2xl font-bold">เชื่อมต่อบัญชี</h1>
      <p className="mt-1 text-sm text-slate-500">ซิงก์ข้อมูลข้ามอุปกรณ์และสำรองไว้บนคลาวด์ ไม่ต้องจำรหัสผ่าน</p>
      {hasGuestData() && (
        <p className="mt-4 rounded-xl bg-brand-50 p-3 text-sm text-brand-700 dark:bg-brand-500/10 dark:text-brand-100">
          📦 รายการที่เซฟไว้ในโหมด Guest จะถูกย้ายขึ้นบัญชีให้อัตโนมัติ
        </p>
      )}

      <div className="mt-6 space-y-3">
        <button className="btn-outline w-full gap-2" disabled={Boolean(pending)} onClick={google}>
          {pending === 'google' ? <Spinner /> : <><span className="font-bold text-red-500">G</span> เข้าสู่ระบบด้วย Gmail</>}
        </button>
        <button className="btn w-full gap-2 bg-[#06C755] text-white hover:bg-[#05b34c]" disabled={Boolean(pending)} onClick={line}>
          {pending === 'line' ? <Spinner className="border-white border-t-transparent" /> : <><span className="font-black">LINE</span> เข้าสู่ระบบด้วย LINE</>}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}

      <Link to="/" className="btn-ghost mt-6 text-sm text-slate-500">ใช้งานต่อแบบ Guest</Link>
    </div>
  );
}
