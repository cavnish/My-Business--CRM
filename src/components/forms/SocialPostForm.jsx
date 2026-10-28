import React, { useEffect, useState } from 'react';
import { neon } from '@/api/neonDataClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, SelectInput } from '@/components/shared/Field';
import { useToast } from '@/components/ui/use-toast';
import { PLATFORMS, POST_STATUS, POST_TYPES } from '@/lib/constants';

const blank = {
  company_id: '', platform: 'Instagram', title: '', campaign: '', post_type: 'Image',
  caption: '', hashtags: '', scheduled_date: '', status: 'Idea', published_url: '', media_url: '', notes: '',
};

export default function SocialPostForm({ open, onOpenChange, companies = [], companyId, post, onSaved }) {
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) setForm(post ? { ...blank, ...post } : { ...blank, company_id: companyId || companies[0]?.id || '' });
  }, [open, post, companyId]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title.trim() || !form.company_id) return;
    setSaving(true);
    try {
      const payload = { ...form, scheduled_date: form.scheduled_date || null };
      if (post) await neon.entities.SocialPost.update(post.id, payload);
      else await neon.entities.SocialPost.create(payload);
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast({ title: 'Could not save post', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal">{post ? 'Edit content' : 'Plan a post'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Company"><SelectInput value={form.company_id} onChange={(v) => set('company_id', v)} options={companies.map((c) => ({ value: c.id, label: c.name }))} allowEmpty={false} /></Field>
          <Field label="Platform"><SelectInput value={form.platform} onChange={(v) => set('platform', v)} options={PLATFORMS} allowEmpty={false} /></Field>
          <Field label="Title" className="sm:col-span-2"><Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Working title for this post" /></Field>
          <Field label="Campaign"><Input value={form.campaign} onChange={(e) => set('campaign', e.target.value)} /></Field>
          <Field label="Post type"><SelectInput value={form.post_type} onChange={(v) => set('post_type', v)} options={POST_TYPES} allowEmpty={false} /></Field>
          <Field label="Caption" className="sm:col-span-2"><Textarea rows={4} value={form.caption} onChange={(e) => set('caption', e.target.value)} /></Field>
          <Field label="Hashtags"><Input value={form.hashtags} onChange={(e) => set('hashtags', e.target.value)} placeholder="#brand #campaign" /></Field>
          <Field label="Scheduled date"><Input type="date" value={form.scheduled_date || ''} onChange={(e) => set('scheduled_date', e.target.value)} /></Field>
          <Field label="Status"><SelectInput value={form.status} onChange={(v) => set('status', v)} options={POST_STATUS} allowEmpty={false} /></Field>
          <Field label="Media URL" hint="A link to the image or video for this post."><Input value={form.media_url} onChange={(e) => set('media_url', e.target.value)} /></Field>
          <Field label="Published URL" className="sm:col-span-2"><Input value={form.published_url} onChange={(e) => set('published_url', e.target.value)} placeholder="Add only after the platform confirms the post" /></Field>
          <Field label="Internal notes" className="sm:col-span-2"><Textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.title.trim() || !form.company_id}>{saving ? 'Saving…' : post ? 'Save changes' : 'Add to calendar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}