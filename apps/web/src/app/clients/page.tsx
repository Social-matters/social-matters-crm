'use client';

import React, { useState, useEffect } from 'react';
import { DashboardShell } from '../../components/layout/dashboard-shell';
import { useAuth } from '../../context/auth-context';
import api from '../../lib/api';
import {
  Building2,
  Plus,
  Search,
  ExternalLink,
  Users,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  X,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';

export default function ClientsPage() {
  const { user, isAgencyUser, setActiveClient } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New Client Form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('ClientAdmin123!');
  const [adminName, setAdminName] = useState('');

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await api.get('/organizations');
      if (res.data?.success) {
        setClients(res.data.data.filter((o: any) => o.type === 'CLIENT'));
      }
    } catch (err) {
      console.error('Failed to load clients', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleNameChange = (val: string) => {
    setName(val);
    setSlug(
      val
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, ''),
    );
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post('/organizations', {
        name,
        slug,
        adminUser: adminEmail
          ? {
              email: adminEmail,
              name: adminName || `${name} Admin`,
              password: adminPassword,
            }
          : undefined,
      });

      if (res.data?.success) {
        setIsModalOpen(false);
        setName('');
        setSlug('');
        setAdminEmail('');
        setAdminName('');
        fetchClients();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create client workspace');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.slug.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Building2 className="w-6 h-6 text-blue-600" />
              Client Workspaces
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage client organizations, assigned account managers, and isolated lead databases
            </p>
          </div>

          {user?.role === 'SUPER_ADMIN' && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Client Workspace
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm max-w-md">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by client name or handle..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none bg-transparent"
          />
        </div>

        {/* Client Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading ? (
            <div className="col-span-full py-12 text-center text-slate-400 text-sm">
              Loading workspaces...
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="col-span-full bg-white p-12 text-center rounded-xl border border-slate-200">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-800">No client workspaces found</h3>
              <p className="text-xs text-slate-500 mt-1">
                {search ? 'Try adjusting your search criteria' : 'Create your first client workspace to start onboarding'}
              </p>
            </div>
          ) : (
            filteredClients.map((client) => {
              const leadsCount = client._count?.leads || 0;
              const formsCount = client._count?.forms || 0;
              const integrationsCount = client._count?.integrations || 0;
              const usersCount = client._count?.users || 0;
              const manager = client.assignedAgencyManagers?.[0]?.agencyUser?.name || 'Unassigned';

              return (
                <div
                  key={client.id}
                  className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          Client Workspace
                        </span>
                        <h2 className="text-base font-bold text-slate-900 mt-2 group-hover:text-blue-600 transition-colors">
                          {client.name}
                        </h2>
                        <span className="text-xs text-slate-400 font-mono mt-0.5 block">
                          /{client.slug}
                        </span>
                      </div>
                      <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm">
                        {client.name.slice(0, 2).toUpperCase()}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-slate-100 text-center">
                      <div className="p-2 rounded-lg bg-slate-50">
                        <span className="text-xs font-bold text-slate-900 block">{leadsCount}</span>
                        <span className="text-[10px] text-slate-500 uppercase font-medium">Leads</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50">
                        <span className="text-xs font-bold text-slate-900 block">{formsCount}</span>
                        <span className="text-[10px] text-slate-500 uppercase font-medium">Forms</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50">
                        <span className="text-xs font-bold text-slate-900 block">{integrationsCount}</span>
                        <span className="text-[10px] text-slate-500 uppercase font-medium">Channels</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-slate-500">
                      <span>Account Mgr:</span>
                      <span className="font-semibold text-slate-700">{manager}</span>
                    </div>
                  </div>

                  <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => {
                        setActiveClient(client);
                        window.location.href = '/leads';
                      }}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                    >
                      Enter Workspace
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <span className="text-[11px] text-slate-400">
                      {usersCount} Team Members
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Create Client Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Provision Client Workspace</h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateClient} className="space-y-4 mt-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Client Business Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Luxury Realty"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Workspace Slug (URL Safe) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="apex-luxury-realty"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full text-xs font-mono border border-slate-200 rounded-lg px-3 py-2.5 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    Primary Client Admin Account (Optional)
                  </span>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Admin Full Name
                      </label>
                      <input
                        type="text"
                        placeholder="John Doe"
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Admin Email
                      </label>
                      <input
                        type="email"
                        placeholder="admin@apexrealty.com"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
                  >
                    {submitting ? 'Creating...' : 'Create Workspace'}
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
