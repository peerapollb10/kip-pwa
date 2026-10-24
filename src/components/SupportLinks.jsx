import { SUPPORT } from '../lib/supabase.js';

export default function SupportLinks() {
  return (
    <div className="flex flex-wrap gap-2">
      <a href={SUPPORT.line} target="_blank" rel="noopener noreferrer" className="btn-outline">
        <span className="rounded bg-[#06c755] px-1 text-xs font-bold text-white">LINE</span> ติดต่อผ่าน LINE OA
      </a>
      <a href={`mailto:${SUPPORT.email}`} className="btn-outline">✉️ {SUPPORT.email}</a>
    </div>
  );
}
