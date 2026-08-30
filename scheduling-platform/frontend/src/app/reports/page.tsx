'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { api } from '@/lib/api';

export default function ReportsPage() {
  const [dashboard, setDashboard] = useState<any>(null);
  const [providers, setProviders] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => { loadReports(); }, []);

  async function loadReports() {
    setLoading(true);
    try {
      const [dash, prov, src] = await Promise.all([
        api.getDashboard(),
        api.getProviderReports(dateFrom, dateTo),
        api.getBookingSourceReports(dateFrom, dateTo),
      ]);
      setDashboard(dash);
      setProviders(prov.providers);
      setSources(src.sources);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  if (loading) return <DashboardLayout><div className="text-gray-500">Loading...</div></DashboardLayout>;
  if (!dashboard) return <DashboardLayout><div className="text-gray-500">Failed to load reports</div></DashboardLayout>;

  const totalSources = sources.reduce((sum: number, s: any) => sum + parseInt(s.count), 0);

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500">Business performance overview</p>
      </div>

      {/* Today's Stats */}
      <h2 className="mb-3 text-lg font-semibold text-gray-900">Today</h2>
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard label="Booked" value={dashboard.today.booked} color="bg-blue-50 text-blue-700" />
        <StatCard label="Checked In" value={dashboard.today.arrived} color="bg-yellow-50 text-yellow-700" />
        <StatCard label="Completed" value={dashboard.today.completed} color="bg-green-50 text-green-700" />
        <StatCard label="No-Shows" value={dashboard.today.no_show} color="bg-red-50 text-red-700" />
        <StatCard label="Cancelled" value={dashboard.today.cancelled} color="bg-gray-50 text-gray-700" />
      </div>

      {/* This Week */}
      <h2 className="mb-3 text-lg font-semibold text-gray-900">This Week</h2>
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total" value={dashboard.week.total} color="bg-primary-50 text-primary-700" />
        <StatCard label="Completed" value={dashboard.week.completed} color="bg-green-50 text-green-700" />
        <StatCard label="No-Shows" value={dashboard.week.no_show} color="bg-red-50 text-red-700" />
        <StatCard label="Cancelled" value={dashboard.week.cancelled} color="bg-gray-50 text-gray-700" />
      </div>

      {/* Business Overview */}
      <h2 className="mb-3 text-lg font-semibold text-gray-900">Business Overview</h2>
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Clients" value={dashboard.clients} color="bg-purple-50 text-purple-700" />
        <StatCard label="Active Providers" value={dashboard.providers} color="bg-teal-50 text-teal-700" />
        <StatCard label="Urgent Attention" value={dashboard.attention.urgent} color="bg-red-50 text-red-700" />
        <StatCard label="Informational" value={dashboard.attention.informational} color="bg-blue-50 text-blue-700" />
      </div>

      {/* Date Range Picker */}
      <div className="mb-6 flex items-center gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Period Analysis</h2>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
        <span className="text-gray-500">to</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
        <button onClick={loadReports} className="rounded-md bg-primary-600 px-3 py-1.5 text-sm text-white hover:bg-primary-700">Refresh</button>
      </div>

      {/* Provider Performance */}
      <div className="mb-8 rounded-lg bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-3">
          <h3 className="font-semibold text-gray-900">Provider Performance</h3>
        </div>
        {providers.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No data for this period</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Provider</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase text-gray-500">Segments</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase text-gray-500">Completed</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase text-gray-500">No-Shows</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase text-gray-500">Cancelled</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase text-gray-500">Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {providers.map((p: any) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-6 py-3 text-center text-sm text-gray-600">{p.segments_count}</td>
                  <td className="px-6 py-3 text-center text-sm">
                    <span className="rounded bg-green-100 px-2 py-0.5 text-green-700">{p.completed}</span>
                  </td>
                  <td className="px-6 py-3 text-center text-sm">
                    <span className="rounded bg-red-100 px-2 py-0.5 text-red-700">{p.no_shows}</span>
                  </td>
                  <td className="px-6 py-3 text-center text-sm">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">{p.cancelled}</span>
                  </td>
                  <td className="px-6 py-3 text-center text-sm text-gray-600">
                    {p.total_minutes ? `${Math.round(p.total_minutes / 60)}h ${p.total_minutes % 60}m` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Booking Sources */}
      <div className="mb-8 rounded-lg bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-3">
          <h3 className="font-semibold text-gray-900">Booking Sources</h3>
        </div>
        {sources.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No data for this period</div>
        ) : (
          <div className="p-6">
            <div className="space-y-3">
              {sources.map((s: any) => {
                const pct = totalSources > 0 ? (parseInt(s.count) / totalSources) * 100 : 0;
                return (
                  <div key={s.booking_source}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700 capitalize">{s.booking_source.replace('_', ' ')}</span>
                      <span className="text-gray-500">{s.count} ({Math.round(pct)}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100">
                      <div className="h-2 rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Upcoming */}
      {dashboard.upcoming_visits?.length > 0 && (
        <div className="rounded-lg bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-3">
            <h3 className="font-semibold text-gray-900">Upcoming Today</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {dashboard.upcoming_visits.map((v: any) => (
              <div key={v.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <span className="font-medium text-gray-900">{v.client_name}</span>
                  <span className="ml-2 text-sm text-gray-500">
                    {new Date(v.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  v.status === 'arrived' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {v.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-lg p-4 ${color}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value ?? 0}</p>
    </div>
  );
}
