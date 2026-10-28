import React from 'react';
import { cn } from '@/lib/utils';
import { initials } from '@/lib/format';

const SIZES = {
  sm: 'h-8 w-8 rounded-lg text-[10px]',
  md: 'h-10 w-10 rounded-xl text-[12px]',
  lg: 'h-14 w-14 rounded-2xl text-[17px]',
};

export default function CompanyMark({ company, size = 'md', className = '' }) {
  const color = company?.brand_color || '#1F4D3D';
  if (company?.logo_url) {
    return (
      <img
        src={company.logo_url}
        alt={company.name}
        className={cn('shrink-0 object-cover', SIZES[size], className)}
      />
    );
  }
  return (
    <span
      className={cn('flex shrink-0 items-center justify-center font-semibold tracking-wide', SIZES[size], className)}
      style={{ backgroundColor: `${color}18`, color }}
    >
      {initials(company?.name || 'Company')}
    </span>
  );
}