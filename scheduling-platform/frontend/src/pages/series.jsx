import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { api } from '@/lib/api';

const RECURRENCE_LABELS = { weekly: 'Weekly', every_n_weeks: 'Every N Weeks', monthly_date: 'Monthly (by date)', monthly_weekday: 'Monthly (by weekday)' };

export default function SeriesPage() {
  const [seriesList, setSeriesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [seriesDetail, setSeriesDetail] = useState(null);
  const [clients, setClients] = useState([]);
  const [providers, setProviders] = useState([]);
  const [services, setServices] = useState([]);
  const [form, setForm] = useState({
    client_id: '', booking_source: 'phone', recurrence_type: 'weekly', recurrence_config: '{}',
    start_date: new Date().toISOString().split('T')[0], end_date: '', max_occurrences: 12,
    start_time: '10:00', notes: '', segments: [{ provider_id: '', service_id: '', duration_minutes: 30 }],
  });
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadSeries(); }, []);

  async function loadSeries() {
    setLoading(true);
    try { const data = await api.listSeries(); setSeriesList(data.series); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function openCreate() {
    setShowCreate(true); setError('');
    try {
      const [c, p, s] = await Promise.all([api.listClients(), api.listUsers(), api.listServices()]);
      setClients(c.clients); setProviders(p.users.filter((u) => u.is_provider && u.is_active)); setServices(s.services.filter((sv) => sv.is_active));
    } catch (err) { console.error(err); }
  }

  async function loadDetail(id) {
    setSelectedSeries(id);
    try { const data = await api.getSeries(id); setSeriesDetail(data); }
    catch (err) { console.error(err); }
  }

  async function handleCreate(e) {
    e.preventDefault(); setError(''); setCreating(true);
    try {
      let config = {};
      if (form.recurrence_type === 'weekly') config = { day_of_week: new Date(form.start_date).getDay() };
      else if (form.recurrence_type === 'every_n_weeks') config = { day_of_week: new Date(form.start_date).getDay(), n: 2 };
      else if (form.recurrence_type === 'monthly_date') config = { day_of_month: new Date(form.start_date).getDate() };
      else if (form.recurrence_type === 'monthly_weekday') {
        const d = new Date(form.start_date); config = { weekday: d.getDay(), week_number: Math.ceil(d.getDate() / 7) };
      }
      await api.createSeries({
        client_id: form.client_id, booking_source: form.booking_source, recurrence_type: form.recurrence_type,
        recurrence_config: config, start_date: form.start_date, end_date: form.end_date || undefined,
        max_occurrences: form.max_occurrences || undefined, start_time: form.start_time, notes: form.notes || undefined,
        segments: form.segments.map((seg) => ({ provider_id: seg.provider_id, service_id: seg.service_id, duration_minutes: seg.duration_minutes })),
      });
      setShowCreate(false); loadSeries();
    } catch (err) { setError(err.message || 'Failed to create series'); }
    finally { setCreating(false); }
  }

  async function handleToggleActive(id, current) {
    try { await api.updateSeries(id, { is_active: !current }); loadSeries(); }
    catch (err) { alert(err.message); }
  }

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Recurring Series</h1><p className="text-sm text-gray-500">{seriesList.length} series</p></div>
        <button onClick={openCreate} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">+ New Series</button>
      </div>

      {loading ? <div className="text-gray-500">Loading...</div> : seriesList.length === 0 ? (
        <div className="rounded-lg bg-white p-6 text-center text-gray-500 shadow-sm">No recurring series yet</div>
      ) : (
        <div className="space-y-3">
          {seriesList.map((s) => (
            <div key={s.id} className="rounded-lg bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{s.client_name}</span>
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">{RECURRENCE_LABELS[s.recurrence_type]}</span>
                    <span className={`rounded px-2 py-0.5 text-xs ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{s.is_active ? 'Active' : 'Paused'}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">Started {new Date(s.start_date).toLocaleDateString()} · {s.occurrence_with_visit}/{s.occurrence_total} occurrences booked{s.end_date && ` · Ends ${new Date(s.end_date).toLocaleDateString()}`}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => loadDetail(s.id)} className="text-sm text-primary-600 hover:text-primary-700">Details</button>
                  <button onClick={() => handleToggleActive(s.id, s.is_active)} className="text-sm text-gray-500 hover:text-gray-700">{s.is_active ? 'Pause' : 'Resume'}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedSeries && seriesDetail && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-10 pb-10">
          <div className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{seriesDetail.series.client_name} — {RECURRENCE_LABELS[seriesDetail.series.recurrence_type]}</h2>
              <button onClick={() => { setSelectedSeries(null); setSeriesDetail(null); }} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="mb-4 grid grid-cols-3 gap-4 text-sm">
              <div><span className="font-medium text-gray-700">Start:</span> {new Date(seriesDetail.series.start_date).toLocaleDateString()}</div>
              <div><span className="font-medium text-gray-700">End:</span> {seriesDetail.series.end_date ? new Date(seriesDetail.series.end_date).toLocaleDateString() : 'Ongoing'}</div>
              <div><span className="font-medium text-gray-700">Status:</span> {seriesDetail.series.is_active ? 'Active' : 'Paused'}</div>
            </div>
            <h3 className="mb-2 font-medium text-gray-900">Occurrences</h3>
            <div className="max-h-96 overflow-y-auto rounded border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left text-xs text-gray-500">#</th><th className="px-3 py-2 text-left text-xs text-gray-500">Date</th><th className="px-3 py-2 text-left text-xs text-gray-500">Status</th><th className="px-3 py-2 text-left text-xs text-gray-500">Exception</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {seriesDetail.occurrences.map((occ) => (
                    <tr key={occ.id}>
                      <td className="px-3 py-2 text-gray-500">{occ.occurrence_number}</td>
                      <td className="px-3 py-2">{new Date(occ.occurrence_date).toLocaleDateString()}</td>
                      <td className="px-3 py-2">
                        {occ.visit_id ? <span className={`rounded px-2 py-0.5 text-xs ${occ.visit_status === 'completed' ? 'bg-green-100 text-green-700' : occ.visit_status === 'no_show' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{occ.visit_status || 'booked'}</span> : <span className="text-xs text-gray-400">Not yet booked</span>}
                      </td>
                      <td className="px-3 py-2">{occ.is_exception && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Modified</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-10 pb-10">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">New Recurring Series</h2>
            {error && <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <form onSubmit={handleCreate}>
              <div className="mb-3 grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700">Client *</label><select required value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"><option value="">Select...</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-gray-700">Source *</label><select value={form.booking_source} onChange={(e) => setForm({ ...form, booking_source: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"><option value="phone">Phone</option><option value="walk_in">Walk-in</option><option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option><option value="contact_form">Contact Form</option><option value="other">Other</option></select></div>
              </div>
              <div className="mb-3 grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700">Recurrence *</label><select value={form.recurrence_type} onChange={(e) => setForm({ ...form, recurrence_type: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"><option value="weekly">Weekly</option><option value="every_n_weeks">Every N Weeks</option><option value="monthly_date">Monthly (by date)</option><option value="monthly_weekday">Monthly (by weekday)</option></select></div>
                <div><label className="block text-sm font-medium text-gray-700">Start Date *</label><input type="date" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
              </div>
              <div className="mb-3 grid grid-cols-3 gap-3">
                <div><label className="block text-sm font-medium text-gray-700">End Date</label><input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
                <div><label className="block text-sm font-medium text-gray-700">Max Occurrences</label><input type="number" min={1} value={form.max_occurrences} onChange={(e) => setForm({ ...form, max_occurrences: Number(e.target.value) })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
                <div><label className="block text-sm font-medium text-gray-700">Time *</label><input type="time" required value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
              </div>
              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Template Segments</label>
                  <button type="button" onClick={() => setForm({ ...form, segments: [...form.segments, { provider_id: '', service_id: '', duration_minutes: 30 }] })} className="text-sm text-primary-600 hover:text-primary-700">+ Add</button>
                </div>
                {form.segments.map((seg, i) => (
                  <div key={i} className="mb-2 flex items-end gap-2">
                    <select required value={seg.provider_id} onChange={(e) => { const ns = [...form.segments]; ns[i].provider_id = e.target.value; setForm({ ...form, segments: ns }); }} className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"><option value="">Provider...</option>{providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                    <select required value={seg.service_id} onChange={(e) => { const ns = [...form.segments]; ns[i].service_id = e.target.value; const svc = services.find((s) => s.id === e.target.value); if (svc) ns[i].duration_minutes = svc.duration_minutes; setForm({ ...form, segments: ns }); }} className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"><option value="">Service...</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes}m)</option>)}</select>
                    <input type="number" min={5} value={seg.duration_minutes} onChange={(e) => { const ns = [...form.segments]; ns[i].duration_minutes = Number(e.target.value); setForm({ ...form, segments: ns }); }} className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                    {form.segments.length > 1 && <button type="button" onClick={() => setForm({ ...form, segments: form.segments.filter((_, j) => j !== i) })} className="text-red-400 hover:text-red-600">✕</button>}
                  </div>
                ))}
              </div>
              <div className="mb-6"><label className="block text-sm font-medium text-gray-700">Notes</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" rows={2} /></div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-md px-4 py-2 text-sm text-gray-600">Cancel</button>
                <button type="submit" disabled={creating} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">{creating ? 'Creating...' : 'Create Series'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
