'use client';

import React, { useState, useEffect } from 'react';
import { DashboardShell } from '../../components/layout/dashboard-shell';
import { useAuth } from '../../context/auth-context';
import api from '../../lib/api';
import {
  Megaphone,
  TrendingUp,
  DollarSign,
  Users,
  MousePointerClick,
  Eye,
  ArrowUpRight,
  Layers,
  ChevronDown,
  ChevronRight,
  Filter,
  Calendar,
  Sparkles,
  Download,
  RefreshCw,
  Search,
  ShoppingBag,
  Smartphone,
  Key,
  FileText,
  CheckCircle2,
  Globe,
  Building2,
  BarChart3,
  Monitor,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

export default function CampaignsPage() {
  const { user, isAgencyUser, activeClient, availableClients, setActiveClient } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  // Overall CRM Overview & Platform Filter
  const [overview, setOverview] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('GOOGLE');

  // Google Ads Full Reporting States
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('1111111111');
  const [accountReport, setAccountReport] = useState<any>(null);
  const [googleCampaigns, setGoogleCampaigns] = useState<any[]>([]);
  const [googleAdGroups, setGoogleAdGroups] = useState<any[]>([]);
  const [googleAds, setGoogleAds] = useState<any[]>([]);
  const [googleKeywords, setGoogleKeywords] = useState<any[]>([]);
  const [googleSearchTerms, setGoogleSearchTerms] = useState<any[]>([]);
  const [googlePMax, setGooglePMax] = useState<any[]>([]);
  const [googleShopping, setGoogleShopping] = useState<any[]>([]);
  const [googleSegmentation, setGoogleSegmentation] = useState<any[]>([]);

  // Filters
  const [activeTab, setActiveTab] = useState<
    'CAMPAIGNS' | 'AD_GROUPS' | 'ADS' | 'KEYWORDS' | 'SEARCH_TERMS' | 'PMAX' | 'SHOPPING' | 'SEGMENTS'
  >('CAMPAIGNS');
  const [channelTypeFilter, setChannelTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [deviceFilter, setDeviceFilter] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<string>('30d');
  const [expandedCampaigns, setExpandedCampaigns] = useState<Record<string, boolean>>({});

  // Client to Google Customer mapping
  const clientCustomerAccounts = [
    {
      orgId: '9076ed25-c0dc-4173-959a-f2d704f8db7a',
      orgName: 'Aura Fine Jewelry',
      customerId: '1111111111',
      formattedId: '111-222-3333',
    },
    {
      orgId: '89219520-0992-4823-8981-1476aaef803e',
      orgName: 'Zenith Real Estate',
      customerId: '2222222222',
      formattedId: '222-333-4444',
    },
  ];

  // Sync selectedCustomerId when active client changes
  useEffect(() => {
    if (activeClient?.id) {
      const match = clientCustomerAccounts.find((c) => c.orgId === activeClient.id);
      if (match) {
        setSelectedCustomerId(match.customerId);
      }
    }
  }, [activeClient]);

  const fetchCrmData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (activeClient?.id) params.organizationId = activeClient.id;
      if (selectedPlatform !== 'ALL') params.platform = selectedPlatform;

      const [overviewRes, campaignsRes] = await Promise.all([
        api.get('/analytics/overview', { params }),
        api.get('/analytics/campaigns', { params }),
      ]);

      if (overviewRes.data?.success) {
        setOverview(overviewRes.data.data);
      }
      if (campaignsRes.data?.success) {
        setCampaigns(campaignsRes.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching CRM analytics', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGoogleAdsReporting = async () => {
    setLoadingGoogle(true);
    try {
      const params: any = { customerId: selectedCustomerId };
      if (channelTypeFilter !== 'ALL') params.channelType = channelTypeFilter;

      const [accRes, campRes, agRes, adRes, kwRes, stRes, pmaxRes, shopRes, segRes] = await Promise.all([
        api.get('/integrations/google/account-report', { params }),
        api.get('/integrations/google/campaigns-report', { params }),
        api.get('/integrations/google/adgroups-report', { params }),
        api.get('/integrations/google/ads-report', { params }),
        api.get('/integrations/google/keywords-report', { params }),
        api.get('/integrations/google/search-terms-report', { params }),
        api.get('/integrations/google/pmax-report', { params }),
        api.get('/integrations/google/shopping-report', { params }),
        api.get('/integrations/google/segmentation-report', { params }),
      ]);

      if (accRes.data?.data) setAccountReport(accRes.data.data);
      if (campRes.data?.data) setGoogleCampaigns(campRes.data.data);
      if (agRes.data?.data) setGoogleAdGroups(agRes.data.data);
      if (adRes.data?.data) setGoogleAds(adRes.data.data);
      if (kwRes.data?.data) setGoogleKeywords(kwRes.data.data);
      if (stRes.data?.data) setGoogleSearchTerms(stRes.data.data);
      if (pmaxRes.data?.data) setGooglePMax(pmaxRes.data.data);
      if (shopRes.data?.data) setGoogleShopping(shopRes.data.data);
      if (segRes.data?.data) setGoogleSegmentation(segRes.data.data);
    } catch (err) {
      console.error('Error fetching Google Ads reporting', err);
    } finally {
      setLoadingGoogle(false);
    }
  };

  useEffect(() => {
    fetchCrmData();
  }, [activeClient, selectedPlatform]);

  useEffect(() => {
    if (selectedPlatform === 'GOOGLE' || selectedPlatform === 'ALL') {
      fetchGoogleAdsReporting();
    }
  }, [selectedCustomerId, channelTypeFilter, dateRange]);

  const handleTriggerSync = async () => {
    setSyncingGoogle(true);
    setSyncSuccessMsg(null);
    try {
      const match = clientCustomerAccounts.find((c) => c.customerId === selectedCustomerId);
      const orgId = match ? match.orgId : activeClient?.id;
      const res = await api.post('/integrations/google/sync', {
        organizationId: orgId,
        customerId: selectedCustomerId,
        managerCustomerId: '9821405921',
        syncType: 'FULL',
      });
      if (res.data?.success) {
        setSyncSuccessMsg(`Successfully synchronized ${res.data.data.recordsProcessed} records from Google Ads!`);
        setTimeout(() => setSyncSuccessMsg(null), 4000);
        await Promise.all([fetchGoogleAdsReporting(), fetchCrmData()]);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to sync Google Ads account');
    } finally {
      setSyncingGoogle(false);
    }
  };

  const toggleCampaign = (id: string) => {
    setExpandedCampaigns((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const kpis = overview?.kpis || {
    totalSpend: accountReport?.spend || 0,
    totalImpressions: accountReport?.impressions || 0,
    totalClicks: accountReport?.clicks || 0,
    ctr: accountReport?.ctr || 0,
    totalLeads: 0,
    cpl: 0,
    totalConversions: accountReport?.conversions || 0,
    conversionRate: 0,
    totalRevenue: accountReport?.conversionValue || 0,
    roas: accountReport?.roas || 0,
  };

  const filteredGoogleCampaigns = googleCampaigns.filter((c) => {
    if (channelTypeFilter !== 'ALL' && c.channelType.toUpperCase() !== channelTypeFilter.toUpperCase()) {
      return false;
    }
    if (statusFilter !== 'ALL' && c.status.toUpperCase() !== statusFilter.toUpperCase()) {
      return false;
    }
    return true;
  });

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Page Header & Top Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Megaphone className="w-6 h-6 text-blue-600" />
              Advertising Analytics & Full Google Ads Reporting
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Multi-tier account reporting: Client &rarr; Google Ads Account &rarr; Campaign &rarr; Ad Group &rarr; Creative & Keywords
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Client Workspace Selector */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm text-xs">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={activeClient?.id || ''}
                onChange={(e) => {
                  const sel = availableClients.find((c) => c.id === e.target.value);
                  if (sel) setActiveClient(sel);
                }}
                className="bg-transparent font-semibold text-slate-800 focus:outline-none"
              >
                {availableClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Google Ads Account Boundary Selector */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm text-xs">
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="bg-transparent font-mono font-semibold text-slate-800 focus:outline-none"
              >
                {clientCustomerAccounts.map((acc) => (
                  <option key={acc.customerId} value={acc.customerId}>
                    {acc.orgName} ({acc.formattedId})
                  </option>
                ))}
              </select>
            </div>

            {/* Platform Selector */}
            <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 shadow-sm text-xs">
              {['GOOGLE', 'META', 'ALL'].map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedPlatform(p)}
                  className={`px-3 py-1 font-semibold rounded-md transition-colors ${
                    selectedPlatform === p
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Sync Now Button */}
            <button
              disabled={syncingGoogle}
              onClick={handleTriggerSync}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingGoogle ? 'animate-spin' : ''}`} />
              <span>{syncingGoogle ? 'Syncing...' : 'Sync Account'}</span>
            </button>
          </div>
        </div>

        {/* Sync Success Feedback Banner */}
        {syncSuccessMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{syncSuccessMsg}</span>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* GOOGLE ADS ACCOUNT LEVEL PERFORMANCE KPI CARDS */}
        {/* ------------------------------------------------------------- */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-2xl text-white shadow-md border border-slate-700 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/80 pb-3">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                Google Ads Account Level Reporting (API v25)
              </span>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>{accountReport?.accountName || 'Google Ads Account'}</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Customer ID: {accountReport?.formattedCustomerId || selectedCustomerId}
                </span>
              </h2>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-300">
              <span className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700">
                Currency: <strong className="text-white">{accountReport?.currencyCode || 'INR'}</strong>
              </span>
              <span className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700">
                Timezone: <strong className="text-white">{accountReport?.timeZone || 'Asia/Kolkata'}</strong>
              </span>
              <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                {accountReport?.status || 'ENABLED'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
              <span className="text-[11px] text-slate-400 uppercase block font-medium">Total Spend</span>
              <span className="text-lg font-bold text-white mt-0.5 block">
                ₹{(accountReport?.spend || 0).toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">Avg CPC: ₹{accountReport?.cpc || 0}</span>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
              <span className="text-[11px] text-slate-400 uppercase block font-medium">Impressions</span>
              <span className="text-lg font-bold text-white mt-0.5 block">
                {(accountReport?.impressions || 0).toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">CPM: ₹{accountReport?.cpm || 0}</span>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
              <span className="text-[11px] text-slate-400 uppercase block font-medium">Clicks</span>
              <span className="text-lg font-bold text-white mt-0.5 block">
                {(accountReport?.clicks || 0).toLocaleString()}
              </span>
              <span className="text-[10px] text-emerald-400 font-semibold block mt-1">CTR: {accountReport?.ctr || 0}%</span>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
              <span className="text-[11px] text-slate-400 uppercase block font-medium">Conversions</span>
              <span className="text-lg font-bold text-white mt-0.5 block">
                {(accountReport?.conversions || 0).toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">
                Cost/Conv: ₹{accountReport?.costPerConversion || 0}
              </span>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
              <span className="text-[11px] text-slate-400 uppercase block font-medium">Conversion Value</span>
              <span className="text-lg font-bold text-emerald-400 mt-0.5 block">
                ₹{(accountReport?.conversionValue || 0).toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">Attributed Sales</span>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
              <span className="text-[11px] text-slate-400 uppercase block font-medium">Google ROAS</span>
              <span className="text-lg font-bold text-emerald-300 mt-0.5 block">
                {accountReport?.roas || 0}x
              </span>
              <span className="text-[10px] text-emerald-400 font-semibold block mt-1">Closed-Loop Metric</span>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* ENTITY NAVIGATION TABS & FILTERS */}
        {/* ------------------------------------------------------------- */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            {/* Entity Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
              {[
                { id: 'CAMPAIGNS', label: 'Campaigns', icon: Megaphone, count: googleCampaigns.length },
                { id: 'AD_GROUPS', label: 'Ad Groups', icon: Layers, count: googleAdGroups.length },
                { id: 'ADS', label: 'Ads & Creatives', icon: Eye, count: googleAds.length },
                { id: 'KEYWORDS', label: 'Keywords (Search)', icon: Key, count: googleKeywords.length },
                { id: 'SEARCH_TERMS', label: 'Search Terms', icon: Search, count: googleSearchTerms.length },
                { id: 'PMAX', label: 'Performance Max', icon: Sparkles, count: googlePMax.length },
                { id: 'SHOPPING', label: 'Shopping', icon: ShoppingBag, count: googleShopping.length },
                { id: 'SEGMENTS', label: 'Devices & Network', icon: Smartphone, count: googleSegmentation.length },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Granular Filters */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Campaign Type Filter */}
              {activeTab === 'CAMPAIGNS' && (
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                  <span className="text-[11px] text-slate-400 font-medium">Type:</span>
                  <select
                    value={channelTypeFilter}
                    onChange={(e) => setChannelTypeFilter(e.target.value)}
                    className="bg-transparent font-semibold text-slate-700 focus:outline-none"
                  >
                    <option value="ALL">All Types</option>
                    <option value="SEARCH">Search</option>
                    <option value="PERFORMANCE_MAX">Performance Max</option>
                    <option value="SHOPPING">Shopping</option>
                    <option value="DISPLAY">Display</option>
                    <option value="DEMAND_GEN">Demand Gen</option>
                    <option value="VIDEO">Video / YouTube</option>
                  </select>
                </div>
              )}

              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                <span className="text-[11px] text-slate-400 font-medium">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent font-semibold text-slate-700 focus:outline-none"
                >
                  <option value="ALL">All</option>
                  <option value="ENABLED">Enabled</option>
                  <option value="PAUSED">Paused</option>
                </select>
              </div>

              {/* Date Range Selector */}
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="bg-transparent font-semibold text-slate-700 focus:outline-none"
                >
                  <option value="7d">Last 7 Days</option>
                  <option value="14d">Last 14 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="month">This Month</option>
                </select>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* TAB 1: CAMPAIGNS TABLE */}
          {/* ------------------------------------------------------------- */}
          {activeTab === 'CAMPAIGNS' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Campaign Name & ID</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Budget</th>
                    <th className="py-2.5 px-3">Bidding Strategy</th>
                    <th className="py-2.5 px-3 text-right">Spend</th>
                    <th className="py-2.5 px-3 text-right">Clicks (CTR)</th>
                    <th className="py-2.5 px-3 text-right">Avg CPC</th>
                    <th className="py-2.5 px-3 text-right">Conversions</th>
                    <th className="py-2.5 px-3 text-right">ROAS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredGoogleCampaigns.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        No campaigns found for the selected filter
                      </td>
                    </tr>
                  ) : (
                    filteredGoogleCampaigns.map((camp) => (
                      <tr key={camp.campaignId} className="hover:bg-slate-50/60">
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-900 block">{camp.campaignName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">ID: {camp.campaignId}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            {camp.channelType}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              camp.status === 'ENABLED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {camp.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-700">₹{camp.budget.toLocaleString()}/day</td>
                        <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">{camp.biddingStrategy}</td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900">₹{camp.spend.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right">
                          <span className="font-semibold text-slate-800 block">{camp.clicks.toLocaleString()}</span>
                          <span className="text-[10px] text-slate-400">{camp.ctr}% CTR</span>
                        </td>
                        <td className="py-3 px-3 text-right text-slate-700">₹{camp.cpc}</td>
                        <td className="py-3 px-3 text-right">
                          <span className="font-bold text-blue-600 block">{camp.conversions}</span>
                          <span className="text-[10px] text-slate-400">{camp.conversionRate}% rate</span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className="inline-block px-2 py-0.5 rounded font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 text-xs">
                            {camp.roas}x
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* TAB 2: AD GROUPS TABLE */}
          {/* ------------------------------------------------------------- */}
          {activeTab === 'AD_GROUPS' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Ad Group Name</th>
                    <th className="py-2.5 px-3">Parent Campaign</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Spend</th>
                    <th className="py-2.5 px-3 text-right">Impressions</th>
                    <th className="py-2.5 px-3 text-right">Clicks (CTR)</th>
                    <th className="py-2.5 px-3 text-right">Avg CPC</th>
                    <th className="py-2.5 px-3 text-right">Conversions</th>
                    <th className="py-2.5 px-3 text-right">ROAS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {googleAdGroups.map((ag) => (
                    <tr key={ag.adGroupId} className="hover:bg-slate-50/60">
                      <td className="py-3 px-3 font-bold text-slate-900">{ag.adGroupName}</td>
                      <td className="py-3 px-3 text-slate-600">{ag.campaignName}</td>
                      <td className="py-3 px-3 text-[10px] font-mono text-slate-500">{ag.type}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {ag.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">₹{ag.spend.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-slate-600">{ag.impressions.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-semibold text-slate-800 block">{ag.clicks.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400">{ag.ctr}%</span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-700">₹{ag.cpc}</td>
                      <td className="py-3 px-3 text-right font-bold text-blue-600">{ag.conversions}</td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {ag.roas}x
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* TAB 3: ADS & CREATIVES TABLE */}
          {/* ------------------------------------------------------------- */}
          {activeTab === 'ADS' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Creative Headline / Name</th>
                    <th className="py-2.5 px-3">Creative Type</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Spend</th>
                    <th className="py-2.5 px-3 text-right">Impressions</th>
                    <th className="py-2.5 px-3 text-right">Clicks (CTR)</th>
                    <th className="py-2.5 px-3 text-right">Conversions</th>
                    <th className="py-2.5 px-3 text-right">Conv Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {googleAds.map((ad) => (
                    <tr key={ad.adId} className="hover:bg-slate-50/60">
                      <td className="py-3 px-3 font-bold text-slate-900 max-w-[280px]">{ad.adName}</td>
                      <td className="py-3 px-3 font-mono text-[10px] text-blue-700 bg-blue-50/50 px-2 rounded">
                        {ad.adType}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {ad.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">₹{ad.spend.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-slate-600">{ad.impressions.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-semibold text-slate-800 block">{ad.clicks.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400">{ad.ctr}%</span>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-blue-600">{ad.conversions}</td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-600">₹{ad.conversionValue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* TAB 4: SEARCH KEYWORDS TABLE */}
          {/* ------------------------------------------------------------- */}
          {activeTab === 'KEYWORDS' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Keyword Text</th>
                    <th className="py-2.5 px-3">Match Type</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Spend</th>
                    <th className="py-2.5 px-3 text-right">Impressions</th>
                    <th className="py-2.5 px-3 text-right">Clicks (CTR)</th>
                    <th className="py-2.5 px-3 text-right">Avg CPC</th>
                    <th className="py-2.5 px-3 text-right">Conversions</th>
                    <th className="py-2.5 px-3 text-right">Conv Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {googleKeywords.map((kw) => (
                    <tr key={kw.criterionId} className="hover:bg-slate-50/60">
                      <td className="py-3 px-3 font-bold text-slate-900">{kw.keywordText}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            kw.matchType === 'EXACT'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : kw.matchType === 'PHRASE'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {kw.matchType}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {kw.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">₹{kw.spend.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-slate-600">{kw.impressions.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-semibold text-slate-800 block">{kw.clicks.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400">{kw.ctr}%</span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-700">₹{kw.cpc}</td>
                      <td className="py-3 px-3 text-right font-bold text-blue-600">{kw.conversions}</td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-600">₹{kw.conversionValue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* TAB 5: ACTUAL SEARCH TERMS TABLE */}
          {/* ------------------------------------------------------------- */}
          {activeTab === 'SEARCH_TERMS' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">User Query / Search Term</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Spend</th>
                    <th className="py-2.5 px-3 text-right">Impressions</th>
                    <th className="py-2.5 px-3 text-right">Clicks (CTR)</th>
                    <th className="py-2.5 px-3 text-right">Conversions</th>
                    <th className="py-2.5 px-3 text-right">Conv Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {googleSearchTerms.map((st, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="py-3 px-3 font-bold text-slate-900">{st.searchTerm}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            st.status === 'ADDED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {st.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">₹{st.spend.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-slate-600">{st.impressions.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-semibold text-slate-800 block">{st.clicks.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400">{st.ctr}%</span>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-blue-600">{st.conversions}</td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-600">₹{st.conversionValue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* TAB 6: PERFORMANCE MAX ASSET GROUPS */}
          {/* ------------------------------------------------------------- */}
          {activeTab === 'PMAX' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Asset Group Name</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Spend</th>
                    <th className="py-2.5 px-3 text-right">Impressions</th>
                    <th className="py-2.5 px-3 text-right">Clicks</th>
                    <th className="py-2.5 px-3 text-right">Conversions</th>
                    <th className="py-2.5 px-3 text-right">Conversion Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {googlePMax.map((ast) => (
                    <tr key={ast.assetGroupId} className="hover:bg-slate-50/60">
                      <td className="py-3 px-3 font-bold text-slate-900">{ast.assetGroupName}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {ast.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">₹{ast.spend.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-slate-600">{ast.impressions.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-800">{ast.clicks.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right font-bold text-blue-600">{ast.conversions}</td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-600">₹{ast.conversionValue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* TAB 7: SHOPPING PRODUCTS */}
          {/* ------------------------------------------------------------- */}
          {activeTab === 'SHOPPING' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Product Title & SKU</th>
                    <th className="py-2.5 px-3">Product Category</th>
                    <th className="py-2.5 px-3 text-right">Spend</th>
                    <th className="py-2.5 px-3 text-right">Impressions</th>
                    <th className="py-2.5 px-3 text-right">Clicks</th>
                    <th className="py-2.5 px-3 text-right">Conversions</th>
                    <th className="py-2.5 px-3 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {googleShopping.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No shopping campaigns or product metrics found for this account.
                      </td>
                    </tr>
                  ) : (
                    googleShopping.map((shop, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-900 block">{shop.productTitle}</span>
                          <span className="text-[10px] text-slate-400 font-mono">SKU: {shop.productItemId}</span>
                        </td>
                        <td className="py-3 px-3 text-slate-600">{shop.productTypeL1}</td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900">₹{shop.spend.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right text-slate-600">{shop.impressions.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right font-semibold text-slate-800">{shop.clicks.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right font-bold text-blue-600">{shop.conversions}</td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-600">₹{shop.conversionValue.toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* TAB 8: DEVICE & NETWORK SEGMENTS */}
          {/* ------------------------------------------------------------- */}
          {activeTab === 'SEGMENTS' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Device Segment</th>
                    <th className="py-2.5 px-3">Ad Network Type</th>
                    <th className="py-2.5 px-3 text-right">Spend</th>
                    <th className="py-2.5 px-3 text-right">Impressions</th>
                    <th className="py-2.5 px-3 text-right">Clicks</th>
                    <th className="py-2.5 px-3 text-right">Conversions</th>
                    <th className="py-2.5 px-3 text-right">Conversion Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {googleSegmentation.map((seg, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="py-3 px-3 font-bold text-slate-900 flex items-center gap-2">
                        {seg.device === 'MOBILE' ? (
                          <Smartphone className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Monitor className="w-4 h-4 text-slate-600" />
                        )}
                        <span>{seg.device}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {seg.network}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">₹{seg.spend.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-slate-600">{seg.impressions.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-800">{seg.clicks.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right font-bold text-blue-600">{seg.conversions}</td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-600">₹{seg.conversionValue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
