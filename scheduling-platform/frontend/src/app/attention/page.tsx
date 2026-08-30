'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { api } from '@/lib/api';
import type { AttentionItem } from '@/types';

const ISSUE_TYPE_LABELS: Record<string, string> = {
  conflict: '⚠️ Conflict',
  qualification_mismatch: '🎓 Qualification',
  availability_change: '📅 Availability',
  series_at_risk: '🔄 Series at Risk',
  client_flag: '🚩 Client Flag',
};

export default function AttentionPage() {
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');
  const [typeFilter, setTypeFilter] = useState('');
  const [counts, setCounts] = useState({ urgent: 0, informational: 0, total: 0 });
  const [resolveModal, setResolveModal] = useState<{ item: AttentionItem; action: 'resolved' | 'dismissed' } | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => { loadItems(); loadCounts(); }, [severityFilter, statusFilter, typeFilter]);

  async function loadItems() {
    setLoading(true);
    try {
      const data = await api.listAttention({
        severity: severityFilter || undefined,
        status: statusFilter || undefined,
        issue_type: typeFilter || undefined,
      });
      setItems(data.items);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function loadCounts() {
    try {
      const data = await api.getAttentionCounts();
      setCounts(data);
    } catch (err) { console.error(err); }
  }

  async function handleSeverityOverride(id: string, severity: string) {
    try {
      await api.updateAttention(id, { severity });
      loadItems();
    } catch (err: any) { alert(err.message); }
  }

  async function handleResolve() {
    if (!resolveModal) return;
    try {
      await api.updateAttention(resolveModal.item.id, {
        status: resolveModal.action,
        resolution_notes: notes || undefined,
      });
      setResolveModal(null);
      setNotes('');
      loadItems();
      loadCounts();
    } catch (err: any) { alert(err.message); }
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Needs Attention</h1>
        <p className="text-sm text-gray-500">{counts.total} open items</p>
      </div>

      {/* Severity Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          onClick={() => setSeverityFilter(severityFilter === 'urgent' ? '' : 'urgent')}
          className={`rounded-lg p-4 text-left transition-colors ${
            severityFilter === 'urgent' ? 'bg-red-100 ring-2 ring-red-400' : 'bg-red-50 hover:bg-red-100'
          }`}
        >
          <div className="text-sm font-medium text-red-700">Urgent</div>
          <div className="mt-1 text-3xl font-bold text-red-900">{counts.urgent}</div>
          <div className="text-xs text-red-600">Needs action soon</div>
        </button>
        <button
          onClick={() => setSeverityFilter(severityFilter === 'informational' ? '' : 'informational')}
          className={`rounded-lg p-4 text-left transition-colors ${
            severityFilter === 'informational' ? 'bg-blue-100 ring-2 ring-blue-400' : 'bg-blue-50 hover:bg-blue-100'
          }`}
        >
          <div className="text-sm font-medium text-blue-700">Informational</div>
          <div className="mt-1 text-3xl font-bold text-blue-900">{counts.informational}</div>
          <div className="text-xs text-blue-600">Lower priority, FYI</div>
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
          <option value="">All</option>
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All types</option>
          <option value="conflict">Conflict</option>
          <option value="qualification_mismatch">Qualification</option>
          <option value="availability_change">Availability</option>
          <option value="series_at_risk">Series at Risk</option>
          <option value="client_flag">Client Flag</option>
        </select>
        {severityFilter && (
          <button onClick={() => setSeverityFilter('')} className="text-sm text-gray-500 hover:text-gray-700">
            Clear severity filter
          </button>
        )}
      </div>

      {/* Items List */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center text-gray-500">Loading...</div>
        ) : items.length === 0 ? (
          <div className="rounded-lg bg-white p-6 text-center text-gray-500 shadow-sm">
            {statusFilter === 'open' ? '✅ All clear — no open attention items' : 'No items match filters'}
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`rounded-lg bg-white p-4 shadow-sm border-l-4 ${
                item.severity === 'urgent' ? 'border-red-500' : 'border-blue-400'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                      item.severity === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {item.severity}
                    </span>
                    <span className="text-sm text-gray-500">{ISSUE_TYPE_LABELS[item.issue_type] || item.issue_type}</span>
                  </div>
                  <h3 className="mt-1 font-medium text-gray-900">{item.title}</h3>
                  {item.description && <p className="mt-1 text-sm text-gray-500">{item.description}</p>}
                  <div className="mt-2 flex gap-4 text-xs text-gray-400">
                    {item.provider_name && <span>Provider: {item.provider_name}</span>}
                    {item.client_name && <span>Client: {item.client_name}</span>}
                    {item.visit_start_time && <span>Visit: {new Date(item.visit_start_time).toLocaleString()}</span>}
                  </div>
                </div>

                {item.status === 'open' && (
                  <div className="flex items-center gap-2 ml-4">
                    {/* Severity override */}
                    <select
                      value={item.severity}
                      onChange={(e) => handleSeverityOverride(item.id, e.target.value)}
                      className="rounded border border-gray-300 px-2 py-1 text-xs"
                    >
                      <option value="urgent">Urgent</option>
                      <option value="informational">Informational</option>
                    </select>
                    <button
                      onClick={() => setResolveModal({ item, action: 'resolved' })}
                      className="rounded bg-green-50 px-3 py-1 text-xs text-green-700 hover:bg-green-100"
                    >
                      Resolve
                    </button>
                    <button
                      onClick={() => setResolveModal({ item, action: 'dismissed' })}
                      className="rounded bg-gray-50 px-3 py-1 text-xs text-gray-600 hover:bg-gray-100"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {item.status !== 'open' && (
                  <div className="ml-4 text-xs text-gray-400">
                    {item.status} by {item.resolved_at ? new Date(item.resolved_at).toLocaleDateString() : '—'}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Resolve/Dismiss Modal */}
      {resolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">
              {resolveModal.action === 'resolved' ? 'Resolve' : 'Dismiss'} Item
            </h2>
            <p className="mb-4 text-sm text-gray-500">{resolveModal.item.title}</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Resolution Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                rows={3}
                placeholder="Optional notes about how this was resolved..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setResolveModal(null); setNotes(''); }} className="rounded-md px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button
                onClick={handleResolve}
                className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
                  resolveModal.action === 'resolved' ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'
                }`}
              >
                {resolveModal.action === 'resolved' ? 'Resolve' : 'Dismiss'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
