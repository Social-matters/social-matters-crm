'use client';

import React, { useState } from 'react';
import { DashboardShell } from '../../components/layout/dashboard-shell';
import { useAuth } from '../../context/auth-context';
import {
  Settings,
  Building,
  KeyRound,
  Bell,
  CheckCircle2,
  Copy,
  Check,
  Shield,
  Clock,
  Sparkles,
  Save,
} from 'lucide-react';

export default function SettingsPage() {
  const { user, isAgencyUser, activeClient } = useAuth();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Form State
  const [workspaceName, setWorkspaceName] = useState(activeClient?.name || 'Aura Fine Jewelry');
  const [contactEmail, setContactEmail] = useState(user?.email || 'admin@aurajewelry.com');
  const [timezone, setTimezone] = useState('Asia/Kolkata (IST)');
  const [currency, setCurrency] = useState('INR (₹)');
  const [autoDeduplicate, setAutoDeduplicate] = useState(true);
  const [notifyOnNewLead, setNotifyOnNewLead] = useState(true);
  const [notifyOnConversion, setNotifyOnConversion] = useState(true);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <DashboardShell>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-blue-600" />
            Workspace Settings & Integrations
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure organization preferences, webhook security keys, and automated lead handling policies
          </p>
        </div>

        {saved && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            Workspace settings saved successfully!
          </div>
        )}

        {/* Section 1: General Workspace Profile */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-3 pb-5 border-b border-slate-100">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Workspace Profile</h2>
              <p className="text-xs text-slate-500">
                Primary business entity details and regional regional formatting
              </p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4 my-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Workspace Name
                </label>
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Workspace Identifier (Slug)
                </label>
                <input
                  type="text"
                  disabled
                  value={activeClient?.slug || 'aura-fine-jewelry'}
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Notification Contact Email
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Asia/Kolkata (IST)">Asia/Kolkata (IST +5:30)</option>
                  <option value="Asia/Dubai (GST)">Asia/Dubai (GST +4:00)</option>
                  <option value="Asia/Singapore (SGT)">Asia/Singapore (SGT +8:00)</option>
                  <option value="Europe/London (BST)">Europe/London (BST +1:00)</option>
                  <option value="America/New_York (EST)">America/New_York (EST -5:00)</option>
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <Save className="w-4 h-4" />
                Save Profile
              </button>
            </div>
          </form>
        </div>

        {/* Section 2: Ingestion & Security Secrets */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-3 pb-5 border-b border-slate-100">
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Webhook Keys & Verification Tokens</h2>
              <p className="text-xs text-slate-500">
                Use these tokens to configure Meta Graph API, Google Ads, and custom CRM webhook endpoints
              </p>
            </div>
          </div>

          <div className="space-y-4 my-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Meta (Facebook & Instagram) Verify Token
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value="social_matters_meta_verify_token_2026"
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700"
                />
                <button
                  onClick={() =>
                    copyToClipboard(
                      'social_matters_meta_verify_token_2026',
                      'meta_token',
                    )
                  }
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 text-xs font-medium flex items-center gap-1 transition-colors"
                >
                  {copiedKey === 'meta_token' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedKey === 'meta_token' ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Google Ads Webhook Key (google-key Header)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value="google_lead_secret_2026"
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700"
                />
                <button
                  onClick={() =>
                    copyToClipboard('google_lead_secret_2026', 'google_key')
                  }
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 text-xs font-medium flex items-center gap-1 transition-colors"
                >
                  {copiedKey === 'google_key' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedKey === 'google_key' ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Production Webhook Ingestion Base URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value="http://localhost:4000/api/v1/webhooks"
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700"
                />
                <button
                  onClick={() =>
                    copyToClipboard(
                      'http://localhost:4000/api/v1/webhooks',
                      'webhook_url',
                    )
                  }
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 text-xs font-medium flex items-center gap-1 transition-colors"
                >
                  {copiedKey === 'webhook_url' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedKey === 'webhook_url' ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Deduplication & Lead Policy */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-3 pb-5 border-b border-slate-100">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Lead Handling & Deduplication Rules</h2>
              <p className="text-xs text-slate-500">
                PRD-mandated phone and email contact matching policy
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 my-4">
            <div className="py-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  Automatic Contact Deduplication
                </span>
                <span className="text-xs text-slate-500">
                  Normalize phone numbers (E.164) and link repeated submissions under existing contact profiles
                </span>
              </div>
              <input
                type="checkbox"
                checked={autoDeduplicate}
                onChange={(e) => setAutoDeduplicate(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
            </div>

            <div className="py-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  Live Notifications for Ingested Leads
                </span>
                <span className="text-xs text-slate-500">
                  Emit real-time in-app alerts to Client Admins and Account Managers on new enquiry
                </span>
              </div>
              <input
                type="checkbox"
                checked={notifyOnNewLead}
                onChange={(e) => setNotifyOnNewLead(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
            </div>

            <div className="py-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  Closed Conversion Alerts
                </span>
                <span className="text-xs text-slate-500">
                  Broadcast celebration notification when sales reps record a revenue conversion
                </span>
              </div>
              <input
                type="checkbox"
                checked={notifyOnConversion}
                onChange={(e) => setNotifyOnConversion(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
