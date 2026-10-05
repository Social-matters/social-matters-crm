'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Target,
  TrendingUp,
  DollarSign,
  Building2,
  CalendarCheck,
  CheckCircle,
  AlertCircle,
  ArrowUpRight,
  Filter,
  ArrowRight,
  Phone,
  MessageSquare,
} from 'lucide-react';
import { DashboardShell } from '../components/layout/dashboard-shell';
import { useAuth, ClientWorkspace } from '../context/auth-context';
import { ApiClient } from '../lib/api';
import { formatCurrency, formatDate } from '../lib/utils';
import { LeadStatus } from '@sm-crm/shared';

interface ClientOrgSummary {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  _count: {
    leads: number;
    users: number;
    campaigns: number;
    integrations: number;
  };
}

export default function DashboardPage() {
  const { user, isAgencyUser, activeClient, setActiveClient } = useAuth();
  const [clients, setClients] = useState<ClientOrgSummary[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      try {
        if (isAgencyUser) {
          const res = await ApiClient.get<ClientOrgSummary[]>('/organizations');
          if (res.data) setClients(res.data);
        }

        // Fetch recent leads for the active workspace
        const leadsRes = await ApiClient.get('/leads?limit=6');
        if (leadsRes.data) {
          setLeads(leadsRes.data);
        }

        // Fetch pending follow-ups
        const followUpsRes = await ApiClient.get('/leads/follow-ups?status=PENDING');
        if (followUpsRes.data) {
          setFollowUps(followUpsRes.data);
        }
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [isAgencyUser, activeClient]);

  // Compute funnel stage counts
  const stageCounts = {
    [LeadStatus.NEW]: leads.filter((l) => l.status === LeadStatus.NEW).length,
    [LeadStatus.CONTACTED]: leads.filter((l) => l.status === LeadStatus.CONTACTED).length,
    [LeadStatus.INTERESTED]: leads.filter((l) => l.status === LeadStatus.INTERESTED).length,
    [LeadStatus.FOLLOW_UP]: leads.filter((l) => l.status === LeadStatus.FOLLOW_UP).length,
    [LeadStatus.CONVERTED]: leads.filter((l) => l.status === LeadStatus.CONVERTED).length,
    [LeadStatus.LOST]: leads.filter((l) => l.status === LeadStatus.LOST).length,
  };

  const totalRevenue = leads.reduce((acc, lead) => {
    const leadRev = lead.conversions?.reduce((cAcc: number, c: any) => cAcc + Number(c.value), 0) || 0;
    return acc + leadRev;
  }, 0);

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {isAgencyUser
                ? 'Agency Performance Overview'
                : `${activeClient?.name || 'Client'} Workspace`}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {isAgencyUser
                ? 'Consolidated lead volume, client workspaces, and advertising integration status.'
                : 'Manage your incoming leads, scheduled follow-ups, and sales conversions.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Tenant Status:</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Active & Isolated
            </span>
          </div>
        </div>

        {/* Agency vs Client KPI Cards */}
        {isAgencyUser ? (
          <>
            {/* Agency KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Total Active Clients
                  </span>
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                    <Building2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">{clients.length}</span>
                  <span className="text-xs text-emerald-600 font-medium">100% operational</span>
                </div>
              </div>

              <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Total Ingested Leads
                  </span>
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {clients.reduce((acc, c) => acc + (c._count?.leads || 0), 0)}
                  </span>
                  <span className="text-xs text-slate-500">Across all sources</span>
                </div>
              </div>

              <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Active Campaigns
                  </span>
                  <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                    <Target className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {clients.reduce((acc, c) => acc + (c._count?.campaigns || 0), 0)}
                  </span>
                  <span className="text-xs text-slate-500">Meta & Google</span>
                </div>
              </div>

              <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Total CRM Conversions
                  </span>
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {formatCurrency(totalRevenue)}
                  </span>
                  <span className="text-xs text-emerald-600 font-medium">Recorded Value</span>
                </div>
              </div>
            </div>

            {/* Clients Workspaces Directory */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Client Workspaces & Activity
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Click any client to inspect tenant-isolated leads, integrations, and users.
                  </p>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {clients.map((client) => (
                  <div
                    key={client.id}
                    className="p-5 flex items-center justify-between hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center font-bold text-sm">
                        {client.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">{client.name}</span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            /{client.slug}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-4">
                          <span>{client._count.leads} Leads</span>
                          <span>•</span>
                          <span>{client._count.campaigns} Campaigns</span>
                          <span>•</span>
                          <span>{client._count.users} Client Users</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setActiveClient({
                          id: client.id,
                          name: client.name,
                          slug: client.slug,
                        });
                      }}
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-md shadow-sm transition-colors"
                    >
                      <span>Switch to Workspace</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Client Funnel Overview */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {[
                { label: 'New', count: stageCounts[LeadStatus.NEW], color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Contacted', count: stageCounts[LeadStatus.CONTACTED], color: 'text-amber-600', bg: 'bg-amber-50' },
                { label: 'Interested', count: stageCounts[LeadStatus.INTERESTED], color: 'text-purple-600', bg: 'bg-purple-50' },
                { label: 'Follow-up', count: stageCounts[LeadStatus.FOLLOW_UP], color: 'text-indigo-600', bg: 'bg-indigo-50' },
                { label: 'Converted', count: stageCounts[LeadStatus.CONVERTED], color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Lost', count: stageCounts[LeadStatus.LOST], color: 'text-slate-500', bg: 'bg-slate-100' },
              ].map((funnel) => (
                <div key={funnel.label} className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-xs font-medium text-slate-500">{funnel.label}</span>
                  <div className="mt-2 text-2xl font-bold text-slate-900">{funnel.count}</div>
                  <span className={`inline-block mt-1 text-[11px] font-semibold px-1.5 py-0.5 rounded ${funnel.bg} ${funnel.color}`}>
                    Active Funnel
                  </span>
                </div>
              ))}
            </div>

            {/* Quick Actions & Recent Lead Container */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Recent Lead Enquiries</h3>
                    <p className="text-xs text-slate-500">Incoming enquiries from Meta, Google, & Website Forms.</p>
                  </div>
                  <Link
                    href="/leads"
                    className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <span>View All Leads</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {leads.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    No enquiries recorded yet for this client workspace.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {leads.map((lead) => (
                      <div key={lead.id} className="py-3 flex items-center justify-between text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <Link href={`/leads/${lead.id}`} className="font-semibold text-slate-900 hover:underline">
                              {lead.contact?.fullName || lead.rawFullName}
                            </Link>
                            {lead.isDuplicate && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                                REPEAT
                              </span>
                            )}
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                              {lead.status}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            {lead.sourcePlatform} • {formatDate(lead.submittedAt)}
                          </span>
                        </div>
                        <Link
                          href={`/leads/${lead.id}`}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded"
                        >
                          Details →
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Follow-ups widget */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <h3 className="text-sm font-bold text-slate-900">Pending Follow-ups</h3>
                  <Link href="/follow-ups" className="text-xs font-semibold text-blue-600 hover:underline">
                    View All
                  </Link>
                </div>

                {followUps.length === 0 ? (
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 text-center text-xs text-slate-500">
                    <CalendarCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    All caught up! No pending follow-ups.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {followUps.slice(0, 3).map((fu) => (
                      <div key={fu.id} className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                        <div className="flex items-center justify-between font-semibold text-slate-800">
                          <span>{fu.lead?.contact?.fullName || fu.lead?.rawFullName}</span>
                          <span className="text-[11px] text-indigo-600">{formatDate(fu.scheduledAt)}</span>
                        </div>
                        <p className="mt-1 text-slate-600 text-[11px]">{fu.reminderNote || 'Follow up required'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
