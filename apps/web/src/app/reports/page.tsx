'use client';

import React, { useState } from 'react';
import { DashboardShell } from '../../components/layout/dashboard-shell';
import { useAuth } from '../../context/auth-context';
import api from '../../lib/api';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Filter,
  FileText,
  CheckCircle2,
  Table,
  Sparkles,
} from 'lucide-react';

export default function ReportsPage() {
  const { activeClient } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleExportLeadsCsv = async () => {
    setDownloading(true);
    try {
      const params: any = {};
      if (activeClient?.id) params.organizationId = activeClient.id;
      if (statusFilter) params.status = statusFilter;
      if (platformFilter) params.sourcePlatform = platformFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await api.get('/leads/export', {
        params,
        responseType: 'blob',
      });

      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `leads_export_${activeClient?.slug || 'all'}_${new Date().toISOString().split('T')[0]}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export CSV', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-6 max-w-5xl">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileSpreadsheet className="w-6 h-6 text-blue-600" />
            Reports & CSV Data Exports
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Export structured CRM data, immutable lead archives, and campaign analytics to Excel/CSV
          </p>
        </div>

        {/* Lead Export Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-3 pb-5 border-b border-slate-100">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Table className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Custom Lead & Enquiry Archive</h2>
              <p className="text-xs text-slate-500">
                Exports contact profiles, original campaign UTM parameters, duplicate flags, notes, and revenue conversions
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 my-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Lead Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="NEW">New</option>
                <option value="CONTACTED">Contacted</option>
                <option value="FOLLOW_UP">Follow Up</option>
                <option value="QUALIFIED">Qualified</option>
                <option value="CONVERTED">Converted</option>
                <option value="LOST">Lost</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Platform Source
              </label>
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All Channels</option>
                <option value="META">Meta Ads (FB/IG)</option>
                <option value="GOOGLE">Google Ads Lead Forms</option>
                <option value="LINKEDIN">LinkedIn Lead Gen</option>
                <option value="WEBSITE">Website Forms</option>
                <option value="WHATSAPP">WhatsApp Direct</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                From Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                To Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Full CSV export with comma-separated UTF-8 character encoding</span>
            </div>

            <button
              onClick={handleExportLeadsCsv}
              disabled={downloading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {downloading ? 'Generating Stream...' : 'Download Leads CSV'}
            </button>
          </div>
        </div>

        {/* Standard Scheduled Reports */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">Campaign ROAS & Conversion Audit</h3>
              <p className="text-xs text-slate-500">
                Detailed spend vs closed sales breakdown across all client advertising accounts
              </p>
              <div className="pt-3">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Format
                </span>
                <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                  Aggregated CSV Summary
                </span>
              </div>
            </div>
            <button
              onClick={handleExportLeadsCsv}
              className="p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors"
              title="Download report"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">Follow-up SLA & Sales Rep Performance</h3>
              <p className="text-xs text-slate-500">
                Response times, completed reminder logs, and conversion velocity per sales rep
              </p>
              <div className="pt-3">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Format
                </span>
                <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                  SLA Audit Log CSV
                </span>
              </div>
            </div>
            <button
              onClick={handleExportLeadsCsv}
              className="p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors"
              title="Download report"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
