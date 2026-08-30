import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function DashboardPage() {
  const { user } = useAuth();
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTodayVisits();
  }, []);

  async function loadTodayVisits() {
    try {
      const today = new Date();
      const start = new Date(today);
      start.setHours(0, 0, 0, 0);
      const end = new Date(today);
      end.setHours(23, 59, 59, 999);

      const data = await api.listVisits({
        from: start.toISOString(),
        to: end.toISOString(),
      });
      setVisits(data.visits);
    } catch (err) {
      console.error('Failed to load visits:', err);
    } finally {
      setLoading(false);
    }
  }

  const statusCounts = {
    booked: visits.filter((v) => v.status === 'booked').length,
    arrived: visits.filter((v) => v.status === 'arrived').length,
    completed: visits.filter((v) => v.status === 'completed').length,
    no_show: visits.filter((v) => v.status === 'no_show').length,
  };

  const isAdmin = user?.role === 'owner' || user?.role === 'admin';

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {isAdmin && (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Booked Today" value={statusCounts.booked} color="bg-blue-50 text-blue-700" />
          <StatCard label="Checked In" value={statusCounts.arrived} color="bg-yellow-50 text-yellow-700" />
          <StatCard label="Completed" value={statusCounts.completed} color="bg-green-50 text-green-700" />
          <StatCard label="No-Shows" value={statusCounts.no_show} color="bg-red-50 text-red-700" />
        </div>
      )}

      <div className="rounded-lg bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Today&apos;s Appointments</h2>
        </div>

        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading...</div>
        ) : visits.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No appointments today</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {visits.map((visit) => (
              <div key={visit.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{visit.client_name}</p>
                    <StatusBadge status={visit.status} />
                    {visit.segments.length > 1 && (
                      <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                        Multi-service
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {new Date(visit.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    {' – '}
                    {new Date(visit.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    {' · '}
                    {visit.segments.map((s) => s.service_name).join(', ')}
                    {' · '}
                    {visit.segments.map((s) => s.provider_name).join(', ')}
                  </p>
                </div>
                <span className="text-xs text-gray-400 capitalize">{visit.booking_source.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className={`rounded-lg p-4 ${color}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    booked: 'bg-blue-100 text-blue-800',
    arrived: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    no_show: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
