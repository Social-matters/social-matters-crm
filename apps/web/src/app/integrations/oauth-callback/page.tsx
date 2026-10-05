'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { ApiClient } from '../../../lib/api';
import { useAuth } from '../../../context/auth-context';

function OAuthCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, activeClient } = useAuth();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Exchanging authorization code for secure access tokens...');
  const [pagesCount, setPagesCount] = useState<number | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      setStatus('error');
      setMessage(errorDescription || `OAuth authorization was denied or failed: ${error}`);
      return;
    }

    if (!code) {
      setStatus('error');
      setMessage('Missing authorization code in redirect URL.');
      return;
    }

    const processOAuth = async () => {
      try {
        const orgId = activeClient?.id || user?.organizationId;
        const redirectUri = `${window.location.origin}/integrations/oauth-callback`;

        const res = await ApiClient.post<any>('/integrations/oauth/META/callback', {
          code,
          redirectUri,
          organizationId: orgId,
        });

        if (res.data?.success) {
          setStatus('success');
          setPagesCount(res.data.pagesCount || 0);
          setMessage('Successfully authenticated! Access tokens encrypted and stored securely.');
          setTimeout(() => {
            router.push('/integrations');
          }, 2500);
        } else {
          setStatus('error');
          setMessage(res.data?.message || 'Failed to exchange authorization code.');
        }
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message || 'An unexpected error occurred during OAuth processing.');
      }
    };

    processOAuth();
  }, [searchParams, user, activeClient, router]);

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-8 text-center space-y-5">
      {status === 'loading' && (
        <>
          <div className="w-12 h-12 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Connecting Advertising Account</h2>
          <p className="text-xs text-slate-500 leading-relaxed">{message}</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Account Connected!</h2>
          <p className="text-xs text-slate-600 leading-relaxed">{message}</p>
          {pagesCount !== null && (
            <span className="inline-block text-xs font-semibold px-3 py-1 bg-slate-100 rounded-full text-slate-700">
              Discovered {pagesCount} Facebook Page{pagesCount === 1 ? '' : 's'}
            </span>
          )}
          <p className="text-[11px] text-slate-400">Redirecting to Integrations dashboard...</p>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto border border-red-200">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Connection Failed</h2>
          <p className="text-xs text-red-600 leading-relaxed bg-red-50 p-3 rounded-lg border border-red-100">
            {message}
          </p>
          <button
            onClick={() => router.push('/integrations')}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors"
          >
            Return to Integrations
          </button>
        </>
      )}
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-8 text-center space-y-4">
            <div className="w-10 h-10 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Loading OAuth verification...</p>
          </div>
        }
      >
        <OAuthCallbackContent />
      </Suspense>
    </div>
  );
}
