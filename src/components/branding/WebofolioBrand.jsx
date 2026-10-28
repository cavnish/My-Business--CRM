import React from 'react';

export default function WebofolioBrand({ subtitle, className = '', markClassName = 'h-10 w-10' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img src="/webofolio-mark.svg" alt="" aria-hidden="true" className={`shrink-0 ${markClassName}`} />
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold tracking-tight">Webofolio</span>
        {subtitle && <span className="block text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{subtitle}</span>}
      </span>
    </div>
  );
}
