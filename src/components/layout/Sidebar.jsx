import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Sun, Building2, Users, FolderKanban, CheckSquare,
  Search, Megaphone, CalendarDays, Wallet, FileText, Settings, X, LogOut, Sparkles,
  ShieldCheck, Target,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import WebofolioBrand from '@/components/branding/WebofolioBrand';
import ProfileAvatar from '@/components/shared/ProfileAvatar';

const groups = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/my-day', label: 'My Day', icon: Sun },
    ],
  },
  {
    label: 'Client work',
    items: [
      { to: '/companies', label: 'Companies', icon: Building2 },
      { to: '/leads', label: 'Leads', icon: Users },
      { to: '/projects', label: 'Projects', icon: FolderKanban },
      { to: '/tasks', label: 'Tasks', icon: CheckSquare },
    ],
  },
  {
    label: 'Growth',
    items: [
      { to: '/seo', label: 'SEO', icon: Search },
      { to: '/social', label: 'Social Media', icon: Megaphone },
      { to: '/calendar', label: 'Calendar', icon: CalendarDays },
    ],
  },
  {
    label: 'Business',
    items: [
      { to: '/payments', label: 'Payments', icon: Wallet },
      { to: '/bills', label: 'Bills & Reports', icon: FileText },
      { to: '/goals', label: 'Goals', icon: Target },
    ],
  },
  {
    label: 'Administration',
    items: [{ to: '/team', label: 'Team & approvals', icon: ShieldCheck }],
  },
];

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [closing, setClosing] = useState(false);

  const signOut = async () => {
    setClosing(true);
    try {
      await logout();
    } catch (error) {
      toast({
        title: 'Could not sign out',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
      setClosing(false);
    }
  };

  return (
    <>
      {open && (
        <div className="no-print fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          'no-print fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:translate-x-0',
          'border-r border-sidebar-border',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-5 pb-5 pt-6">
          <button onClick={() => navigate('/')} className="group text-left">
            <WebofolioBrand subtitle="Agency workspace" markClassName="h-10 w-10" />
          </button>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-sidebar-accent lg:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="scroll-thin flex-1 overflow-y-auto px-3 pb-4">
          {(user?.role === 'admin' ? groups : groups.filter((group) => ['Overview', 'Client work'].includes(group.label))).map((group) => (
            <div key={group.label} className="mb-5">
              <p className="px-3 pb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.filter((item) => user?.role === 'admin' || ['/','/projects','/tasks'].includes(item.to)).map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors',
                        isActive
                          ? 'bg-card font-medium text-foreground shadow-[0_1px_2px_rgba(16,32,28,0.06)]'
                          : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className={cn('h-[16px] w-[16px]', isActive ? 'text-primary' : 'text-muted-foreground/80')} strokeWidth={1.8} />
                        <span className="flex-1">{label}</span>
                        {isActive && <span className="h-1.5 w-1.5 rounded-full bg-[#C98B54]" />}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border px-3 py-3">
          <NavLink
            to="/settings"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'mb-2 flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors',
                isActive ? 'bg-card font-medium text-foreground' : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground',
              )
            }
          >
            <Settings className="h-[16px] w-[16px]" strokeWidth={1.8} />
            {user?.role === 'admin' ? 'Settings & profile' : 'My profile'}
          </NavLink>
          <div className="flex items-center gap-2.5 rounded-xl bg-card/70 px-3 py-2.5">
            <ProfileAvatar src={user?.avatar_url} name={user?.full_name || user?.name || user?.email} className="h-8 w-8" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium">{user?.full_name || user?.name || user?.email || 'Your workspace'}</p>
              <p className="flex items-center gap-1 truncate text-[10px] text-muted-foreground">
                <Sparkles className="h-2.5 w-2.5" /> {user?.role === 'admin' ? 'Admin' : 'Team'}
              </p>
            </div>
            <button onClick={signOut} disabled={closing} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Sign out">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}