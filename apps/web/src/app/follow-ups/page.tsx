'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CalendarCheck,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Phone,
  MessageSquare,
} from 'lucide-react';
import { DashboardShell } from '../../components/layout/dashboard-shell';
import { useAuth } from '../../context/auth-context';
import { ApiClient } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { FollowUpStatus } from '@sm-crm/shared';

interface FollowUpItem {
  id: string;
  leadId: string;
  scheduledAt: string;
  reminderNote: string | null;
  status: FollowUpStatus;
  completedAt: string | null;
  lead: {
    id: string;
    rawFullName: string;
    rawPhone: string;
    status: string;
    organization: {
      name: string;
    };
    contact?: {
      fullName: string;
      phone: string;
    };
  };
  createdBy: {
    name: string;
  };
}

export default function FollowUpsPage() {
  const { user, isAgencyUser } = useAuth();
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'PENDING' | 'COMPLETED' | 'ALL'>('PENDING');

  const fetchFollowUps = async () => {
    setLoading(true);
    try {
      const query = activeTab === 'ALL' ? '' : `?status=${activeTab}`;
      const res = await ApiClient.get<FollowUpItem[]>(`/leads/follow-ups${query}`);
      if (res.data) {
        setFollowUps(res.data);
      }
    } catch (err) {
      console.error('Error fetching follow-ups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowUps();
  }, [activeTab]);

  const handleMarkComplete = async (id: string) => {
    try {
      await ApiClient.patch(`/leads/follow-ups/${id}/status`, {
        status: FollowUpStatus.COMPLETED,
      });
      fetchFollowUps();
    } catch (err: any) {
      alert(err.message || 'Failed to update follow-up');
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Follow-up Reminders
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Track scheduled customer calls, in-store appointments, and reminder notifications.
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setActiveTab('PENDING')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'PENDING'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pending & Due
            </button>
            <button
              onClick={() => setActiveTab('COMPLETED')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'COMPLETED'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Completed
            </button>
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'ALL'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Records
            </button>
          </div>
        </div>

        {/* Follow-up Cards Grid */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto mb-2" />
            <span className="text-xs text-slate-500">Loading follow-ups...</span>
          </div>
        ) : followUps.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <CalendarCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-800">No Reminders Found</h3>
            <p className="text-xs text-slate-500 mt-1">
              There are no follow-ups matching this filter. Schedule one from any lead details page.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {followUps.map((item) => {
              const isOverdue =
                item.status === FollowUpStatus.PENDING &&
                new Date(item.scheduledAt) < new Date();
              const contactName = item.lead.contact?.fullName || item.lead.rawFullName;
              const contactPhone = item.lead.contact?.phone || item.lead.rawPhone;
              const phoneClean = contactPhone.replace(/[^\d]/g, '');

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-xl border p-5 shadow-sm transition-all ${
                    isOverdue
                      ? 'border-red-200 ring-1 ring-red-100'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/leads/${item.leadId}`}
                          className="font-bold text-sm text-slate-900 hover:underline"
                        >
                          {contactName}
                        </Link>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                          {item.lead.status}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 block mt-0.5">
                        {item.lead.organization?.name}
                      </span>
                    </div>

                    {item.status === FollowUpStatus.PENDING ? (
                      <button
                        onClick={() => handleMarkComplete(item.id)}
                        className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mark Done</span>
                      </button>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Completed
                      </span>
                    )}
                  </div>

                  <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                    <div className="flex items-center justify-between text-slate-600 mb-1">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {formatDate(item.scheduledAt)}
                      </span>
                      {isOverdue && (
                        <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                          OVERDUE
                        </span>
                      )}
                    </div>
                    <p className="text-slate-700 text-xs mt-1">
                      {item.reminderNote || 'Routine follow-up call with customer.'}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${contactPhone}`}
                        className="flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Phone className="w-3 h-3" />
                        <span>Call</span>
                      </a>
                      <a
                        href={`https://wa.me/${phoneClean}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1 rounded border border-emerald-200 text-xs font-medium text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>WhatsApp</span>
                      </a>
                    </div>

                    <Link
                      href={`/leads/${item.leadId}`}
                      className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <span>View Lead</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
