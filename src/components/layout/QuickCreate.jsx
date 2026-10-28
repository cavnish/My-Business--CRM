import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Users, CheckSquare, FolderKanban, Wallet, Megaphone, Building2 } from 'lucide-react';

const items = [
  { label: 'New lead', to: '/leads?new=1', icon: Users },
  { label: 'New task', to: '/tasks?new=1', icon: CheckSquare },
  { label: 'New project', to: '/projects?new=1', icon: FolderKanban },
  { label: 'New payment', to: '/payments?new=1', icon: Wallet },
  { label: 'New social post', to: '/social?new=1', icon: Megaphone },
  { label: 'New company', to: '/companies?new=1', icon: Building2 },
];

export default function QuickCreate({ children }) {
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Create</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map(({ label, to, icon: Icon }) => (
          <DropdownMenuItem key={to} onClick={() => navigate(to)} className="gap-2 text-[13px]">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}