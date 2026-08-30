'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { api } from '@/lib/api';

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  create: { label: 'Created', color: 'bg-green-100 text-green-700' },
  update: { label: 'Updated', color: 'bg-blue-100 text-blue-700' },
  delete: { label: 'Deleted', color: 'bg-red-100 text-red-700' },
  status_change: { label: 'Status Changed', color: 'bg-yellow-100 text-yellow-700' },
};

export default function AuditPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => { loadLog(); }, [entityFilter, actionFilter]);

  async function loadLog() {
    setLoading(true);
    try {
      const data = await api.listAuditLog({
        entity_type: entityFilter || undefined,
        action: actionFilter || undefined,
      });
      setEntries(data.entries);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <p className="text-sm text-gray-500">History of all changes</p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-3">
        <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All entities</option>
          <option value="visit">Visits</option>
          <option value="client">Clients</option>
          <option value="user">Users</option>
          <option value="service">Services</option>
          <option value="series">Series</option>
          <option value="attention">Attention</option>
        </select>
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All actions</option>
          <option value="create">Created</option>
          <option value="update">Updated</option>
          <option value="delete">Deleted</option>
          <option value="status_change">Status Change</option>
        </select>
      </div>

      {/* Log Entries */}
      <div className="rounded-lg bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No audit entries found</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {entries.map((entry) => {
              const actionInfo = ACTION_LABELS[entry.action] || { label: entry.action, color: 'bg-gray-100 text-gray-700' };
              return (
                <div key={entry.id} className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${actionInfo.color}`}>
                      {actionInfo.label}
                    </span>
                    <span className="text-sm font-medium text-gray-900 capitalize">{entry.entity_type}</span>
                    {entry.entity_id && (
                      <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-500">
                        {entry.entity_id.slice(0, 8)}...
                      </span>
                    )}
                    {entry.user_name && (
                      <span className="text-sm text-gray-500">by {entry.user_name}</span>
                    )}
                    <span className="ml-auto text-xs text-gray-400">
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  </div>

                  {entry.notes && (
                    <p className="mt-1 text-sm text-gray-500">{entry.notes}</p>
                  )}

                  {/* Show old/new values diff */}
                  {(entry.old_values || entry.new_values) && (
                    <div className="mt-2 rounded bg-gray-50 p-2 text-xs">
                      {entry.old_values && (
                        <div className="text-red-600">
                          <span className="font-medium">Old:</span>{' '}
                          {typeof entry.old_values === 'string' ? entry.old_values : JSON.stringify(entry.old_values)}
                        </div>
                      )}
                      {entry.new_values && (
                        <div className="text-green-600">
                          <span className="font-medium">New:</span>{' '}
                          {typeof entry.new_values === 'string' ? entry.new_values : JSON.stringify(entry.new_values)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
