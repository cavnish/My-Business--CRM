import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Megaphone, ExternalLink } from 'lucide-react';
import { neon } from '@/api/neonDataClient';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import DeleteButton from '@/components/shared/DeleteButton';
import SocialPostForm from '@/components/forms/SocialPostForm';
import EmptyState from '@/components/shared/EmptyState';
import { useToast } from '@/components/ui/use-toast';
import useNewQuery from '@/hooks/useNewQuery';
import { PLATFORMS, POST_STATUS } from '@/lib/constants';
import { fmtDate, monthKey, relative } from '@/lib/format';
import { Image } from '@/components/ui/image';

const platformTone = {
  Instagram: 'from-[#F3D9C6] to-[#E9C0A6]',
  Facebook: 'from-[#D7E3F2] to-[#C3D5EB]',
  LinkedIn: 'from-[#D4E2E8] to-[#BFD4DD]',
  YouTube: 'from-[#F2D5D0] to-[#E8BDB6]',
  'Google Business Profile': 'from-[#DDE7D6] to-[#C9DBC0]',
  X: 'from-[#E3E3E0] to-[#D2D2CE]',
};

export default function Social() {
  const [posts, setPosts] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState('all');
  const [platform, setPlatform] = useState('all');
  const [status, setStatus] = useState('All');
  const [formOpen, setFormOpen] = useNewQuery();
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = async () => {
    const query = {};
    if (companyId !== 'all') query.company_id = companyId;
    if (platform !== 'all') query.platform = platform;
    try {
      const [postRes, companyRes] = await Promise.all([
        neon.entities.SocialPost.filter(query, { sort: 'scheduled_date', limit: 200 }),
        neon.entities.Company.list({ limit: 60 }),
      ]);
      setPosts(postRes.items || []);
      setCompanies(companyRes.items || []);
    } catch (error) {
      toast({ title: 'Could not load social posts', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [companyId, platform]);

  const companiesById = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c])), [companies]);
  const month = monthKey();
  const monthPosts = posts.filter((p) => String(p.scheduled_date).slice(0, 7) === month);
  const visible = posts.filter((p) => status === 'All' || p.status === status);

  const setPostStatus = async (post, next) => {
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, status: next } : p)));
    try {
      await neon.entities.SocialPost.update(post.id, { status: next });
    } catch (error) {
      setPosts((prev) => prev.map((item) => (item.id === post.id ? post : item)));
      toast({ title: 'Could not update post', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Content"
        title="Social media"
        description="A working content calendar for every brand — ideas through to published links."
        actions={<button onClick={() => { setEditing(null); setFormOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground"><Plus className="h-3.5 w-3.5" /> Plan a post</button>}
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Planned this month', monthPosts.length],
          ['Awaiting approval', posts.filter((p) => p.status === 'Awaiting Approval').length],
          ['Scheduled', posts.filter((p) => p.status === 'Scheduled').length],
          ['Published', posts.filter((p) => p.status === 'Published').length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
            <p className="num mt-1 text-[17px] font-medium">{value}</p>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1">
        {['All', ...POST_STATUS].map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`rounded-full border px-2.5 py-1 text-[11px] transition ${status === s ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:text-foreground'}`}>{s}</button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="h-8 max-w-[160px] rounded-lg border border-input bg-card px-2 text-[11.5px]">
            <option value="all">All companies</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="h-8 rounded-lg border border-input bg-card px-2 text-[11.5px]">
            <option value="all">All platforms</option>
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((i) => <div key={i} className="h-60 animate-pulse rounded-2xl border border-border bg-card/60" />)}</div>
      ) : visible.length === 0 ? (
        <EmptyState icon={Megaphone} title="No content in this view" description="Plan the first post and it will appear here with its caption, assets and schedule." action={<button onClick={() => { setEditing(null); setFormOpen(true); }} className="rounded-lg bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground">Plan a post</button>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((post) => (
            <div key={post.id} className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:border-primary/20">
              <button onClick={() => { setEditing(post); setFormOpen(true); }} className="block text-left">
                <div className={`relative flex h-28 items-end bg-gradient-to-br ${platformTone[post.platform] || 'from-[#EDE7DB] to-[#E0D8C9]'} p-3`}>
                  {post.media_url ? (
                    <Image src={post.media_url} alt={post.title} className="absolute inset-0 h-full w-full object-cover" fittingType="fill" />
                  ) : null}
                  <div className="relative z-10 flex w-full items-center justify-between">
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium text-foreground backdrop-blur">{post.platform}</span>
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] text-foreground backdrop-blur">{post.post_type}</span>
                  </div>
                </div>
              </button>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => { setEditing(post); setFormOpen(true); }} className="text-left text-[13px] font-medium leading-snug hover:underline">{post.title}</button>
                  <DeleteButton onConfirm={async () => { await neon.entities.SocialPost.delete(post.id); load(); }} label="post" />
                </div>
                <p className="mt-0.5 text-[10.5px] text-muted-foreground">{companiesById[post.company_id]?.name} {post.campaign ? `· ${post.campaign}` : ''}</p>
                {post.caption && <p className="mt-2 line-clamp-2 whitespace-pre-line text-[11.5px] leading-relaxed text-muted-foreground">{post.caption}</p>}
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/70 pt-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={post.status} />
                    <span className="text-[10px] text-muted-foreground">{post.scheduled_date ? fmtDate(post.scheduled_date, { year: false }) : 'No date'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {post.published_url && (
                      <a href={post.published_url} target="_blank" rel="noreferrer" className="rounded p-1 text-muted-foreground hover:text-foreground" title="Open published post"><ExternalLink className="h-3 w-3" /></a>
                    )}
                    {post.status === 'Awaiting Approval' && (
                      <button onClick={() => setPostStatus(post, 'Approved')} className="rounded-md border border-border px-1.5 py-0.5 text-[10px] hover:bg-muted">Approve</button>
                    )}
                    {post.status === 'Approved' && (
                      <button onClick={() => setPostStatus(post, 'Scheduled')} className="rounded-md border border-border px-1.5 py-0.5 text-[10px] hover:bg-muted">Schedule</button>
                    )}
                  </div>
                </div>
                {post.status === 'Scheduled' && post.scheduled_date && (
                  <p className="mt-2 text-[10px] text-muted-foreground">Publishes {relative(post.scheduled_date)} · confirm on the platform before marking published.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <SocialPostForm open={formOpen} onOpenChange={(v) => { setFormOpen(v); if (!v) setEditing(null); }} companies={companies} companyId={companyId !== 'all' ? companyId : ''} post={editing} onSaved={load} />
    </div>
  );
}