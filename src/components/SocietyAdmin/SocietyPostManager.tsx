import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { createPost, deletePost, type PostInput } from '../../api/societyPosts';

const CATEGORIES = ['party','boardgames','trip','quiz','sports','film','karaoke','culture','social','other'] as const;
const EMPTY: PostInput = { title: '', body: '', category: 'party', date: '', venueKind: 'campus', roomCode: '' };

export function SocietyPostManager() {
  const associationId = useAppStore((s) => s.adminAssociationId);
  const email = useAppStore((s) => s.adminSession?.user.email ?? '');
  const posts = useAppStore((s) => s.societyPosts);
  const loadSocietyPosts = useAppStore((s) => s.loadSocietyPosts);
  const { t } = useTranslation();
  const [form, setForm] = useState<PostInput>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const add = async () => {
    if (!associationId || busy) return;
    setBusy(true);
    try {
      const res = await createPost(form, associationId, email);
      if (res.error) { setError(true); return; }
      setError(false);
      setForm(EMPTY);
      await loadSocietyPosts();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await deletePost(id);
      setError(!!res.error);
      await loadSocietyPosts();
    } catch {
      setError(true);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-error text-sm">{t('admin.saveError')}</p>}
      <div className="flex flex-col gap-2">
        <input className="input input-bordered" placeholder={t('admin.title')} value={form.title}
               onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea className="textarea textarea-bordered" placeholder={t('admin.body')} value={form.body}
               onChange={(e) => setForm({ ...form, body: e.target.value })} />
        <select className="select select-bordered" value={form.category}
               onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="date" className="input input-bordered" value={form.date}
               onChange={(e) => setForm({ ...form, date: e.target.value })} />
        <select className="select select-bordered" value={form.venueKind}
               onChange={(e) => setForm({ ...form, venueKind: e.target.value as PostInput['venueKind'] })}>
          <option value="campus">campus</option><option value="offcampus">offcampus</option><option value="online">online</option>
        </select>
        {form.venueKind === 'campus' && (
          <input className="input input-bordered" placeholder={t('admin.roomCode')} value={form.roomCode ?? ''}
                 onChange={(e) => setForm({ ...form, roomCode: e.target.value })} />
        )}
        <button type="button" className="btn btn-primary btn-sm" disabled={busy || !form.title || !form.date} onClick={add}>{t('admin.addPost')}</button>
      </div>
      <ul className="flex flex-col gap-1">
        {posts.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{p.date} · {p.title}</span>
            <button type="button" className="btn btn-ghost btn-xs text-error" onClick={() => remove(p.id)}>✕</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
