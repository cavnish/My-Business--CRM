import React from 'react';
import { CalendarDays, Megaphone, FolderKanban, Sparkles, BellRing } from 'lucide-react';
import { fmtDay } from '@/lib/format';

const ICONS = { event: CalendarDays, social: Megaphone, project: FolderKanban, reminder: BellRing };

export default function UpcomingCard({ items = [], title = 'Next 10 days' }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-[#C98B54]" />
        <h2 className="text-[13px] font-medium">{title}</h2>
      </div>
      <div className="mt-3 space-y-2.5">
        {items.length === 0 && <p className="py-6 text-center text-[12px] text-muted-foreground">Nothing on the horizon.</p>}
        {items.slice(0, 6).map((item, i) => {
          const Icon = ICONS[item.type] || CalendarDays;
          return (
            <div key={i} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Icon className="h-3 w-3" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] leading-snug">{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{item.meta}</p>
              </div>
              <span className="shrink-0 text-[10px] text-muted-foreground">{fmtDay(item.date)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}