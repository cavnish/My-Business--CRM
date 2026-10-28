import React from 'react';
import { cn } from '@/lib/utils';

export default function ProfileAvatar({ src, name, className }) {
  const initials = (name || 'U').trim().slice(0, 2).toUpperCase();

  return (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-semibold uppercase text-primary', className)}>
      {src ? <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" /> : initials}
    </span>
  );
}
