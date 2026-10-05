'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Lock, Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/auth-context';
import { ApiClient } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await ApiClient.post<{
        accessToken: string;
        refreshToken: string;
        user: any;
      }>('/auth/login', { email, password });

      if (res.data) {
        login(res.data.accessToken, res.data.user, res.data.refreshToken);
        router.push('/');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (quickEmail: string, quickPass: string) => {
    setEmail(quickEmail);
    setPassword(quickPass);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xl shadow-md">
            SM
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900">
          Social Matters CRM
        </h2>
        <p className="mt-1 text-center text-sm text-slate-600">
          Multi-Client Lead Management & Advertising Analytics
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 sm:rounded-xl sm:px-10">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-md">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="block w-full rounded-md border border-slate-300 px-3 py-2 pl-9 text-sm placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full rounded-md border border-slate-300 px-3 py-2 pl-9 text-sm placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Switcher */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 text-center">
              Quick Role Test Logins
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('superadmin@socialmatters.com', 'Admin123!')}
                className="text-left p-2 rounded border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-colors text-xs"
              >
                <div className="font-semibold text-slate-900">Super Admin</div>
                <div className="text-[11px] text-slate-500">Agency Master</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('manager@socialmatters.com', 'Manager123!')}
                className="text-left p-2 rounded border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-colors text-xs"
              >
                <div className="font-semibold text-slate-900">Account Mgr</div>
                <div className="text-[11px] text-slate-500">Agency Assigned</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('admin@aurajewelry.com', 'ClientAdmin123!')}
                className="text-left p-2 rounded border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-colors text-xs"
              >
                <div className="font-semibold text-slate-900">Client Admin</div>
                <div className="text-[11px] text-slate-500">Aura Fine Jewelry</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('sales@aurajewelry.com', 'Sales123!')}
                className="text-left p-2 rounded border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-colors text-xs"
              >
                <div className="font-semibold text-slate-900">Client Sales</div>
                <div className="text-[11px] text-slate-500">Sales Rep User</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
