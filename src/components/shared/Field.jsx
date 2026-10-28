import React from 'react';
import { cn } from '@/lib/utils';

export function Field({ label, children, hint, className }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function SelectInput({ value, onChange, options, placeholder = 'Select…', className, allowEmpty = true }) {
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'h-9 w-full rounded-lg border border-input bg-card px-2.5 text-[13px] outline-none transition focus:border-ring focus:ring-1 focus:ring-ring/30',
        className,
      )}
    >
      {allowEmpty && <option value="">{placeholder}</option>}
      {options.map((opt) => {
        const val = typeof opt === 'string' ? opt : opt.value;
        const label = typeof opt === 'string' ? opt : opt.label;
        return <option key={val} value={val}>{label}</option>;
      })}
    </select>
  );
}

export function ProgressBar({ value = 0, className }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}>
      <div className="h-full rounded-full bg-primary/80 transition-all duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function InlineStat({ label, value }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="num mt-1 text-[15px] font-medium">{value}</p>
    </div>
  );
}