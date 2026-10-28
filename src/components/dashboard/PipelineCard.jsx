import React from 'react';
import { Link } from 'react-router-dom';
import { LEAD_STAGES } from '@/lib/constants';
import { inr } from '@/lib/format';

const colors = ['#3E6B5A', '#5E8B78', '#8AA79A', '#B99A6B', '#C98B54', '#1F4D3D', '#9AA5A0'];

export default function PipelineCard({ leads = [] }) {
  const active = leads.filter((l) => l.status !== 'Lost');
  const max = Math.max(1, ...LEAD_STAGES.slice(0, 5).map((s) => active.filter((l) => l.status === s).length));
  const won = leads.filter((l) => l.status === 'Won');
  const lost = leads.filter((l) => l.status === 'Lost');
  const conversion = leads.length ? Math.round((won.length / (won.length + lost.length || 1)) * 100) : 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[13px] font-medium">Sales pipeline</h2>
          <p className="text-[11px] text-muted-foreground">Open leads by stage</p>
        </div>
        <Link to="/leads" className="text-[11.5px] text-muted-foreground hover:text-foreground">Open board</Link>
      </div>
      <div className="mt-4 space-y-2.5">
        {LEAD_STAGES.slice(0, 5).map((stage, i) => {
          const items = active.filter((l) => l.status === stage);
          const value = items.reduce((s, l) => s + Number(l.estimated_value || 0), 0);
          return (
            <div key={stage} className="flex items-center gap-2.5">
              <span className="w-[92px] shrink-0 text-[10.5px] text-muted-foreground">{stage}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full transition-all" style={{ width: `${(items.length / max) * 100}%`, backgroundColor: colors[i] }} />
              </div>
              <span className="num w-5 text-right text-[10.5px] text-muted-foreground">{items.length}</span>
              <span className="num w-16 text-right text-[10.5px] text-foreground/80">{inr(value, true)}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[11px]">
        <span className="text-muted-foreground">Win rate (decided leads)</span>
        <span className="font-medium">{conversion}%</span>
      </div>
    </div>
  );
}