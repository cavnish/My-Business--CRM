import React, { useCallback, useEffect, useState } from 'react';
import { Camera, Check, Pencil, ShieldCheck, UserRound, X } from 'lucide-react';
import { neon } from '@/api/neonDataClient';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import StatusBadge from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/shared/Field';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { profileImageDataUrl } from '@/lib/profileImage';
import ProfileAvatar from '@/components/shared/ProfileAvatar';

export default function Team() {
  const [members, setMembers] = useState([]);
  const [reviewTasks, setReviewTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [editingMember, setEditingMember] = useState(null);
  const [profileForm, setProfileForm] = useState({ full_name: '', job_title: '', phone: '', avatar_url: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const load = useCallback(async () => {
    try {
      const [memberResult, taskResult, profileResult] = await Promise.all([
        neon.entities.WorkspaceMember.filter({}, { sort: 'created_date', limit: 300 }),
        neon.entities.Task.filter({ status: 'Awaiting Approval' }, { sort: '-completion_requested_at', limit: 200 }),
        neon.entities.User.list({ limit: 300 }),
      ]);
      const profilesById = new Map((profileResult.items || []).map((profile) => [profile.id, profile]));
      setMembers((memberResult.items || []).map((member) => {
        const profile = profilesById.get(member.user_id);
        return profile ? {
          ...member,
          ...profile,
          user_id: member.user_id,
          full_name: profile.full_name || member.full_name,
          role: member.role,
          approval_status: member.approval_status,
          workspace_owner_id: member.workspace_owner_id,
        } : member;
      }));
      setReviewTasks(taskResult.items || []);
    } catch (error) {
      toast({ title: 'Could not load team workspace', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const updateAccess = async (member, role, approvalStatus) => {
    setSavingId(member.user_id);
    try {
      await neon.workspace.setMemberAccess({ userId: member.user_id, role, approvalStatus });
      await load();
      toast({ title: 'Team access updated' });
    } catch (error) {
      toast({ title: 'Could not update team access', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSavingId('');
    }
  };

  const review = async (task, approved) => {
    setSavingId(task.id);
    try {
      const updated = await neon.workspace.reviewTaskCompletion({
        taskId: task.id,
        approved,
        note: approved ? '' : 'Please review the task and submit it again.',
      });
      setReviewTasks((items) => items.filter((item) => item.id !== updated.id));
      toast({ title: approved ? 'Task approved and completed' : 'Task returned to the team member' });
    } catch (error) {
      toast({ title: 'Could not review task', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSavingId('');
    }
  };

  const editProfile = async (member) => {
    try {
      const result = await neon.entities.User.filter({ id: member.user_id }, { limit: 1 });
      const profile = result.items[0] || {};
      setProfileForm({
        full_name: profile.full_name || member.full_name || '',
        job_title: profile.job_title || '',
        phone: profile.phone || '',
        avatar_url: profile.avatar_url || '',
      });
      setEditingMember(member);
    } catch (error) {
      toast({ title: 'Could not load member profile', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  const saveMemberProfile = async () => {
    if (!editingMember) return;
    setSavingProfile(true);
    try {
      await neon.auth.updateWorkspaceMemberProfile({
        userId: editingMember.user_id,
        workspaceOwnerId: editingMember.workspace_owner_id || user?.workspace_owner_id,
        changes: profileForm,
      });
      setMembers((current) => current.map((member) => member.user_id === editingMember.user_id
        ? { ...member, ...profileForm }
        : member));
      setEditingMember(null);
      toast({ title: 'Member profile updated' });
    } catch (error) {
      toast({ title: 'Could not update member profile', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSavingProfile(false);
    }
  };

  const changeMemberPhoto = async (event) => {
    const [file] = event.target.files || [];
    event.target.value = '';
    if (!file) return;
    try {
      const avatar_url = await profileImageDataUrl(file);
      setProfileForm((current) => ({ ...current, avatar_url }));
    } catch (error) {
      toast({ title: 'Could not use that picture', description: error?.message || 'Choose a different image.', variant: 'destructive' });
    }
  };

  const pending = members.filter((member) => member.approval_status === 'pending');
  const approvedMembers = members.filter((member) => member.approval_status === 'approved');

  return (
    <div className="fade-up space-y-8">
      <PageHeader
        eyebrow="Workspace access"
        title="Team"
        description="Approve new accounts, assign roles, and review submitted task completions."
        actions={null}
      />

      <section>
        <h2 className="mb-3 font-display text-xl">Waiting for approval <span className="text-sm text-muted-foreground">({pending.length})</span></h2>
        {loading ? <div className="h-24 animate-pulse rounded-2xl border border-border bg-card/60" /> : pending.length === 0 ? (
          <EmptyState icon={UserRound} title="No pending accounts" description="Newly registered team members will appear here." action={null} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {pending.map((member) => (
              <article key={member.user_id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <ProfileAvatar src={member.avatar_url} name={member.full_name || member.email} className="h-9 w-9" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{member.full_name || member.email}</p>
                      <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-800">Pending</span>
                </div>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => editProfile(member)}><Pencil /> Edit profile</Button>
                <label className="mt-4 block text-xs text-muted-foreground" htmlFor={`role-${member.user_id}`}>Role</label>
                <select
                  id={`role-${member.user_id}`}
                  value={member.role}
                  onChange={(event) => updateAccess(member, event.target.value, member.approval_status)}
                  disabled={savingId === member.user_id}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="team_member">Team member</option>
                  <option value="admin">Administrator</option>
                </select>
                <div className="mt-3 flex justify-end gap-2">
                  <Button size="sm" variant="outline" disabled={savingId === member.user_id} onClick={() => updateAccess(member, member.role, 'rejected')}>
                    <X /> Reject
                  </Button>
                  <Button size="sm" disabled={savingId === member.user_id} onClick={() => updateAccess(member, member.role, 'approved')}>
                    <Check /> Approve
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl">Approved members <span className="text-sm text-muted-foreground">({approvedMembers.length})</span></h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {approvedMembers.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No approved team members yet.</p> : approvedMembers.map((member) => (
            <div key={member.user_id} className="flex flex-wrap items-center gap-3 border-b border-border/70 px-4 py-3 last:border-0">
              <ProfileAvatar src={member.avatar_url} name={member.full_name || member.email} className="h-9 w-9" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{member.full_name || member.email}</p>
                <p className="truncate text-xs text-muted-foreground">{member.email}</p>
              </div>
              <Button size="sm" variant="outline" disabled={savingId === member.user_id} onClick={() => editProfile(member)}><Pencil /> Edit profile</Button>
              <StatusBadge status={member.role === 'admin' ? 'Admin' : 'Team member'} />
              <select
                aria-label={`Role for ${member.email}`}
                value={member.role}
                onChange={(event) => updateAccess(member, event.target.value, 'approved')}
                disabled={savingId === member.user_id}
                className="h-9 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="team_member">Team member</option>
                <option value="admin">Administrator</option>
              </select>
              <Button size="sm" variant="outline" disabled={savingId === member.user_id} onClick={() => updateAccess(member, member.role, 'rejected')}>Remove access</Button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="font-display text-xl">Task completion review <span className="text-sm text-muted-foreground">({reviewTasks.length})</span></h2>
        </div>
        {reviewTasks.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Nothing to review" description="Team members' completion requests will appear here." action={null} />
        ) : (
          <div className="space-y-2">
            {reviewTasks.map((task) => (
              <article key={task.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{task.title}</p>
                  {task.notes && <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{task.notes}</p>}
                  <p className="mt-1 text-[11px] text-muted-foreground">Submitted {task.completion_requested_at ? new Date(task.completion_requested_at).toLocaleString() : 'for review'}</p>
                </div>
                <Button size="sm" variant="outline" disabled={savingId === task.id} onClick={() => review(task, false)}>Return</Button>
                <Button size="sm" disabled={savingId === task.id} onClick={() => review(task, true)}><Check /> Approve completion</Button>
              </article>
            ))}
          </div>
        )}
      </section>

      <Dialog open={Boolean(editingMember)} onOpenChange={(open) => { if (!open && !savingProfile) setEditingMember(null); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[480px]">
          <DialogHeader><DialogTitle>Edit team member profile</DialogTitle></DialogHeader>
          <div className="flex items-center gap-3">
            <ProfileAvatar src={profileForm.avatar_url} name={profileForm.full_name || editingMember?.email} className="h-14 w-14" />
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted">
              <Camera className="h-3.5 w-3.5" /> Change picture
              <input type="file" accept="image/*" className="sr-only" onChange={changeMemberPhoto} />
            </label>
            {profileForm.avatar_url && <button type="button" onClick={() => setProfileForm((current) => ({ ...current, avatar_url: '' }))} className="text-xs text-muted-foreground hover:text-foreground">Remove</button>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name"><Input value={profileForm.full_name} onChange={(event) => setProfileForm((current) => ({ ...current, full_name: event.target.value }))} /></Field>
            <Field label="Job title"><Input value={profileForm.job_title} onChange={(event) => setProfileForm((current) => ({ ...current, job_title: event.target.value }))} /></Field>
            <Field label="Phone"><Input type="tel" value={profileForm.phone} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} /></Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingMember(null)} disabled={savingProfile}>Cancel</Button>
            <Button onClick={saveMemberProfile} disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save profile'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
