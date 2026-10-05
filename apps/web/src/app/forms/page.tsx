'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileText,
  Plus,
  Copy,
  Check,
  ExternalLink,
  Code,
  Globe,
  Trash2,
  Settings,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { DashboardShell } from '../../components/layout/dashboard-shell';
import { useAuth } from '../../context/auth-context';
import { ApiClient } from '../../lib/api';
import { formatDate } from '../../lib/utils';

interface FormItem {
  id: string;
  name: string;
  slug: string;
  isPublished: boolean;
  submitButtonText: string;
  thankYouMessage: string;
  fieldsConfig: any[];
  _count: {
    submissions: number;
    leads: number;
  };
  organization: {
    name: string;
  };
}

export default function FormsBuilderPage() {
  const { user, isAgencyUser, activeClient } = useAuth();
  const [forms, setForms] = useState<FormItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Embed Modal
  const [selectedFormForEmbed, setSelectedFormForEmbed] = useState<FormItem | null>(null);

  // Create Form Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [submitText, setSubmitText] = useState('Submit Enquiry');
  const [thankYouMsg, setThankYouMsg] = useState('Thank you! We have received your enquiry.');
  const [fields, setFields] = useState<any[]>([
    { id: '1', name: 'fullName', label: 'Full Name', type: 'text', required: true },
    { id: '2', name: 'phone', label: 'Phone Number', type: 'phone', required: true },
    { id: '3', name: 'email', label: 'Email Address', type: 'email', required: false },
    { id: '4', name: 'category', label: 'Interested Product / Service', type: 'text', required: false },
  ]);
  const [creating, setCreating] = useState(false);

  const fetchForms = async () => {
    setLoading(true);
    try {
      const orgParam = isAgencyUser && activeClient?.id ? `?organizationId=${activeClient.id}` : '';
      const res = await ApiClient.get<FormItem[]>(`/forms${orgParam}`);
      if (res.data) setForms(res.data);
    } catch (err) {
      console.error('Error fetching forms:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForms();
  }, [activeClient]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleAddField = () => {
    const newId = String(Date.now());
    setFields([
      ...fields,
      { id: newId, name: `field_${newId.slice(-4)}`, label: 'Custom Question', type: 'text', required: false },
    ]);
  };

  const handleRemoveField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id));
  };

  const handleCreateForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const orgId = isAgencyUser ? activeClient?.id : user?.organizationId;
      if (!orgId) throw new Error('No organization selected');

      await ApiClient.post('/forms', {
        organizationId: orgId,
        name: formName,
        slug: formSlug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-'),
        submitButtonText: submitText,
        thankYouMessage: thankYouMsg,
        fieldsConfig: fields,
      });

      setIsCreateModalOpen(false);
      setFormName('');
      setFormSlug('');
      fetchForms();
    } catch (err: any) {
      alert(err.message || 'Failed to create form');
    } finally {
      setCreating(false);
    }
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Website Form Builder
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Create customizable client forms. Capture leads with UTM tracking via hosted links or embeddable code.
            </p>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New Form</span>
          </button>
        </div>

        {/* Forms Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {loading ? (
            <div className="col-span-2 py-12 text-center text-slate-400">
              <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin mx-auto mb-2" />
              Loading forms...
            </div>
          ) : forms.length === 0 ? (
            <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
              No forms built yet. Click &quot;Create New Form&quot; to build your first embeddable form.
            </div>
          ) : (
            forms.map((form) => {
              const hostedUrl = `${baseUrl}/forms/${form.slug}`;
              const embedIframe = `<iframe src="${hostedUrl}" width="100%" height="600" frameborder="0"></iframe>`;

              return (
                <div
                  key={form.id}
                  className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">{form.name}</h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 block mt-0.5">
                        Client: {form.organization?.name} • Slug: /{form.slug}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/forms/${form.slug}`}
                        target="_blank"
                        className="p-1.5 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                        title="Open Live Form"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-lg text-xs">
                    <div>
                      <span className="text-slate-400 block font-medium">Fields</span>
                      <span className="text-slate-900 font-bold mt-0.5 block">
                        {form.fieldsConfig?.length || 0} questions
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">Submissions</span>
                      <span className="text-slate-900 font-bold mt-0.5 block">
                        {form._count?.submissions || 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">CRM Leads</span>
                      <span className="text-slate-900 font-bold mt-0.5 block">
                        {form._count?.leads || 0}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                    <span className="text-slate-500 font-medium block">Publishing Options:</span>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono bg-slate-50 px-2 py-1 rounded border border-slate-200 text-slate-600 truncate flex-1">
                        {hostedUrl}
                      </span>
                      <button
                        onClick={() => copyToClipboard(hostedUrl, `url-${form.id}`)}
                        className="px-2 py-1 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                      >
                        {copiedKey === `url-${form.id}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>Copy Link</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => setSelectedFormForEmbed(form)}
                        className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Code className="w-3.5 h-3.5" />
                        <span>Get Embed Code (HTML / Iframe)</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Embed Code Modal */}
        {selectedFormForEmbed && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">
                  Embed Code: {selectedFormForEmbed.name}
                </h3>
                <button
                  onClick={() => setSelectedFormForEmbed(null)}
                  className="text-xs text-slate-400 hover:text-slate-700"
                >
                  Close
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  1. Embeddable Iframe Code
                </label>
                <textarea
                  readOnly
                  rows={3}
                  value={`<iframe src="${baseUrl}/forms/${selectedFormForEmbed.slug}" width="100%" height="650" frameborder="0"></iframe>`}
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded p-2.5"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  2. Direct Webhook / API Ingestion
                </label>
                <div className="p-2.5 bg-slate-900 text-slate-100 rounded text-[11px] font-mono">
                  POST {baseUrl}/api/v1/forms/{selectedFormForEmbed.slug}/submit
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() =>
                    copyToClipboard(
                      `<iframe src="${baseUrl}/forms/${selectedFormForEmbed.slug}" width="100%" height="650" frameborder="0"></iframe>`,
                      'embed_code',
                    )
                  }
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded"
                >
                  {copiedKey === 'embed_code' ? 'Copied to Clipboard!' : 'Copy Iframe Code'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Form Modal */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto space-y-4">
              <h2 className="text-base font-bold text-slate-900">Create New Website Form</h2>

              <form onSubmit={handleCreateForm} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Form Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Diwali Fest Consultation"
                    value={formName}
                    onChange={(e) => {
                      setFormName(e.target.value);
                      if (!formSlug) {
                        setFormSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                      }
                    }}
                    className="w-full text-xs border border-slate-300 rounded px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    URL Slug *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="diwali-fest"
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded px-3 py-2 font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Button Text
                    </label>
                    <input
                      type="text"
                      value={submitText}
                      onChange={(e) => setSubmitText(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Thank You Message
                    </label>
                    <input
                      type="text"
                      value={thankYouMsg}
                      onChange={(e) => setThankYouMsg(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded px-3 py-2"
                    />
                  </div>
                </div>

                {/* Form Fields Builder */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Form Questions</span>
                    <button
                      type="button"
                      onClick={handleAddField}
                      className="text-xs text-blue-600 font-semibold hover:underline"
                    >
                      + Add Question
                    </button>
                  </div>

                  <div className="space-y-2">
                    {fields.map((f, i) => (
                      <div
                        key={f.id}
                        className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200 text-xs"
                      >
                        <input
                          type="text"
                          value={f.label}
                          onChange={(e) => {
                            const updated = [...fields];
                            updated[i].label = e.target.value;
                            setFields(updated);
                          }}
                          className="flex-1 border border-slate-200 rounded px-2 py-1"
                        />
                        <select
                          value={f.type}
                          onChange={(e) => {
                            const updated = [...fields];
                            updated[i].type = e.target.value;
                            setFields(updated);
                          }}
                          className="border border-slate-200 rounded px-2 py-1"
                        >
                          <option value="text">Text</option>
                          <option value="email">Email</option>
                          <option value="phone">Phone</option>
                          <option value="number">Number</option>
                          <option value="textarea">Textarea</option>
                        </select>
                        <label className="flex items-center gap-1 text-[11px] text-slate-600">
                          <input
                            type="checkbox"
                            checked={f.required}
                            onChange={(e) => {
                              const updated = [...fields];
                              updated[i].required = e.target.checked;
                              setFields(updated);
                            }}
                          />
                          Req
                        </label>
                        {fields.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveField(f.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
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
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded"
                  >
                    {creating ? 'Saving...' : 'Save & Publish Form'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
