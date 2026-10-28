import React from 'react';
import { Plus } from 'lucide-react';

export default function CompanyRecordList({ title, subtitle = '', onAdd, addLabel = 'Add', children, count }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div>
          <h2 className="text-[13px] font-medium">{title} {typeof count === 'number' && <span className="ml-1 text-[11px] font-normal text-muted-foreground">{count}</span>}</h2>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
        {onAdd && (
          <button onClick={onAdd} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] text-muted-foreground transition hover:border-primary/30 hover:text-foreground">
            <Plus className="h-3 w-3" /> {addLabel}
          </button>
        )}
      </div>
      <div className="divide-y divide-border/70">{children}</div>
    </div>
  );
}