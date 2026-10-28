import React from 'react';
import { ExternalLink, LoaderCircle, Pencil, Plus, RefreshCw, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import StatusBadge from '@/components/shared/StatusBadge';
import { fmtDate } from '@/lib/format';

const factLabel = (event) => {
  if (event.historical_year) return `${event.historical_year} · ${event.category}`;
  return event.category || 'Calendar event';
};

export default function CalendarDayPanel({
  open, onOpenChange, date, events = [], loading = false, error = '', isAdmin = false,
  onRefresh, onAdd, onEdit, onToggleGreeting, onToggleHidden,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal">{fmtDate(date)}</DialogTitle>
          <DialogDescription>Saved records stay available offline. Historical facts are sourced and cached only when you open or refresh this date.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onRefresh} disabled={loading} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] hover:bg-muted disabled:opacity-60">
            {loading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {loading ? 'Loading facts…' : 'Refresh historical facts'}
          </button>
          <button type="button" onClick={onAdd} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] hover:bg-muted"><Plus className="h-3.5 w-3.5" /> Add custom event</button>
        </div>
        {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11px] text-destructive">{error}</p>}
        <div className="space-y-3">
          {!loading && events.length === 0 && <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[12px] text-muted-foreground">No stored facts for this date yet. Refresh historical facts or add a custom event.</p>}
          {events.map((event) => (
            <article key={event.id} className={`rounded-xl border border-border p-3 ${event.hidden ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[13px] font-medium leading-snug">{event.title}</h3>
                  <p className="mt-1 text-[10.5px] text-muted-foreground">{factLabel(event)}{event.location ? ` · ${event.location}` : ''}{event.person_name && event.person_name !== event.title ? ` · ${event.person_name}` : ''}</p>
                </div>
                <StatusBadge status={event.verification_status || 'Manual'} dot={false} />
              </div>
              {event.description && <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">{event.description}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                {event.source_attribution && <span>{event.source_attribution}</span>}
                {event.source_url && <a href={event.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Source <ExternalLink className="h-2.5 w-2.5" /></a>}
              </div>
              {isAdmin && <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/70 pt-2.5">
                <button type="button" onClick={() => onEdit(event)} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] hover:bg-muted"><Pencil className="h-2.5 w-2.5" /> Edit</button>
                <button type="button" onClick={() => onToggleGreeting(event)} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] hover:bg-muted"><Sparkles className="h-2.5 w-2.5" /> {event.greeting_suitable ? 'Greeting enabled' : 'Use for greetings'}</button>
                <button type="button" onClick={() => onToggleHidden(event)} className="rounded border border-border px-2 py-1 text-[10px] hover:bg-muted">{event.hidden ? 'Show' : 'Hide'}</button>
              </div>}
            </article>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
