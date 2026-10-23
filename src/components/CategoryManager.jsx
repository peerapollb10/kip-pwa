import { useState } from 'react';
import { useKip } from '../context/KipContext.jsx';

export default function CategoryManager() {
  const { categories, addCategory, editCategory, removeCategory, showToast } = useKip();
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('📁');
  const [editing, setEditing] = useState(null); // {id, name, emoji}
  const [confirmId, setConfirmId] = useState(null);

  async function add(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await addCategory(newName.trim(), newEmoji || null);
      setNewName('');
    } catch {
      showToast('เพิ่มหมวดหมู่ไม่สำเร็จ', 'error');
    }
  }

  async function saveEdit() {
    if (!editing.name.trim()) return;
    try {
      await editCategory(editing.id, { name: editing.name.trim(), emoji: editing.emoji || null });
      setEditing(null);
    } catch {
      showToast('แก้ไขไม่สำเร็จ', 'error');
    }
  }

  async function remove(id) {
    try {
      await removeCategory(id);
      setConfirmId(null);
      showToast('ลบหมวดหมู่แล้ว รายการถูกย้ายไป Inbox');
    } catch {
      showToast('ลบไม่สำเร็จ', 'error');
    }
  }

  return (
    <div>
      <ul className="divide-y divide-slate-100 dark:divide-white/5">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-2 py-2.5">
            {editing?.id === c.id ? (
              <>
                <input className="input w-14 text-center" value={editing.emoji ?? ''} onChange={(e) => setEditing({ ...editing, emoji: e.target.value })} maxLength={4} />
                <input className="input flex-1" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={40} autoFocus />
                <button className="btn-primary px-3" onClick={saveEdit}>บันทึก</button>
                <button className="btn-ghost px-2" onClick={() => setEditing(null)}>✕</button>
              </>
            ) : confirmId === c.id ? (
              <>
                <span className="flex-1 text-sm text-red-600">ลบ “{c.name}”? รายการจะย้ายไป Inbox</span>
                <button className="btn-ghost px-2" onClick={() => setConfirmId(null)}>ยกเลิก</button>
                <button className="btn bg-red-600 px-3 text-white" onClick={() => remove(c.id)}>ลบ</button>
              </>
            ) : (
              <>
                <span className="w-7 text-center text-lg">{c.emoji}</span>
                <span className="flex-1 text-sm">
                  {c.name}
                  {c.is_default && <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-white/10">ค่าเริ่มต้น · Quick Mode</span>}
                </span>
                <button className="btn-ghost px-2 text-xs" onClick={() => setEditing({ id: c.id, name: c.name, emoji: c.emoji })}>แก้ไข</button>
                {!c.is_default && <button className="btn-ghost px-2 text-xs text-red-600" onClick={() => setConfirmId(c.id)}>ลบ</button>}
              </>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="mt-3 flex gap-2">
        <input className="input w-14 text-center" value={newEmoji} onChange={(e) => setNewEmoji(e.target.value)} maxLength={4} aria-label="อีโมจิ" />
        <input className="input flex-1" placeholder="ชื่อหมวดหมู่ใหม่" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={40} />
        <button className="btn-primary" disabled={!newName.trim()}>เพิ่ม</button>
      </form>
    </div>
  );
}
