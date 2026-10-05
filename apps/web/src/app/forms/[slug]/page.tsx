'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { CheckCircle2, AlertCircle, Send, Sparkles } from 'lucide-react';
import { ApiClient } from '../../../lib/api';

export default function PublicHostedFormPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;

  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form values
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [thankYouMessage, setThankYouMessage] = useState('');

  useEffect(() => {
    const fetchFormSchema = async () => {
      try {
        const res = await ApiClient.get(`/forms/${slug}`);
        if (res.data) {
          setForm(res.data);
          setThankYouMessage(res.data.thankYouMessage);
        }
      } catch (err: any) {
        setError(err.message || 'Form not found or has been disabled.');
      } finally {
        setLoading(false);
      }
    };

    if (slug) fetchFormSchema();
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // Extract UTM tags from current URL
    const utm: Record<string, string> = {};
    searchParams.forEach((val, key) => {
      if (key.startsWith('utm_') || key === 'ref' || key === 'source') {
        utm[key] = val;
      }
    });

    try {
      const res = await ApiClient.post(`/forms/${slug}/submit`, {
        payload: formData,
        utm,
      });

      if (res.success) {
        setSubmitted(true);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit form. Please check the fields.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-slate-200 p-8 max-w-md w-full text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
          <h2 className="text-base font-bold text-slate-800">Form Unavailable</h2>
          <p className="text-xs text-slate-500 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-2">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            {form.organization?.name?.slice(0, 2).toUpperCase() || 'SM'}
          </div>
        </div>
        <h2 className="text-center text-xl font-bold tracking-tight text-slate-900">
          {form.name}
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500">
          {form.organization?.name}
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-xl sm:px-10">
          {submitted ? (
            <div className="text-center py-6 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <h3 className="text-lg font-bold text-slate-900">Submission Received!</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{thankYouMessage}</p>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setFormData({});
                }}
                className="mt-4 text-xs font-semibold text-slate-700 hover:underline"
              >
                Submit another response
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md">
                  {error}
                </div>
              )}

              {form.fieldsConfig?.map((field: any) => (
                <div key={field.id}>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>

                  {field.type === 'select' ? (
                    <select
                      required={field.required}
                      value={formData[field.name] || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, [field.name]: e.target.value })
                      }
                      className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                    >
                      <option value="">Select an option</option>
                      {field.options?.map((opt: string) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      rows={3}
                      required={field.required}
                      placeholder={field.placeholder || ''}
                      value={formData[field.name] || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, [field.name]: e.target.value })
                      }
                      className="w-full text-xs border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  ) : (
                    <input
                      type={field.type}
                      required={field.required}
                      placeholder={field.placeholder || ''}
                      value={formData[field.name] || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, [field.name]: e.target.value })
                      }
                      className="w-full text-xs border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  )}
                </div>
              ))}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent rounded-md shadow-sm text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition-colors mt-2"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{form.submitButtonText || 'Submit'}</span>
                    <Send className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
