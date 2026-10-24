import { useState } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useKip } from '../context/KipContext.jsx';
import { signInWith } from '../lib/api.js';
import { loginErrorMessage } from '../lib/auth.js';
import { hasGuestData } from '../lib/guestStore.js';
import { GoogleButton, LineButton } from '../components/AuthButtons.jsx';
import { Spinner } from '../components/ui.jsx';

export default function Login() {
  const { session } = useKip();
  const location = useLocation();
  const [params] = useSearchParams();
  const from = location.state?.from || '/';
  const [pending, setPending] = useState(null); // 'google' | 'line'
  const [error, setError] = useState(() => loginErrorMessage(params.get('error')));

  if (session === undefined) return <Spinner full />;
  if (session) return <Navigate to={from} replace />;

  async function signIn(provider) {
    setPending(provider);
    setError(null);
    try {
      await signInWith(provider, from); // navigates away on success
    } catch (e) {
      setError(e.message || loginErrorMessage('UNKNOWN'));
      setPending(null);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5">
      <Link to="/" className="mb-8 flex items-center gap-2 text-lg font-bold">
        <img src="/icons/icon.svg" alt="" className="h-8 w-8" /> Kip
      </Link>
      <h1 className="text-2xl font-bold">เข้าสู่ระบบ / สมัครสมาชิก</h1>
      <p className="mt-1 text-sm text-slate-500">ซิงก์ข้อมูลข้ามอุปกรณ์และสำรองไว้บนคลาวด์ ไม่ต้องจำรหัสผ่าน — ครั้งแรกจะสร้างบัญชีให้อัตโนมัติ</p>
      {hasGuestData() && (
        <p className="mt-4 rounded-xl bg-brand-50 p-3 text-sm text-brand-700 dark:bg-brand-500/10 dark:text-brand-100">
          📦 รายการที่เซฟไว้ในโหมด Guest จะถูกย้ายขึ้นบัญชีให้อัตโนมัติ
        </p>
      )}

      <div className="mt-6 space-y-3" data-testid="auth-providers">
        <GoogleButton onClick={() => signIn('google')} pending={pending === 'google'} disabled={Boolean(pending)} />
        <LineButton onClick={() => signIn('line')} pending={pending === 'line'} disabled={Boolean(pending)} />
      </div>
      {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}

      <Link to="/" className="btn-ghost mt-6 text-sm text-slate-500">ใช้งานต่อแบบ Guest</Link>
    </div>
  );
}
