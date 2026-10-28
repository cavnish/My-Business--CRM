import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

export default function StatCard({ label, value, hint, icon: Icon, to, accent = '' }) {
  const body = (
    <div className="group relative h-full overflow-hidden rounded-2xl border border-border bg-card p-5 transition hover:border-primary/25 hover:shadow-[0_6px_24px_-14px_rgba(16,42,36,0.25)]">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-muted-foreground">{label}</p>
        {Icon && (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground transition group-hover:bg-primary/10 group-hover:text-primary">
            <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
          </span>
        )}
      </div>
      <p className="num mt-3 font-display text-[32px] leading-none text-foreground">{value}</p>
      <div className="mt-2 flex items-center gap-1 text-[11.5px] text-muted-foreground">
        <span className={accent || ''}>{hint}</span>
        {to && <ArrowUpRight className="ml-auto h-3 w-3 opacity-0 transition group-hover:opacity-60" />}
      </div>
    </div>
  );
  return to ? <Link to={to} className="block h-full">{body}</Link> : body;
}