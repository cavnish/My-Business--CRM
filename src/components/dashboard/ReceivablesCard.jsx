import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, AlertCircle } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import { balanceDue, fmtDate, inr, relative } from '@/lib/format';

export default function ReceivablesCard({ payments = [], companiesById = {}, outstanding = 0 }) {
  const top = [...payments].sort((a, b) => String(a.due_date || '').localeCompare(String(b.due_date || ''))).slice(0, 4);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-5 py-3.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-muted-foreground">Outstanding</p>
        <p className="num mt-1 font-display text-[30px] leading-none">{inr(outstanding)}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">Across {payments.length} open invoice{payments.length === 1 ? '' : 's'}</p>
      </div>
      <div className="flex-1 divide-y divide-border/70">
        {top.length === 0 && <p className="px-5 py-8 text-center text-[12px] text-muted-foreground">Every invoice is settled.</p>}
        {top.map((p) => (
          <Link key={p.id} to="/payments" className="block px-5 py-3 transition hover:bg-muted/40">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-medium">{companiesById[p.company_id]?.name || 'Client'}</p>
                <p className="truncate text-[10.5px] text-muted-foreground">{p.invoice_no || 'No invoice no.'} · due {fmtDate(p.due_date, { year: false })}</p>
              </div>
              <span className="num shrink-0 text-[12.5px] font-medium">{inr(balanceDue(p))}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <StatusBadge status={p.status} />
              {p.next_reminder && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <AlertCircle className="h-2.5 w-2.5" /> {relative(p.next_reminder)}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
      <Link to="/payments" className="flex items-center justify-between border-t border-border px-5 py-2.5 text-[11.5px] text-muted-foreground hover:text-foreground">
        Open receivables <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}