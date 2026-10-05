'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users2,
  Search,
  Filter,
  Download,
  Plus,
  Phone,
  MessageSquare,
  ArrowUpDown,
  ExternalLink,
  Copy,
  Check,
  Calendar,
  AlertCircle,
  Tag,
  Clock,
} from 'lucide-react';
import { DashboardShell } from '../../components/layout/dashboard-shell';
import { useAuth } from '../../context/auth-context';
import { ApiClient } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { PlatformType, LeadStatus } from '@sm-crm/shared';

interface Lead {
  id: string;
  rawFullName: string;
  rawPhone: string;
  rawEmail: string | null;
  sourcePlatform: PlatformType;
  externalLeadId: string | null;
  status: LeadStatus;
  isDuplicate: boolean;
  submittedAt: string;
  contact: {
    id: string;
    fullName: string;
    phone: string;
    email: string | null;
    city: string | null;
  };
  campaign?: {
    id: string;
    name: string;
    platform: string;
  } | null;
  assignedUser?: {
    id: string;
    name: string;
  } | null;
  followUps?: Array<{
    id: string;
    scheduledAt: string;
    status: string;
    reminderNote: string | null;
  }>;
  conversions?: Array<{
    id: string;
    value: number;
  }>;
  organization?: {
    id: string;
    name: string;
  };
}

export default function LeadsPage() {
  const { user, isAgencyUser, activeClient } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form state for Manual Lead Creation
  const [newLead, setNewLead] = useState({
    fullName: '',
    phone: '',
    email: '',
    city: '',
    sourcePlatform: PlatformType.MANUAL,
    campaignName: '',
    budget: '',
    interestedProduct: '',
    initialNote: '',
  });
  const [creating, setCreating] = useState(false);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (selectedStatus) params.append('status', selectedStatus);
      if (selectedPlatform) params.append('sourcePlatform', selectedPlatform);
      if (isAgencyUser && activeClient?.id) {
        params.append('organizationId', activeClient.id);
      }
      params.append('page', page.toString());
      params.append('limit', '20');

      const res = await ApiClient.get<Lead[]>(`/leads?${params.toString()}`);
      if (res.data) {
        setLeads(res.data);
        if (res.meta) {
          setTotalCount(res.meta.total);
        }
      }
    } catch (err) {
      console.error('Error fetching leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [search, selectedStatus, selectedPlatform, activeClient, page]);

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (selectedStatus) params.append('status', selectedStatus);
    if (selectedPlatform) params.append('sourcePlatform', selectedPlatform);
    if (isAgencyUser && activeClient?.id) {
      params.append('organizationId', activeClient.id);
    }

    const token = ApiClient.getToken();
    const url = `/api/v1/leads/export?${params.toString()}`;
    window.open(url, '_blank');
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const orgId = isAgencyUser ? activeClient?.id : user?.organizationId;
      if (!orgId) throw new Error('No organization selected');

      const fieldValues = [];
      if (newLead.budget) {
        fieldValues.push({
          fieldKey: 'budget',
          fieldLabel: 'Budget',
          fieldValue: newLead.budget,
        });
      }
      if (newLead.interestedProduct) {
        fieldValues.push({
          fieldKey: 'interested_product',
          fieldLabel: 'Interested Product',
          fieldValue: newLead.interestedProduct,
        });
      }

      await ApiClient.post('/leads/manual', {
        organizationId: orgId,
        fullName: newLead.fullName,
        phone: newLead.phone,
        email: newLead.email || undefined,
        city: newLead.city || undefined,
        sourcePlatform: newLead.sourcePlatform,
        campaignName: newLead.campaignName || undefined,
        fieldValues,
        initialNote: newLead.initialNote || undefined,
      });

      setIsCreateModalOpen(false);
      setNewLead({
        fullName: '',
        phone: '',
        email: '',
        city: '',
        sourcePlatform: PlatformType.MANUAL,
        campaignName: '',
        budget: '',
        interestedProduct: '',
        initialNote: '',
      });
      fetchLeads();
    } catch (err: any) {
      alert(err.message || 'Failed to create lead');
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (status: LeadStatus) => {
    switch (status) {
      case LeadStatus.NEW:
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case LeadStatus.CONTACTED:
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case LeadStatus.INTERESTED:
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case LeadStatus.FOLLOW_UP:
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case LeadStatus.CONVERTED:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case LeadStatus.LOST:
        return 'bg-slate-100 text-slate-600 border-slate-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getPlatformBadge = (platform: PlatformType) => {
    switch (platform) {
      case PlatformType.META:
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case PlatformType.GOOGLE:
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case PlatformType.LINKEDIN:
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case PlatformType.WHATSAPP:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case PlatformType.WEBSITE:
        return 'bg-teal-50 text-teal-700 border-teal-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Leads & Enquiries
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Centralized lead feed across Meta, Google Ads, LinkedIn, Website, and WhatsApp.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Lead Manually</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by name, phone, email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-md pl-9 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="">All Statuses</option>
              <option value={LeadStatus.NEW}>New</option>
              <option value={LeadStatus.CONTACTED}>Contacted</option>
              <option value={LeadStatus.INTERESTED}>Interested</option>
              <option value={LeadStatus.FOLLOW_UP}>Follow-up</option>
              <option value={LeadStatus.CONVERTED}>Converted</option>
              <option value={LeadStatus.LOST}>Lost</option>
            </select>

            {/* Platform Filter */}
            <select
              value={selectedPlatform}
              onChange={(e) => {
                setSelectedPlatform(e.target.value);
                setPage(1);
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="">All Platforms</option>
              <option value={PlatformType.META}>Meta (FB / IG)</option>
              <option value={PlatformType.GOOGLE}>Google Ads</option>
              <option value={PlatformType.LINKEDIN}>LinkedIn</option>
              <option value={PlatformType.WHATSAPP}>WhatsApp</option>
              <option value={PlatformType.WEBSITE}>Website Forms</option>
              <option value={PlatformType.MANUAL}>Manual Entry</option>
            </select>
          </div>
        </div>

        {/* Leads Data Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Source / Campaign</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Next Follow-Up</th>
                  <th className="py-3 px-4">Assigned To</th>
                  <th className="py-3 px-4">Submitted</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin mx-auto mb-2" />
                      Loading leads...
                    </td>
                  </tr>
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No leads matching the selected criteria.
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => {
                    const phoneClean = (lead.contact?.phone || lead.rawPhone).replace(/[^\d]/g, '');
                    const waUrl = `https://wa.me/${phoneClean}`;
                    const telUrl = `tel:${lead.contact?.phone || lead.rawPhone}`;

                    return (
                      <tr key={lead.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Contact details */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/leads/${lead.id}`}
                              className="font-semibold text-slate-900 hover:underline"
                            >
                              {lead.contact?.fullName || lead.rawFullName}
                            </Link>
                            {lead.isDuplicate && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                                REPEAT
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                            <span>{lead.contact?.phone || lead.rawPhone}</span>
                            {lead.contact?.city && (
                              <>
                                <span>•</span>
                                <span>{lead.contact.city}</span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Source & Campaign */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded border ${getPlatformBadge(
                              lead.sourcePlatform,
                            )}`}
                          >
                            {lead.sourcePlatform}
                          </span>
                          <div className="text-[11px] font-medium text-slate-700 truncate max-w-[180px] mt-0.5">
                            {lead.campaign?.name || 'Direct Ingestion'}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full border ${getStatusBadge(
                              lead.status,
                            )}`}
                          >
                            {lead.status.replace(/_/g, ' ')}
                          </span>
                        </td>

                        {/* Next Follow-up */}
                        <td className="py-3.5 px-4 text-slate-600">
                          {lead.followUps && lead.followUps.length > 0 ? (
                            <div className="flex items-center gap-1.5 text-indigo-700 font-medium">
                              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                              <span>{formatDate(lead.followUps[0].scheduledAt)}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Assigned user */}
                        <td className="py-3.5 px-4 text-slate-600">
                          {lead.assignedUser ? (
                            <span className="font-medium text-slate-800">
                              {lead.assignedUser.name}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Unassigned</span>
                          )}
                        </td>

                        {/* Submitted At */}
                        <td className="py-3.5 px-4 text-slate-500">
                          {formatDate(lead.submittedAt)}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <a
                              href={telUrl}
                              className="p-1.5 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                              title="Click to Call"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                              title="Open in WhatsApp"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                            <Link
                              href={`/leads/${lead.id}`}
                              className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                            >
                              View
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination summary */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
            <span>Total Leads: {totalCount}</span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded shadow-sm disabled:opacity-40"
              >
                Previous
              </button>
              <span>Page {page}</span>
              <button
                disabled={leads.length < 20}
                onClick={() => setPage((p) => p + 1)}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded shadow-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Lead Creation Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Create Lead Manually</h2>
            <p className="text-xs text-slate-500 mb-4">
              Enter customer details and dynamic fields. An enquiry will be created in this workspace.
            </p>

            <form onSubmit={handleCreateLead} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newLead.fullName}
                  onChange={(e) => setNewLead({ ...newLead, fullName: e.target.value })}
                  placeholder="Rahul Sharma"
                  className="w-full text-xs border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone *
                  </label>
                  <input
                    type="text"
                    required
                    value={newLead.phone}
                    onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                    placeholder="+919876543210"
                    className="w-full text-xs border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={newLead.city}
                    onChange={(e) => setNewLead({ ...newLead, city: e.target.value })}
                    placeholder="Hyderabad"
                    className="w-full text-xs border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newLead.email}
                  onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                  placeholder="rahul@example.com"
                  className="w-full text-xs border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Platform Source
                  </label>
                  <select
                    value={newLead.sourcePlatform}
                    onChange={(e) =>
                      setNewLead({ ...newLead, sourcePlatform: e.target.value as PlatformType })
                    }
                    className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white"
                  >
                    <option value={PlatformType.MANUAL}>Manual Entry</option>
                    <option value={PlatformType.META}>Meta (FB / IG)</option>
                    <option value={PlatformType.GOOGLE}>Google Ads</option>
                    <option value={PlatformType.WHATSAPP}>WhatsApp</option>
                    <option value={PlatformType.WEBSITE}>Website Form</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Campaign Name
                  </label>
                  <input
                    type="text"
                    value={newLead.campaignName}
                    onChange={(e) => setNewLead({ ...newLead, campaignName: e.target.value })}
                    placeholder="Diwali Expo 2026"
                    className="w-full text-xs border border-slate-300 rounded px-3 py-2"
                  />
                </div>
              </div>

              {/* Dynamic Field Samples */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Dynamic Lead Form Fields
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      Estimated Budget
                    </label>
                    <input
                      type="text"
                      value={newLead.budget}
                      onChange={(e) => setNewLead({ ...newLead, budget: e.target.value })}
                      placeholder="₹1,50,000"
                      className="w-full text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      Interested Product
                    </label>
                    <input
                      type="text"
                      value={newLead.interestedProduct}
                      onChange={(e) =>
                        setNewLead({ ...newLead, interestedProduct: e.target.value })
                      }
                      placeholder="Solitaire Bridal Choker"
                      className="w-full text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Initial Note
                </label>
                <textarea
                  rows={2}
                  value={newLead.initialNote}
                  onChange={(e) => setNewLead({ ...newLead, initialNote: e.target.value })}
                  placeholder="Notes from initial call or enquiry..."
                  className="w-full text-xs border border-slate-300 rounded px-3 py-2"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded shadow-sm disabled:opacity-50"
                >
                  {creating ? 'Saving...' : 'Create Enquiry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
