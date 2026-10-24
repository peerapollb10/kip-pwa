import { AUTH_PROVIDERS } from '../lib/auth.js';
import { Spinner } from './ui.jsx';

// Official marks — Google "G" (Sign in with Google branding) and the LINE bubble (LINE Login button guidelines).
export function GoogleLogo({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

// White bubble with the "LINE" wordmark knocked out (shows the green behind it).
export function LineLogo({ className = 'h-6 w-6', color = '#FFFFFF' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill={color}
        fillRule="evenodd"
        d="M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314ZM19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755Zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771Zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771Zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629Z"
      />
    </svg>
  );
}

// Light: #FFF fill / #747775 stroke / #1F1F1F text · Dark: #131314 / #8E918F / #E3E3E3 (Google Identity branding).
export function GoogleButton({ onClick, pending = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      aria-busy={pending}
      data-provider="google"
      className="relative flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-[#747775] bg-white px-3 font-[Roboto,'IBM_Plex_Sans_Thai',sans-serif] text-[15px] font-medium text-[#1F1F1F] transition hover:bg-[#F8F9FA] hover:shadow-[0_1px_2px_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] active:bg-[#F1F3F4] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#8E918F] dark:bg-[#131314] dark:text-[#E3E3E3] dark:hover:bg-[#1E1E20]"
    >
      <span className="absolute left-3 flex h-[18px] w-[18px]"><GoogleLogo /></span>
      <span>{AUTH_PROVIDERS.google.label}</span>
      {pending && <Spinner className="absolute right-3 border-[#747775] border-t-transparent" />}
    </button>
  );
}

// Base #06C755 · logo zone split by a 8%-black divider · hover +10% black · pressed +30% black (LINE Login button guidelines).
export function LineButton({ onClick, pending = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      aria-busy={pending}
      data-provider="line"
      className="relative flex h-11 w-full items-center overflow-hidden rounded-xl bg-[#06C755] text-[15px] font-bold text-white transition hover:shadow-[inset_0_0_0_999px_rgba(0,0,0,0.1)] active:shadow-[inset_0_0_0_999px_rgba(0,0,0,0.3)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="flex h-full w-11 shrink-0 items-center justify-center border-r border-black/[0.08]"><LineLogo /></span>
      <span className="flex-1 pr-11 text-center">{AUTH_PROVIDERS.line.label}</span>
      {pending && <Spinner className="absolute right-3 border-white border-t-transparent" />}
    </button>
  );
}

// Small round mark for "signed in with …" badges.
export function ProviderMark({ provider, className = 'h-5 w-5' }) {
  if (provider === 'google') {
    return (
      <span className={`inline-flex items-center justify-center rounded-full bg-white p-[3px] ring-1 ring-slate-200 ${className}`} role="img" aria-label="Google">
        <GoogleLogo className="h-full w-full" />
      </span>
    );
  }
  if (provider === 'line') {
    return (
      <span className={`inline-flex items-center justify-center rounded-full bg-[#06C755] p-[3px] ${className}`} role="img" aria-label="LINE">
        <LineLogo className="h-full w-full" />
      </span>
    );
  }
  return null;
}

// Member avatar: profile photo from Google/LINE, else the first letter; provider mark in the corner.
export function UserAvatar({ account, size = 'h-10 w-10', showProvider = true }) {
  return (
    <span className={`relative inline-flex shrink-0 ${size}`}>
      {account.avatarUrl ? (
        <img src={account.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full rounded-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-full bg-brand-600 font-semibold text-white">{account.initial}</span>
      )}
      {showProvider && <ProviderMark provider={account.provider} className="absolute -bottom-0.5 -right-0.5 h-4 w-4 ring-2 ring-white dark:ring-[#0b0b0f]" />}
    </span>
  );
}
