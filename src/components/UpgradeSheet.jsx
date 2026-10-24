import { useKip } from '../context/KipContext.jsx';
import { Sheet } from './ui.jsx';
import PricingPanel from './PricingPanel.jsx';
import { FREE_ITEM_LIMIT } from '../lib/pricing.js';

export default function UpgradeSheet() {
  const { upgradeOpen, setUpgradeOpen, atLimit, items } = useKip();
  return (
    <Sheet open={upgradeOpen} onClose={() => setUpgradeOpen(false)} title="อัปเกรดเป็น Pro">
      {atLimit && (
        <div className="mb-3 rounded-2xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300" role="alert" data-testid="limit-reached">
          🔒 ครบ {Math.min(items.length, FREE_ITEM_LIMIT)}/{FREE_ITEM_LIMIT} รายการแล้ว — เซฟรายการใหม่ไม่ได้จนกว่าจะอัปเกรด
        </div>
      )}
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
        แพ็กเกจฟรีเซฟได้สูงสุด {FREE_ITEM_LIMIT} รายการ ข้อมูลเดิมของคุณยังอยู่ครบ ไม่โดนลบ — อัปเกรดเพื่อเซฟต่อได้ไม่จำกัด
      </p>
      <PricingPanel compact />
    </Sheet>
  );
}
