import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function ServicesPage() {
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', duration_minutes: 30, category_id: '', open_to_any_provider: true });
  const [catForm, setCatForm] = useState({ name: '', description: '' });
  const [error, setError] = useState('');

  const isAdmin = user?.role === 'owner' || user?.role === 'admin';

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [svcData, catData] = await Promise.all([api.listServices(), api.listCategories()]);
      setServices(svcData.services);
      setCategories(catData.categories);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleCreateService(e) {
    e.preventDefault();
    setError('');
    try {
      await api.createService({
        name: createForm.name,
        description: createForm.description || undefined,
        duration_minutes: createForm.duration_minutes,
        category_id: createForm.category_id || undefined,
        open_to_any_provider: createForm.open_to_any_provider,
      });
      setShowCreate(false);
      setCreateForm({ name: '', description: '', duration_minutes: 30, category_id: '', open_to_any_provider: true });
      loadData();
    } catch (err) { setError(err.message); }
  }

  async function handleCreateCategory(e) {
    e.preventDefault();
    try {
      await api.createCategory(catForm);
      setShowCategoryModal(false);
      setCatForm({ name: '', description: '' });
      loadData();
    } catch (err) { setError(err.message); }
  }

  async function handleDelete(id) {
    if (!confirm('Deactivate this service?')) return;
    try { await api.deleteService(id); loadData(); }
    catch (err) { setError(err.message); }
  }

  const grouped = {};
  for (const svc of services) {
    const catName = svc.category_name || 'Uncategorized';
    if (!grouped[catName]) grouped[catName] = [];
    grouped[catName].push(svc);
  }

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Services</h1>
          <p className="text-sm text-gray-500">{services.length} services across {categories.length} categories</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button onClick={() => setShowCategoryModal(true)} className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">+ Category</button>
            <button onClick={() => setShowCreate(true)} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">+ New Service</button>
          </div>
        )}
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? <div className="text-center text-gray-500">Loading...</div> :
       Object.keys(grouped).length === 0 ? <div className="rounded-lg bg-white p-6 text-center text-gray-500 shadow-sm">No services yet</div> : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([catName, svcs]) => (
            <div key={catName} className="rounded-lg bg-white shadow-sm">
              <div className="border-b border-gray-200 px-6 py-3"><h3 className="font-semibold text-gray-900">{catName}</h3></div>
              <div className="divide-y divide-gray-100">
                {svcs.map((svc) => (
                  <div key={svc.id} className="flex items-center justify-between px-6 py-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{svc.name}</span>
                        {!svc.open_to_any_provider && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Qualification required</span>}
                        {!svc.is_active && <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Inactive</span>}
                      </div>
                      {svc.description && <p className="mt-1 text-sm text-gray-500">{svc.description}</p>}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-500">{svc.duration_minutes} min</span>
                      {isAdmin && svc.is_active && <button onClick={() => handleDelete(svc.id)} className="text-sm text-red-500 hover:text-red-700">Deactivate</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">New Service</h2>
            <form onSubmit={handleCreateService}>
              <div className="mb-3"><label className="block text-sm font-medium text-gray-700">Name *</label><input type="text" required value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
              <div className="mb-3"><label className="block text-sm font-medium text-gray-700">Description</label><input type="text" value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
              <div className="mb-3"><label className="block text-sm font-medium text-gray-700">Duration (minutes) *</label><input type="number" required min={5} value={createForm.duration_minutes} onChange={(e) => setCreateForm({ ...createForm, duration_minutes: Number(e.target.value) })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <select value={createForm.category_id} onChange={(e) => setCreateForm({ ...createForm, category_id: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  <option value="">None</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="mb-6"><label className="flex items-center gap-2 text-sm font-medium text-gray-700"><input type="checkbox" checked={createForm.open_to_any_provider} onChange={(e) => setCreateForm({ ...createForm, open_to_any_provider: e.target.checked })} className="rounded border-gray-300" />Open to any provider</label></div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-md px-4 py-2 text-sm text-gray-600">Cancel</button>
                <button type="submit" className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">New Category</h2>
            <form onSubmit={handleCreateCategory}>
              <div className="mb-3"><label className="block text-sm font-medium text-gray-700">Name *</label><input type="text" required value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
              <div className="mb-6"><label className="block text-sm font-medium text-gray-700">Description</label><input type="text" value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCategoryModal(false)} className="rounded-md px-4 py-2 text-sm text-gray-600">Cancel</button>
                <button type="submit" className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
