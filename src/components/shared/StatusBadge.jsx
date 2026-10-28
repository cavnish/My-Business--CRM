import React from 'react';
import { cn } from '@/lib/utils';

const TONES = {
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  red: 'border-rose-200 bg-rose-50 text-rose-700',
  blue: 'border-sky-200 bg-sky-50 text-sky-700',
  violet: 'border-violet-200 bg-violet-50 text-violet-700',
  neutral: 'border-border bg-muted text-muted-foreground',
};

const TONE_BY_STATUS = {
  active: 'green', won: 'green', paid: 'green', done: 'green', published: 'green',
  completed: 'green', approved: 'green', qualified: 'blue',
  pending: 'amber', 'in progress': 'amber', 'partially paid': 'amber', 'quotation sent': 'amber',
  'awaiting approval': 'amber', scheduled: 'amber', 'awaiting client': 'amber', negotiation: 'violet',
  contacted: 'blue', 'new lead': 'blue', planned: 'neutral', draft: 'neutral', idea: 'neutral',
  todo: 'neutral', 'to do': 'neutral', lead: 'neutral', paused: 'neutral', inactive: 'neutral',
  overdue: 'red', blocked: 'red', lost: 'red', failed: 'red', cancelled: 'red',
};

export const toneFor = (status = '') => TONE_BY_STATUS[String(status).toLowerCase()] || 'neutral';

export default function StatusBadge({ status, className = '', dot = true }) {
  if (!status) return null;
  const tone = toneFor(status);
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-medium capitalize', TONES[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />}
      {status}
    </span>
  );
}