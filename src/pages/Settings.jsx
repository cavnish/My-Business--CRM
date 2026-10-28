import React, { useEffect, useState } from 'react';
import { Save, Download, Bell, ShieldCheck, Plug, Building2, Camera } from 'lucide-react';
import { neon } from '@/api/neonDataClient';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import { Field } from '@/components/shared/Field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import StatusBadge from '@/components/shared/StatusBadge';
import { downloadCsv } from '@/lib/exportCsv';
import { todayISO } from '@/lib/format';
import { profileImageDataUrl } from '@/lib/profileImage';
import ProfileAvatar from '@/components/shared/ProfileAvatar';

const INTEGRATIONS = [
  { name: 'Email delivery', status: 'Not configured', detail: 'Sending invoices and reminders by email needs a verified sending domain and provider credentials.' },
  { name: 'Search Console & Analytics', status: 'Not connected', detail: 'Clicks, rankings and indexing data are not pulled in. SEO work is logged manually.' },
  { name: 'Social publishing', status: 'Manual', detail: 'Posts are planned and approved here. Publishing happens on each platform, then you record the live link.' },
  { name: 'AI assistant', status: 'Not configured', detail: 'No model endpoint is connected yet, so no AI answers are generated.' },
  { name: 'SMS & WhatsApp reminders', status: 'Not configured', detail: 'Reminders stay in-app and in the calendar for now.' },
];

export default function Settings() {
  const { user, refreshUserProfile } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { toast } = useToast();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [counts, setCounts] = useState({ companies: 0, leads: 0, projects: 0, tasks: 0 });
  const [notifyPermission, setNotifyPermission] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');

  useEffect(() => {
    if (!user) return;
    let active = true;
    neon.auth.me().then((profile) => {
      if (!active) return;
      const source = { ...user, ...(profile || {}) };
      setForm({
        full_name: source.full_name || source.name || '',
        job_title: source.job_title || '',
        phone: source.phone || '',
        avatar_url: source.avatar_url || '',
        business_name: source.business_name || '',
        business_tagline: source.business_tagline || '',
        business_phone: source.business_phone || '',
        business_email: source.business_email || source.email || '',
        business_address: source.business_address || '',
        business_gstin: source.business_gstin || '',
        invoice_prefix: source.invoice_prefix || 'INV',
        invoice_terms: source.invoice_terms || 'Payment due within 15 days of the invoice date.',
        payment_instructions: source.payment_instructions || '',
        notify_tasks: source.notify_tasks !== false,
        notify_payments: source.notify_payments !== false,
        notify_daily: source.notify_daily !== false,
        browser_notifications: source.browser_notifications || false,
      });
    }).catch((error) => {
      console.error('Neon profile load failed:', error);
      toast({ title: 'Could not load profile', description: error?.message || 'Please try again.', variant: 'destructive' });
    });
    return () => { active = false; };
  }, [user, toast]);

  useEffect(() => {
    if (!isAdmin) return;
    const loadCounts = async () => {
      try {
        const [companies, leads, projects, tasks] = await Promise.all([
          neon.entities.Company.count({}),
          neon.entities.Lead.count({}),
          neon.entities.Project.count({}),
          neon.entities.Task.count({}),
        ]);
        setCounts({ companies, leads, projects, tasks });
      } catch (error) {
        toast({ title: 'Could not load workspace totals', description: error?.message || 'Please try again.', variant: 'destructive' });
      }
    };
    loadCounts();
  }, [isAdmin, toast]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const editable = isAdmin ? form : Object.fromEntries(
        ['full_name', 'job_title', 'phone', 'avatar_url', 'notify_tasks', 'notify_payments', 'notify_daily', 'browser_notifications']
          .map((key) => [key, form[key]]),
      );
      const updatedProfile = await neon.auth.updateMe(editable);
      setForm((current) => ({ ...current, ...updatedProfile }));
      await refreshUserProfile();
      toast({ title: 'Profile saved', description: isAdmin ? 'Your profile and business settings have been updated.' : 'Your profile details have been updated.' });
    } catch (error) {
      toast({ title: 'Could not save settings', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const changePhoto = async (event) => {
    const [file] = event.target.files || [];
    event.target.value = '';
    if (!file) return;
    try {
      set('avatar_url', await profileImageDataUrl(file));
    } catch (error) {
      toast({ title: 'Could not use that picture', description: error?.message || 'Choose a different image.', variant: 'destructive' });
    }
  };

  const askPermission = async () => {
    if (!('Notification' in window)) return;
    try {
      const permission = await Notification.requestPermission();
      setNotifyPermission(permission);
      if (permission === 'granted') {
        set('browser_notifications', true);
        new Notification('Notifications enabled', { body: 'You will see browser reminders while the app is open.' });
      }
    } catch (error) {
      toast({ title: 'Could not enable browser notifications', description: error?.message || 'Please check your browser permissions.', variant: 'destructive' });
    }
  };

  const exportCompanies = async () => {
    try {
      const res = await neon.entities.Company.list({ limit: 200 });
      downloadCsv(`companies-${todayISO()}.csv`, res.items || [], [
        { label: 'Name', key: 'name' }, { label: 'Domain', key: 'domain' }, { label: 'Status', key: 'status' },
        { label: 'Contact', key: 'contact_person' }, { label: 'Email', key: 'email' }, { label: 'Phone', key: 'phone' },
        { label: 'Monthly fee', key: 'monthly_fee' }, { label: 'Package', key: 'service_package' },
      ]);
    } catch (error) {
      toast({ title: 'Could not export companies', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  if (!form) return <div className="h-72 animate-pulse rounded-2xl border border-border bg-card/60" />;

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow={isAdmin ? 'Workspace' : 'Your account'}
        title={isAdmin ? 'Profile & settings' : 'My profile'}
        description={isAdmin ? 'Update your personal profile, business identity, billing defaults and notifications.' : 'Edit your name, profile picture and contact details.'}
        actions={<Button onClick={save} disabled={saving} className="gap-1.5 text-[12px]"><Save className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save changes'}</Button>}
      />

      <div className={`grid gap-4 ${isAdmin ? 'lg:grid-cols-3' : 'lg:grid-cols-1'}`}>
        <div className={`space-y-4 ${isAdmin ? 'lg:col-span-2' : ''}`}>
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center gap-4">
              <ProfileAvatar src={form.avatar_url} name={form.full_name || user?.email} className="h-16 w-16" />
              <div className="min-w-0 flex-1">
                <h2 className="text-[13px] font-medium">Personal profile</h2>
                <p className="mt-1 truncate text-xs text-muted-foreground">{user?.email || 'Email unavailable'}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted">
                    <Camera className="h-3.5 w-3.5" /> Change picture
                    <input type="file" accept="image/*" className="sr-only" onChange={changePhoto} />
                  </label>
                  {form.avatar_url && (
                    <button type="button" onClick={() => set('avatar_url', '')} className="rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted">
                      Remove picture
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Full name"><Input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} autoComplete="name" /></Field>
              <Field label="Job title"><Input value={form.job_title} onChange={(e) => set('job_title', e.target.value)} placeholder="e.g. Account manager" /></Field>
              <Field label="Phone"><Input value={form.phone} onChange={(e) => set('phone', e.target.value)} type="tel" autoComplete="tel" /></Field>
            </div>
          </div>

          {isAdmin && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <h2 className="text-[13px] font-medium">Business identity</h2>
              <span className="ml-auto text-[10.5px] text-muted-foreground">Used on invoices and reports</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Business name"><Input value={form.business_name} onChange={(e) => set('business_name', e.target.value)} /></Field>
              <Field label="Tagline"><Input value={form.business_tagline} onChange={(e) => set('business_tagline', e.target.value)} placeholder="Websites · SEO · Social" /></Field>
              <Field label="GSTIN"><Input value={form.business_gstin} onChange={(e) => set('business_gstin', e.target.value)} /></Field>
              <Field label="Business phone"><Input value={form.business_phone} onChange={(e) => set('business_phone', e.target.value)} /></Field>
              <Field label="Business email"><Input value={form.business_email} onChange={(e) => set('business_email', e.target.value)} /></Field>
              <Field label="Address" className="sm:col-span-2"><Input value={form.business_address} onChange={(e) => set('business_address', e.target.value)} /></Field>
            </div>
          </div>)}

          {isAdmin && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 text-[13px] font-medium">Invoice defaults</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Invoice prefix"><Input value={form.invoice_prefix} onChange={(e) => set('invoice_prefix', e.target.value)} placeholder="INV" /></Field>
              <Field label="Payment terms"><Input value={form.invoice_terms} onChange={(e) => set('invoice_terms', e.target.value)} /></Field>
              <Field label="Payment instructions" className="sm:col-span-2"><Textarea rows={3} value={form.payment_instructions} onChange={(e) => set('payment_instructions', e.target.value)} placeholder="Bank details, UPI ID or a note about how to pay" /></Field>
            </div>
            <p className="mt-2 text-[10.5px] text-muted-foreground">Bank details appear on the printed invoice. They are never shown in exports or lists.</p>
          </div>
            )}

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <Bell className="h-3.5 w-3.5 text-muted-foreground" />
              <h2 className="text-[13px] font-medium">Notifications</h2>
            </div>
            <div className="space-y-2">
              {[
                ['notify_tasks', 'Task due today and overdue reminders'],
                ['notify_payments', 'Invoice and follow-up reminders'],
                ['notify_daily', 'Daily summary on My Day'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-[12px]">
                  <input type="checkbox" checked={!!form[key]} onChange={(e) => set(key, e.target.checked)} className="accent-[#1F4D3D]" />
                  {label}
                </label>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-muted/60 px-3 py-2.5">
              <span className="text-[11.5px] text-muted-foreground">Browser notifications: {notifyPermission}</span>
              {notifyPermission !== 'granted' && (
                <button onClick={askPermission} className="ml-auto rounded-md border border-border bg-card px-2 py-1 text-[11px]">Allow in browser</button>
              )}
            </div>
            <p className="mt-2 text-[10.5px] text-muted-foreground">Email and SMS reminders need an email provider and are not connected yet.</p>
          </div>
        </div>

        {isAdmin && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-2 flex items-center gap-2">
              <Plug className="h-3.5 w-3.5 text-muted-foreground" />
              <h2 className="text-[13px] font-medium">Connections</h2>
            </div>
            <div className="divide-y divide-border/70">
              {INTEGRATIONS.map((i) => (
                <div key={i.name} className="py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px]">{i.name}</p>
                    <StatusBadge status={i.status} dot={false} />
                  </div>
                  <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted-foreground">{i.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-2 flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
              <h2 className="text-[13px] font-medium">Workspace</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[['Companies', counts.companies], ['Leads', counts.leads], ['Projects', counts.projects], ['Tasks', counts.tasks]].map(([l, v]) => (
                <div key={l} className="rounded-lg bg-muted/50 px-2.5 py-2">
                  <p className="text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground">{l}</p>
                  <p className="num text-[14px] font-medium">{v}</p>
                </div>
              ))}
            </div>
            <button onClick={exportCompanies} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-2 text-[11.5px] text-muted-foreground hover:text-foreground">
              <Download className="h-3 w-3" /> Export company list
            </button>
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">Currency INR · Timezone Asia/Kolkata · Records stay available after refresh.</p>
          </div>

          <div className="rounded-2xl border border-[#E7DCC8] bg-[#FBF7EF] p-4">
            <p className="text-[11.5px] font-medium">A note on secrets</p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
              Passwords and API keys do not belong in company notes, tasks or invoices. Keep them in a password manager until dedicated credentials storage is set up.
            </p>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}