import React from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, Plus, ChevronRight } from 'lucide-react';
import GlobalSearch from '@/components/layout/GlobalSearch';
import QuickCreate from '@/components/layout/QuickCreate';
import WebofolioBrand from '@/components/branding/WebofolioBrand';
import { useAuth } from '@/lib/AuthContext';

const titles = [
  ['/my-day', 'My Day'],
  ['/companies', 'Companies'],
  ['/leads', 'Leads'],
  ['/projects', 'Projects'],
  ['/tasks', 'Tasks'],
  ['/seo', 'SEO'],
  ['/social', 'Social Media'],
  ['/calendar', 'Calendar'],
  ['/payments', 'Payments'],
  ['/bills', 'Bills & Reports'],
  ['/settings', 'Settings'],
  ['/team', 'Team & approvals'],
  ['/goals', 'Goals'],
];

export default function Topbar({ onMenu }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const match = titles.find(([path]) => pathname.startsWith(path));
  const title = match ? match[1] : 'Dashboard';

  return (
    <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/80 bg-background/85 px-4 backdrop-blur-md sm:px-6 lg:px-10">
      <button onClick={onMenu} className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden">
        <Menu className="h-4 w-4" />
      </button>
      <WebofolioBrand className="hidden sm:flex" markClassName="h-7 w-7" />
      <span className="hidden h-5 w-px bg-border sm:block" />
      <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
        <span className="hidden text-muted-foreground sm:inline">Workspace</span>
        <ChevronRight className="hidden h-3 w-3 text-muted-foreground/60 sm:inline" />
        <span className="truncate font-medium">{title}</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {user?.role === 'admin' && <GlobalSearch />}
        {user?.role === 'admin' && <QuickCreate>
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12.5px] font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90">
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Quick create</span>
          </button>
        </QuickCreate>}
      </div>
    </header>
  );
}