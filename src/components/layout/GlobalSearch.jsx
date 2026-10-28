import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Building2, Users, CheckSquare, CornerDownLeft } from 'lucide-react';
import { neon } from '@/api/neonDataClient';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ companies: [], leads: [], tasks: [] });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults({ companies: [], leads: [], tasks: [] });
      return;
    }
    let active = true;
    setLoading(true);
    const q = query.trim();
    const timer = setTimeout(async () => {
      const [companies, leads, tasks] = await Promise.all([
        neon.entities.Company.filter({ name: { $regex: q } }, { limit: 4 }),
        neon.entities.Lead.filter({ name: { $regex: q } }, { limit: 4 }),
        neon.entities.Task.filter({ title: { $regex: q } }, { limit: 4 }),
      ]);
      if (!active) return;
      setResults({ companies: companies.items || [], leads: leads.items || [], tasks: tasks.items || [] });
      setLoading(false);
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query, open]);

  const go = (path) => {
    setOpen(false);
    setQuery('');
    navigate(path);
  };

  const empty = !loading && query.trim().length >= 2 && !results.companies.length && !results.leads.length && !results.tasks.length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2 text-[12.5px] text-muted-foreground transition hover:border-border hover:bg-card md:flex md:w-56"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Search anything</span>
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px]">⌘K</kbd>
      </button>
      <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted md:hidden">
        <Search className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[12%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search companies, leads, tasks…"
              className="h-12 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-[360px] overflow-y-auto p-2">
            {query.trim().length < 2 && (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">Type at least two characters to search your workspace.</p>
            )}
            {loading && <p className="px-3 py-6 text-center text-xs text-muted-foreground">Searching…</p>}
            {results.companies.length > 0 && (
              <Section label="Companies">
                {results.companies.map((c) => (
                  <Row key={c.id} icon={Building2} title={c.name} meta={c.domain} onClick={() => go(`/companies/${c.id}`)} />
                ))}
              </Section>
            )}
            {results.leads.length > 0 && (
              <Section label="Leads">
                {results.leads.map((l) => (
                  <Row key={l.id} icon={Users} title={l.name} meta={`${l.company_name || 'Lead'} · ${l.status}`} onClick={() => go('/leads')} />
                ))}
              </Section>
            )}
            {results.tasks.length > 0 && (
              <Section label="Tasks">
                {results.tasks.map((t) => (
                  <Row key={t.id} icon={CheckSquare} title={t.title} meta={t.status} onClick={() => go('/tasks')} />
                ))}
              </Section>
            )}
            {empty && <p className="px-3 py-6 text-center text-xs text-muted-foreground">Nothing matched “{query}”.</p>}
          </div>
          <div className="flex items-center gap-2 border-t border-border bg-muted/40 px-4 py-2 text-[10px] text-muted-foreground">
            <CornerDownLeft className="h-3 w-3" /> Jump to a record
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Section({ label, children }) {
  return (
    <div className="mb-1">
      <p className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function Row({ icon: Icon, title, meta, onClick }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-muted">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px]">{title}</span>
        {meta && <span className="block truncate text-[11px] text-muted-foreground">{meta}</span>}
      </span>
    </button>
  );
}