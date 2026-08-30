import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { api } from '@/lib/api';

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', phone: '', email: '' });
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients(q) {
    setLoading(true);
    try {
      const data = await api.listClients(q || undefined);
      setClients(data.clients);
    } catch (err) {
      console.error('Failed to load clients:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    loadClients(search);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      await api.createClient(createForm);
      setShowCreate(false);
      setCreateForm({ name: '', phone: '', email: '' });
      loadClients(search);
    } catch (err) {
      setCreateError(err.message || 'Failed to create client');
    } finally {
      setCreating(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500">{clients.length} clients</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          + New Client
        </button>
      </div>

      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone..."
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <button type="submit" className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(''); loadClients(); }}
              className="rounded-md px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      <div className="rounded-lg bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading...</div>
        ) : clients.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No clients found</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Visits</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{client.name}</span>
                      {client.is_flagged && (
                        <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          ⚠️ Flagged
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{client.phone}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{client.email || '—'}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {client.no_show_count + client.cancellation_count}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex gap-1">
                      {client.no_show_count > 0 && (
                        <span className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-600">
                          {client.no_show_count} no-show
                        </span>
                      )}
                      {client.cancellation_count > 0 && (
                        <span className="rounded bg-yellow-50 px-2 py-0.5 text-xs text-yellow-600">
                          {client.cancellation_count} cancelled
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">New Client</h2>
            {createError && (
              <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{createError}</div>
            )}
            <form onSubmit={handleCreate}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Name *</label>
                <input
                  type="text" required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Phone *</label>
                <input
                  type="tel" required
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  type="submit" disabled={creating}
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
