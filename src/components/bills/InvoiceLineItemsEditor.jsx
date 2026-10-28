import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { inr } from '@/lib/format';
import { lineAmount } from '@/lib/invoiceItems';

export default function InvoiceLineItemsEditor({ items, onChange, addLabel = 'Add line item' }) {
  const update = (index, key, value) => {
    onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  };

  const remove = (index) => onChange(items.filter((_, itemIndex) => itemIndex !== index));

  return (
    <div className="space-y-2.5">
      {items.map((item, index) => (
        <div key={item.id || `${index}-${item.description}`} className="grid gap-2 rounded-xl border border-border/70 bg-background/70 p-3 sm:grid-cols-[minmax(0,1fr)_84px_128px_auto] sm:items-end">
          <label className="block min-w-0">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Description</span>
            <Input value={item.description || ''} onChange={(event) => update(index, 'description', event.target.value)} placeholder="Service or extra work" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Qty</span>
            <Input type="number" min="0.01" step="0.01" value={item.qty ?? 1} onChange={(event) => update(index, 'qty', event.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Rate (₹)</span>
            <Input type="number" min="0" step="0.01" value={item.rate ?? ''} onChange={(event) => update(index, 'rate', event.target.value)} />
          </label>
          <div className="flex items-end justify-between gap-2 sm:justify-end">
            <div className="min-w-[72px] pb-2 text-right">
              <span className="block text-[9px] uppercase text-muted-foreground">Line total</span>
              <span className="num text-[12px] font-medium">{inr(lineAmount(item))}</span>
            </div>
            <Button type="button" size="icon" variant="ghost" aria-label={`Remove invoice line ${index + 1}`} onClick={() => remove(index)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, { description: '', note: '', qty: 1, rate: '' }])}>
        <Plus className="h-3.5 w-3.5" /> {addLabel}
      </Button>
    </div>
  );
}
