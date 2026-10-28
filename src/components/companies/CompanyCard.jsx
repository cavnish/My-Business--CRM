import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Globe } from 'lucide-react';
import CompanyMark from '@/components/shared/CompanyMark';
import StatusBadge from '@/components/shared/StatusBadge';
import { inr } from '@/lib/format';

export default function CompanyCard({ company }) {
  return (
    <Link
      to={`/companies/${company.id}`}
      className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_10px_30px_-22px_rgba(16,42,36,0.35)]"
    >
      <div className="flex items-start justify-between">
        <CompanyMark company={company} size="lg" />
        <div className="flex items-center gap-2">
          <StatusBadge status={company.status} />
          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/50 transition group-hover:text-foreground" />
        </div>
      </div>
      <h3 className="mt-4 text-[15px] font-medium leading-snug">{company.name}</h3>
      <p className="mt-0.5 flex items-center gap-1 text-[11.5px] text-muted-foreground">
        <Globe className="h-3 w-3" /> {company.domain || company.industry || 'No website yet'}
      </p>

      <div className="mt-3 flex flex-wrap gap-1">
        {(company.services || []).slice(0, 3).map((s) => (
          <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{s}</span>
        ))}
        {(company.services || []).length > 3 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">+{company.services.length - 3}</span>
        )}
      </div>

      <div className="mt-auto flex items-end justify-between border-t border-border/70 pt-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Retainer</p>
          <p className="num text-[13px] font-medium">{company.monthly_fee ? `${inr(company.monthly_fee)}/mo` : 'Not set'}</p>
        </div>
        <p className="text-[10.5px] text-muted-foreground">{company.service_package || 'Custom scope'}</p>
      </div>
    </Link>
  );
}