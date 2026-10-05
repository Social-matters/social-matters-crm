'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Lock,
  Phone,
  MessageSquare,
  Calendar,
  CheckCircle2,
  DollarSign,
  UserCheck,
  Clock,
  History,
  AlertCircle,
  FileText,
  Building,
  Plus,
  Send,
  ExternalLink,
} from 'lucide-react';
import { DashboardShell } from '../../../components/layout/dashboard-shell';
import { useAuth } from '../../../context/auth-context';
import { ApiClient } from '../../../lib/api';
import { formatDate, formatCurrency } from '../../../lib/utils';
import { LeadStatus, PlatformType, FollowUpStatus } from '@sm-crm/shared';

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const leadId = params.id as string;

  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  // Status update modal / dropdown
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Follow-up modal
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNote, setFollowUpNote] = useState('');

  // Conversion modal
  const [isConversionModalOpen, setIsConversionModalOpen] = useState(false);
  const [conversionValue, setConversionValue] = useState('');
  const [conversionNote, setConversionNote] = useState('');

  const fetchLeadDetails = async () => {
    try {
      const res = await ApiClient.get(`/leads/${leadId}`);
      if (res.data) {
        setLead(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching lead details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (leadId) fetchLeadDetails();
  }, [leadId]);

  const handleStatusChange = async (newStatus: LeadStatus) => {
    setUpdatingStatus(true);
    try {
      await ApiClient.patch(`/leads/${leadId}/status`, {
        status: newStatus,
        notes: `Status changed to ${newStatus}`,
      });
      fetchLeadDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setSubmittingNote(true);
    try {
      await ApiClient.post(`/leads/${leadId}/notes`, {
        content: newNote.trim(),
      });
      setNewNote('');
      fetchLeadDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to add note');
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleScheduleFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ApiClient.post(`/leads/${leadId}/follow-ups`, {
        scheduledAt: new Date(followUpDate).toISOString(),
        reminderNote: followUpNote || undefined,
      });
      setIsFollowUpModalOpen(false);
      setFollowUpDate('');
      setFollowUpNote('');
      fetchLeadDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to schedule follow-up');
    }
  };

  const handleCompleteFollowUp = async (followUpId: string) => {
    try {
      await ApiClient.patch(`/leads/follow-ups/${followUpId}/status`, {
        status: FollowUpStatus.COMPLETED,
      });
      fetchLeadDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to complete follow-up');
    }
  };

  const handleRecordConversion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ApiClient.post(`/leads/${leadId}/conversions`, {
        value: parseFloat(conversionValue),
        notes: conversionNote || undefined,
      });
      setIsConversionModalOpen(false);
      setConversionValue('');
      setConversionNote('');
      fetchLeadDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to record conversion');
    }
  };

  if (loading) {
    return (
      <DashboardShell>
        <div className="py-24 text-center">
          <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto mb-3" />
          <span className="text-xs text-slate-500 font-medium">Loading enquiry details...</span>
        </div>
      </DashboardShell>
    );
  }

  if (!lead) {
    return (
      <DashboardShell>
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
          <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h2 className="text-base font-bold text-slate-800">Lead Not Found</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            The requested lead enquiry does not exist or you do not have permission to view it.
          </p>
          <Link
            href="/leads"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-md"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Leads
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const phoneClean = (lead.contact?.phone || lead.rawPhone).replace(/[^\d]/g, '');
  const waUrl = `https://wa.me/${phoneClean}`;
  const telUrl = `tel:${lead.contact?.phone || lead.rawPhone}`;

  return (
    <DashboardShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Top Navigation & Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/leads"
              className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  {lead.contact?.fullName || lead.rawFullName}
                </h1>
                {lead.isDuplicate && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                    REPEAT ENQUIRY
                  </span>
                )}
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {lead.status}
                </span>
              </div>
              <span className="text-xs text-slate-500 mt-0.5 block">
                Workspace: {lead.organization?.name} • Ingested {formatDate(lead.submittedAt)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={telUrl}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 shadow-sm"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call</span>
            </a>

            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-300 rounded-md hover:bg-emerald-100 shadow-sm"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>

            <button
              onClick={() => setIsFollowUpModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 shadow-sm"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Schedule Follow-up</span>
            </button>

            <button
              onClick={() => setIsConversionModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 shadow-sm"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Record Sale</span>
            </button>
          </div>
        </div>

        {/* 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info Column (Left 2 spans) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Section 1: Immutable Original Ingestion Snapshot */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Original Form Ingestion Data (Locked & Immutable)
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  PRD Rule: Read-Only Audit Snapshot
                </span>
              </div>

              <div className="p-5 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Submitted Full Name</span>
                  <span className="text-slate-900 font-semibold mt-0.5 block">
                    {lead.rawFullName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Submitted Phone</span>
                  <span className="text-slate-900 font-semibold mt-0.5 block">
                    {lead.rawPhone}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Submitted Email</span>
                  <span className="text-slate-900 font-semibold mt-0.5 block">
                    {lead.rawEmail || 'None provided'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Source Platform</span>
                  <span className="text-slate-900 font-semibold mt-0.5 block">
                    {lead.sourcePlatform}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Advertising Campaign</span>
                  <span className="text-slate-900 font-semibold mt-0.5 block">
                    {lead.campaign?.name || 'Direct / Organic'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">External Lead ID</span>
                  <span className="text-slate-900 font-mono text-[11px] mt-0.5 block">
                    {lead.externalLeadId || 'Manual submission'}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 2: Dynamic Lead Form Fields */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-600" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Dynamic Form Responses & Custom Answers
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  {lead.fieldValues?.length || 0} Questions Answered
                </span>
              </div>

              {lead.fieldValues && lead.fieldValues.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {lead.fieldValues.map((fv: any) => (
                    <div key={fv.id} className="p-4 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-600">{fv.fieldLabel}</span>
                      <span className="font-semibold text-slate-900 text-right bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
                        {fv.fieldValue}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-400">
                  No additional custom questions attached to this form submission.
                </div>
              )}
            </div>

            {/* Section 3: Contact Enquiry History (Duplicate Tracker) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-600" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Contact Enquiry History (Duplicate Tracker)
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  {lead.contact?.leads?.length || 0} Prior Submissions
                </span>
              </div>

              {lead.contact?.leads && lead.contact.leads.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {lead.contact.leads.map((otherLead: any) => (
                    <div
                      key={otherLead.id}
                      className="p-4 flex items-center justify-between text-xs hover:bg-slate-50/50"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">
                            {otherLead.campaign?.name || 'Organic Enquiry'}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 font-semibold text-slate-700">
                            {otherLead.sourcePlatform}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 mt-0.5 block">
                          Submitted {formatDate(otherLead.submittedAt)}
                        </span>
                      </div>
                      <Link
                        href={`/leads/${otherLead.id}`}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        Inspect Submission →
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-400">
                  First-time enquiry. No prior submissions on record for this phone number.
                </div>
              )}
            </div>

            {/* Section 4: Notes & Activity Timeline */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
              <h2 className="text-sm font-bold text-slate-900">Internal Sales Notes</h2>
              <form onSubmit={handleAddNote} className="space-y-3">
                <textarea
                  rows={3}
                  required
                  placeholder="Record customer preferences, budget discussions, or call feedback..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submittingNote}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Add Note</span>
                  </button>
                </div>
              </form>

              {/* Notes Stream */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                {lead.notes?.map((n: any) => (
                  <div key={n.id} className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                      <span className="font-semibold text-slate-800">{n.author?.name}</span>
                      <span className="text-[11px]">{formatDate(n.createdAt)}</span>
                    </div>
                    <p className="text-slate-700 whitespace-pre-line">{n.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Action Column (1 span) */}
          <div className="space-y-6">
            {/* Status Lifecycle Transition */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Lead Lifecycle Stage
              </span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  LeadStatus.NEW,
                  LeadStatus.CONTACTED,
                  LeadStatus.INTERESTED,
                  LeadStatus.FOLLOW_UP,
                  LeadStatus.CONVERTED,
                  LeadStatus.LOST,
                ].map((st) => {
                  const isCurrent = lead.status === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      disabled={updatingStatus || isCurrent}
                      onClick={() => handleStatusChange(st)}
                      className={`text-xs py-2 px-2 rounded-md font-semibold text-center transition-all ${
                        isCurrent
                          ? 'bg-slate-900 text-white shadow-sm ring-2 ring-slate-900 ring-offset-1'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {st.replace(/_/g, ' ')}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scheduled Follow-ups */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Follow-ups
                </span>
                <button
                  onClick={() => setIsFollowUpModalOpen(true)}
                  className="text-xs text-blue-600 font-semibold hover:underline"
                >
                  + Schedule
                </button>
              </div>

              <div className="space-y-2">
                {lead.followUps?.length > 0 ? (
                  lead.followUps.map((fu: any) => (
                    <div
                      key={fu.id}
                      className={`p-3 rounded-lg border text-xs ${
                        fu.status === FollowUpStatus.COMPLETED
                          ? 'bg-slate-50 border-slate-200 text-slate-400'
                          : 'bg-indigo-50/50 border-indigo-200 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                          {formatDate(fu.scheduledAt)}
                        </span>
                        {fu.status === FollowUpStatus.PENDING ? (
                          <button
                            onClick={() => handleCompleteFollowUp(fu.id)}
                            className="text-[11px] px-2 py-0.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 font-medium"
                          >
                            Mark Done
                          </button>
                        ) : (
                          <span className="text-[11px] text-emerald-600 font-bold">
                            Completed
                          </span>
                        )}
                      </div>
                      {fu.reminderNote && (
                        <p className="mt-1 text-slate-600 text-[11px]">{fu.reminderNote}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 block text-center py-2">
                    No follow-ups scheduled yet.
                  </span>
                )}
              </div>
            </div>

            {/* Conversions & Revenue */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Sales Conversions
                </span>
                <button
                  onClick={() => setIsConversionModalOpen(true)}
                  className="text-xs text-emerald-600 font-semibold hover:underline"
                >
                  + Record Sale
                </button>
              </div>

              <div className="space-y-2">
                {lead.conversions?.length > 0 ? (
                  lead.conversions.map((conv: any) => (
                    <div
                      key={conv.id}
                      className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs"
                    >
                      <div className="flex items-center justify-between font-bold text-emerald-800">
                        <span>{formatCurrency(conv.value)}</span>
                        <span className="text-[11px] text-emerald-600 font-normal">
                          {formatDate(conv.conversionDate)}
                        </span>
                      </div>
                      {conv.notes && (
                        <p className="mt-1 text-emerald-900 text-[11px]">{conv.notes}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 block text-center py-2">
                    No sales recorded for this lead yet.
                  </span>
                )}
              </div>
            </div>

            {/* Assigned Sales Rep */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-2 text-xs">
              <span className="block font-bold uppercase tracking-wider text-slate-500">
                Assigned Sales Rep
              </span>
              {lead.assignedUser ? (
                <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700">
                    {lead.assignedUser.name.slice(0, 2)}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900 block">
                      {lead.assignedUser.name}
                    </span>
                    <span className="text-[11px] text-slate-500">{lead.assignedUser.email}</span>
                  </div>
                </div>
              ) : (
                <span className="text-slate-400 block italic">Currently unassigned</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Follow-up Modal */}
      {isFollowUpModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full p-6">
            <h2 className="text-base font-bold text-slate-900 mb-1">Schedule Follow-up</h2>
            <p className="text-xs text-slate-500 mb-4">
              Set a reminder date and note for this customer enquiry.
            </p>

            <form onSubmit={handleScheduleFollowUp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Date and Time *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reminder Note
                </label>
                <textarea
                  rows={2}
                  value={followUpNote}
                  onChange={(e) => setFollowUpNote(e.target.value)}
                  placeholder="Call back after discussing with family..."
                  className="w-full text-xs border border-slate-300 rounded px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFollowUpModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded"
                >
                  Save Reminder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Conversion Modal */}
      {isConversionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full p-6">
            <h2 className="text-base font-bold text-slate-900 mb-1">Record Conversion</h2>
            <p className="text-xs text-slate-500 mb-4">
              Enter the confirmed sale value to update client revenue & campaign ROAS.
            </p>

            <form onSubmit={handleRecordConversion} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Revenue Value (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="85000"
                  value={conversionValue}
                  onChange={(e) => setConversionValue(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sale Notes
                </label>
                <textarea
                  rows={2}
                  value={conversionNote}
                  onChange={(e) => setConversionNote(e.target.value)}
                  placeholder="Sold diamond bridal choker with hallmarked certificate..."
                  className="w-full text-xs border border-slate-300 rounded px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsConversionModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded shadow-sm"
                >
                  Confirm Sale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
