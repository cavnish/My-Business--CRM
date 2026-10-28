import React, { useEffect, useState } from 'react';
import { neon } from '@/api/neonDataClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, SelectInput } from '@/components/shared/Field';
import { useToast } from '@/components/ui/use-toast';
import { COMPANY_STATUS, SERVICE_OPTIONS } from '@/lib/constants';

const blank = {
  name: '', domain: '', industry: '', description: '', contact_person: '', phone: '', email: '',
  address: '', logo_url: '', brand_color: '#1F4D3D', status: 'To Confirm', service_package: '',
  services: [], monthly_fee: '', commission_rate: '', tax_rate: '', billing_cycle: '',
  contract_start: '', payment_terms: '', hosting_provider: '', domain_registrar: '',
  domain_expiry: '', deployment_platform: '', framework: '', repository_url: '',
  database_provider: '', analytics_id: '', admin_url: '', website_notes: '', notes: '',
};

export default function CompanyForm({ open, onOpenChange, company, onSaved }) {
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('profile');
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setForm(company ? { ...blank, ...company } : blank);
      setTab('profile');
    }
  }, [open, company]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleService = (s) =>
    set('services', form.services?.includes(s) ? form.services.filter((x) => x !== s) : [...(form.services || []), s]);

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const optionalNumber = (value) => value === '' || value === null ? null : Number(value);
    const payload = {
      ...form,
      monthly_fee: optionalNumber(form.monthly_fee),
      commission_rate: optionalNumber(form.commission_rate),
      tax_rate: optionalNumber(form.tax_rate),
      contract_start: form.contract_start || null,
      domain_expiry: form.domain_expiry || null,
    };
    try {
      if (Object.values(payload).some((value) => typeof value === 'number' && !Number.isFinite(value))) {
        throw new Error('Enter valid numbers for the commercial terms.');
      }
      if (company) await neon.entities.Company.update(company.id, payload);
      else await neon.entities.Company.create(payload);
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast({ title: 'Could not save company', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal">{company ? 'Edit company' : 'Add a company'}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 rounded-lg bg-muted p-1 text-[12px]">
          {[['profile', 'Profile'], ['commercial', 'Commercial'], ['web', 'Website']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} className={`flex-1 rounded-md px-2 py-1.5 transition ${tab === key ? 'bg-card font-medium shadow-sm' : 'text-muted-foreground'}`}>{label}</button>
          ))}
        </div>

        {tab === 'profile' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Company name" className="sm:col-span-2"><Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Acme Industries Pvt. Ltd." /></Field>
            <Field label="Website domain"><Input value={form.domain} onChange={(e) => set('domain', e.target.value)} placeholder="acme.in" /></Field>
            <Field label="Industry"><Input value={form.industry} onChange={(e) => set('industry', e.target.value)} /></Field>
            <Field label="Contact person"><Input value={form.contact_person} onChange={(e) => set('contact_person', e.target.value)} /></Field>
            <Field label="Phone"><Input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field label="Email"><Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></Field>
            <Field label="Status"><SelectInput value={form.status} onChange={(v) => set('status', v)} options={COMPANY_STATUS} allowEmpty={false} /></Field>
            <Field label="Address" className="sm:col-span-2"><Input value={form.address} onChange={(e) => set('address', e.target.value)} /></Field>
            <Field label="Description" className="sm:col-span-2"><Textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
            <Field label="Brand colour"><Input type="color" value={form.brand_color} onChange={(e) => set('brand_color', e.target.value)} className="h-9 w-full cursor-pointer p-1" /></Field>
            <Field label="Logo URL"><Input value={form.logo_url} onChange={(e) => set('logo_url', e.target.value)} placeholder="Optional image link" /></Field>
          </div>
        )}

        {tab === 'commercial' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Service package"><Input value={form.service_package} onChange={(e) => set('service_package', e.target.value)} placeholder="Growth retainer" /></Field>
            <Field label="Monthly fee (₹)"><Input type="number" value={form.monthly_fee ?? ''} onChange={(e) => set('monthly_fee', e.target.value)} /></Field>
            <Field label="Commission rate (%)" hint="Applied only when you choose to bill an order commission."><Input type="number" value={form.commission_rate ?? ''} onChange={(e) => set('commission_rate', e.target.value)} /></Field>
            <Field label="Tax rate (%)"><Input type="number" value={form.tax_rate ?? ''} onChange={(e) => set('tax_rate', e.target.value)} /></Field>
            <Field label="Billing cycle"><SelectInput value={form.billing_cycle} onChange={(v) => set('billing_cycle', v)} options={['Monthly', 'Quarterly', 'Annual', 'Project-based']} placeholder="To Confirm" /></Field>
            <Field label="Payment terms"><SelectInput value={form.payment_terms} onChange={(v) => set('payment_terms', v)} options={['Due on receipt', 'Net 7', 'Net 15', 'Net 30', 'Net 45']} placeholder="To Confirm" /></Field>
            <Field label="Contract start"><Input type="date" value={form.contract_start || ''} onChange={(e) => set('contract_start', e.target.value)} /></Field>
            <Field label="Notes" className="sm:col-span-2"><Textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
            <div className="sm:col-span-2">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Services provided</p>
              <div className="flex flex-wrap gap-1.5">
                {SERVICE_OPTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => toggleService(s)} className={`rounded-full border px-2.5 py-1 text-[11px] transition ${form.services?.includes(s) ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>{s}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'web' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Hosting provider"><Input value={form.hosting_provider} onChange={(e) => set('hosting_provider', e.target.value)} /></Field>
            <Field label="Domain registrar"><Input value={form.domain_registrar} onChange={(e) => set('domain_registrar', e.target.value)} /></Field>
            <Field label="Domain expiry"><Input type="date" value={form.domain_expiry || ''} onChange={(e) => set('domain_expiry', e.target.value)} /></Field>
            <Field label="Deployment platform"><Input value={form.deployment_platform} onChange={(e) => set('deployment_platform', e.target.value)} /></Field>
            <Field label="Framework"><Input value={form.framework} onChange={(e) => set('framework', e.target.value)} /></Field>
            <Field label="Database"><Input value={form.database_provider} onChange={(e) => set('database_provider', e.target.value)} /></Field>
            <Field label="Repository URL"><Input value={form.repository_url} onChange={(e) => set('repository_url', e.target.value)} /></Field>
            <Field label="Analytics ID"><Input value={form.analytics_id} onChange={(e) => set('analytics_id', e.target.value)} /></Field>
            <Field label="Admin panel URL" className="sm:col-span-2"><Input value={form.admin_url} onChange={(e) => set('admin_url', e.target.value)} /></Field>
            <Field label="Technical notes" className="sm:col-span-2"><Textarea rows={3} value={form.website_notes} onChange={(e) => set('website_notes', e.target.value)} /></Field>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.name.trim()}>{saving ? 'Saving…' : company ? 'Save changes' : 'Add company'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}