import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import * as api from '../lib/api.js';
import * as guestStore from '../lib/guestStore.js';
import { compressToWebp } from '../lib/image.js';
import { isPro as checkPro, FREE_ITEM_LIMIT } from '../lib/pricing.js';
import { getEnabledTypes, setEnabledTypes } from '../lib/typePrefs.js';

const KipContext = createContext(null);

export function KipProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still resolving
  const [profile, setProfile] = useState(null);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [enabledTypes, setEnabledTypesState] = useState(getEnabledTypes); // optional content types switched on
  const migrationRan = useRef(false);

  const userId = session?.user?.id;
  const isGuest = session === null;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const showToast = useCallback((message, tone = 'default') => {
    setToast({ message, tone, id: Date.now() });
  }, []);

  // ── Guest persistence: every guest mutation goes through here ──
  const commitGuest = useCallback((mutate) => {
    const next = mutate(guestStore.loadGuest());
    guestStore.saveGuest(next); // throws QUOTA_EXCEEDED before state changes
    setProfile(next.profile);
    setCategories(next.categories);
    setItems(next.items);
    return next;
  }, []);

  const loadGuestState = useCallback(() => {
    const g = guestStore.loadGuest();
    setProfile(g.profile);
    setCategories(g.categories);
    setItems(g.items);
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [p, c, i] = await Promise.all([api.getProfile(userId), api.listCategories(), api.listItems()]);
      setProfile(p);
      setCategories(c);
      setItems(i);
      return c;
    } catch (e) {
      setError(e.message || 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const authResolved = session !== undefined;
  useEffect(() => {
    if (!authResolved) return;
    if (!userId) {
      migrationRan.current = false;
      loadGuestState();
      return;
    }
    (async () => {
      const serverCategories = await refresh();
      // Guest → account: migrate local data once, right after sign-in.
      if (!serverCategories || migrationRan.current || !guestStore.hasGuestData()) return;
      migrationRan.current = true;
      setMigrating(true);
      const guest = guestStore.loadGuest();
      try {
        const { migrated, remaining } = await api.migrateGuestData({ userId, guest, serverCategories });
        if (remaining.length) {
          guestStore.saveGuest({ ...guest, items: remaining });
          showToast(`ย้ายข้อมูลแล้ว ${migrated} รายการ · อีก ${remaining.length} รายการเกินโควตาฟรี (เก็บไว้ในเครื่อง)`, 'error');
          setUpgradeOpen(true);
        } else {
          guestStore.resetGuest();
          if (migrated) showToast(`ย้ายข้อมูลจากโหมด Guest ขึ้นบัญชีแล้ว ${migrated} รายการ ✓`);
        }
        await refresh();
      } catch (e) {
        if (e.remaining) guestStore.saveGuest({ ...guest, items: e.remaining });
        migrationRan.current = false; // retry next sign-in / reload
        showToast('ย้ายข้อมูล Guest ไม่สำเร็จ จะลองใหม่ครั้งหน้า', 'error');
      } finally {
        setMigrating(false);
      }
    })();
  }, [authResolved, userId, refresh, loadGuestState, showToast]);

  const isPro = !isGuest && checkPro(profile);
  const atLimit = !isPro && items.length >= FREE_ITEM_LIMIT;

  const saveItem = useCallback(
    async (draft, categoryId) => {
      if (atLimit) {
        setUpgradeOpen(true);
        throw new api.LimitError();
      }
      if (isGuest) {
        let dataUrl = null;
        if (draft.file) dataUrl = await guestStore.blobToDataUrl((await compressToWebp(draft.file)).blob);
        const item = guestStore.newGuestItem(draft, categoryId, dataUrl);
        commitGuest((g) => ({ ...g, items: [item, ...g.items] }));
        return item;
      }
      try {
        const item = await api.createItem({ userId, draft, categoryId });
        setItems((prev) => [item, ...prev]);
        return item;
      } catch (e) {
        if (e.code === 'FREE_LIMIT_REACHED') setUpgradeOpen(true);
        throw e;
      }
    },
    [atLimit, isGuest, userId, commitGuest],
  );

  const patchItem = useCallback(
    async (id, patch) => {
      if (isGuest) {
        commitGuest((g) => ({ ...g, items: g.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
        return;
      }
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i))); // optimistic
      try {
        await api.updateItem(id, patch);
      } catch {
        showToast('บันทึกไม่สำเร็จ', 'error');
        refresh();
      }
    },
    [isGuest, commitGuest, refresh, showToast],
  );

  const removeItem = useCallback(
    async (item) => {
      if (isGuest) {
        commitGuest((g) => ({ ...g, items: g.items.filter((i) => i.id !== item.id) }));
        return;
      }
      await api.deleteItem(item);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    },
    [isGuest, commitGuest],
  );

  const saveProfile = useCallback(
    async (patch) => {
      if (isGuest) return commitGuest((g) => ({ ...g, profile: { ...g.profile, ...patch } })).profile;
      const p = await api.updateProfile(userId, patch);
      setProfile(p);
      return p;
    },
    [isGuest, userId, commitGuest],
  );

  // ── Categories (server or guest) ──
  const addCategory = useCallback(
    async (name, emoji) => {
      if (isGuest) {
        const c = guestStore.newGuestCategory(name, emoji, categories.length);
        commitGuest((g) => ({ ...g, categories: [...g.categories, c] }));
        return c;
      }
      const c = await api.createCategory(name, emoji, categories.length);
      setCategories((prev) => [...prev, c]);
      return c;
    },
    [isGuest, categories.length, commitGuest],
  );

  const editCategory = useCallback(
    async (id, patch) => {
      if (isGuest) {
        commitGuest((g) => ({ ...g, categories: g.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
        return;
      }
      const c = await api.updateCategory(id, patch);
      setCategories((prev) => prev.map((x) => (x.id === c.id ? c : x)));
    },
    [isGuest, commitGuest],
  );

  const removeCategory = useCallback(
    async (id) => {
      const uncategorize = (list) => list.map((i) => (i.category_id === id ? { ...i, category_id: null } : i));
      if (isGuest) {
        commitGuest((g) => ({ ...g, categories: g.categories.filter((c) => c.id !== id), items: uncategorize(g.items) }));
        return;
      }
      await api.deleteCategory(id);
      setCategories((prev) => prev.filter((x) => x.id !== id));
      setItems(uncategorize); // FK is "on delete set null"
    },
    [isGuest, commitGuest],
  );

  const setTypeEnabled = useCallback((type, on) => {
    setEnabledTypesState((prev) => {
      const next = on ? [...new Set([...prev, type])] : prev.filter((t) => t !== type);
      setEnabledTypes(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user,
      isGuest,
      isAdmin: profile?.role === 'admin' && !isGuest,
      profile,
      categories,
      items,
      loading,
      migrating,
      error,
      refresh,
      isPro,
      atLimit,
      saveItem,
      patchItem,
      removeItem,
      saveProfile,
      addCategory,
      editCategory,
      removeCategory,
      enabledTypes,
      setTypeEnabled,
      toast,
      showToast,
      upgradeOpen,
      setUpgradeOpen,
    }),
    [session, isGuest, profile, categories, items, loading, migrating, error, refresh, isPro, atLimit, saveItem, patchItem, removeItem, saveProfile, addCategory, editCategory, removeCategory, enabledTypes, setTypeEnabled, toast, showToast, upgradeOpen],
  );

  return <KipContext.Provider value={value}>{children}</KipContext.Provider>;
}

export function useKip() {
  const ctx = useContext(KipContext);
  if (!ctx) throw new Error('useKip must be used inside KipProvider');
  return ctx;
}
