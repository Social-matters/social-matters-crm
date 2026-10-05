'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Users2,
  PhoneCall,
  BarChart3,
  FileSpreadsheet,
  Link2,
  Settings,
  CalendarCheck,
  ShieldCheck,
  Megaphone,
} from 'lucide-react';
import { useAuth } from '../../context/auth-context';
import { cn } from '../../lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, isAgencyUser, activeClient } = useAuth();

  // Navigation items for Agency portal vs Client portal
  const agencyNavItems: NavItem[] = [
    { label: 'Agency Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'Clients', href: '/clients', icon: Building2 },
    { label: 'All Leads', href: '/leads', icon: Users2 },
    { label: 'Website Forms', href: '/forms', icon: FileSpreadsheet },
    { label: 'Campaign Analytics', href: '/campaigns', icon: BarChart3 },
    { label: 'Reports & Exports', href: '/reports', icon: FileSpreadsheet },
    { label: 'Integrations', href: '/integrations', icon: Link2 },
    { label: 'Agency Users', href: '/users', icon: ShieldCheck },
    { label: 'Settings', href: '/settings', icon: Settings },
  ];

  const clientNavItems: NavItem[] = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'Leads & Enquiries', href: '/leads', icon: Users2 },
    { label: 'Website Forms', href: '/forms', icon: FileSpreadsheet },
    { label: 'Follow-ups', href: '/follow-ups', icon: CalendarCheck },
    { label: 'Campaigns', href: '/campaigns', icon: Megaphone },
    { label: 'Reports', href: '/reports', icon: FileSpreadsheet },
    { label: 'Team Members', href: '/users', icon: Users2 },
    { label: 'Settings', href: '/settings', icon: Settings },
  ];

  const navItems = isAgencyUser ? agencyNavItems : clientNavItems;

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col shrink-0 min-h-screen">
      {/* Brand Logo & Portal Tag */}
      <div className="h-16 flex items-center px-6 border-b border-slate-100 gap-3">
        <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-lg shadow-sm">
          SM
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900 text-sm tracking-tight leading-none">
            Social Matters
          </span>
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mt-1">
            {isAgencyUser ? 'Agency Portal' : `${activeClient?.name || 'Client Portal'}`}
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-5 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
          Main Menu
        </div>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              )}
            >
              <Icon
                className={cn(
                  'w-4 h-4',
                  isActive ? 'text-slate-900' : 'text-slate-400',
                )}
              />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Bottom User / Workspace Card */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-semibold">
            {user?.name?.slice(0, 2).toUpperCase() || 'SM'}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-semibold text-slate-800 truncate">
              {user?.name || 'Loading...'}
            </span>
            <span className="text-[11px] text-slate-500 truncate">
              {user?.role?.replace(/_/g, ' ') || ''}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
