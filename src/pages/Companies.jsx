import React, { useEffect, useState } from 'react';
import { Plus, Search, Building2 } from 'lucide-react';
import { neon } from '@/api/neonDataClient';
import PageHeader from '@/components/shared/PageHeader';
import CompanyCard from '@/components/companies/CompanyCard';
import CompanyForm from '@/components/forms/CompanyForm';
import EmptyState from '@/components/shared/EmptyState';
import useNewQuery from '@/hooks/useNewQuery';
import { inr } from '@/lib/format';
import { COMPANY_STATUS } from '@/lib/constants';
import { useToast } from '@/components/ui/use-toast';

export default function Companies() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [formOpen, setFormOpen] = useNewQuery();
  const [editing, setEditing] = useState(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const query = {};
    if (search.trim()) query.name = { $regex: search.trim() };
    if (status !== 'all') query.status = status;
    try {
      const res = await neon.entities.Company.filter(query, { sort: '-created_date', limit: 100 });
      setCompanies(res.items || []);
    } catch (error) {
      toast({ title: 'Could not load companies', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [search, status]);

  const retainer = companies.reduce((s, c) => s + Number(c.monthly_fee || 0), 0);

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Directory"
        title="Companies"
        description="Every client workspace, kept separate and available from one place."
        actions={
          <button onClick={() => { setEditing(null); setFormOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground shadow-sm">
            <Plus className="h-3.5 w-3.5" /> Add company
          </button>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search companies…"
            className="h-9 w-full rounded-lg border border-input bg-card pl-8 pr-3 text-[12.5px] outline-none focus:border-ring focus:ring-1 focus:ring-ring/30"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-lg border border-input bg-card px-2.5 text-[12px]">
          <option value="all">All statuses</option>
          {COMPANY_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="rounded-lg border border-border bg-card px-3 py-2 text-[11.5px] text-muted-foreground">
          Retained <span className="num ml-1 font-medium text-foreground">{inr(retainer)}</span>/mo
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-56 animate-pulse rounded-2xl border border-border bg-card/60" />)}
        </div>
      ) : companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No companies match this view"
          description="Add a company to give it a full workspace: leads, projects, SEO, social and billing."
          action={<button onClick={() => { setEditing(null); setFormOpen(true); }} className="rounded-lg bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground">Add your first company</button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((c) => <CompanyCard key={c.id} company={c} />)}
        </div>
      )}

      <CompanyForm open={formOpen} onOpenChange={setFormOpen} company={editing} onSaved={load} />
    </div>
  );
}