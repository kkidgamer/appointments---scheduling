import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function VisitsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'owner' || user?.role === 'admin';
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(() => new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('');
  const [showBooking, setShowBooking] = useState(false);
  const [clients, setClients] = useState([]);
  const [providers, setProviders] = useState([]);
  const [services, setServices] = useState([]);
  const [bookingError, setBookingError] = useState('');
  const [booking, setBooking] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    client_id: '', booking_source: 'phone',
    date: new Date().toISOString().split('T')[0],
    start_time: '09:00', notes: '',
    segments: [{ provider_id: '', service_id: '', start_time: '09:00', duration_minutes: 30 }],
  });

  useEffect(() => { loadVisits(); }, [dateFilter, statusFilter]);

  async function loadVisits() {
    setLoading(true);
    try {
      const from = new Date(dateFilter); from.setHours(0, 0, 0, 0);
      const to = new Date(dateFilter); to.setHours(23, 59, 59, 999);
      const data = await api.listVisits({ from: from.toISOString(), to: to.toISOString(), status: statusFilter || undefined });
      setVisits(data.visits);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function openBooking() {
    setShowBooking(true); setBookingError('');
    try {
      const [clientData, providerData, serviceData] = await Promise.all([api.listClients(), api.listUsers(), api.listServices()]);
      setClients(clientData.clients);
      setProviders(providerData.users.filter((u) => u.is_provider && u.is_active));
      setServices(serviceData.services.filter((s) => s.is_active));
    } catch (err) { console.error(err); }
  }

  function addSegment() {
    setBookingForm({ ...bookingForm, segments: [...bookingForm.segments, { provider_id: '', service_id: '', start_time: bookingForm.start_time, duration_minutes: 30 }] });
  }

  function removeSegment(index) {
    if (bookingForm.segments.length <= 1) return;
    setBookingForm({ ...bookingForm, segments: bookingForm.segments.filter((_, i) => i !== index) });
  }

  function updateSegment(index, field, value) {
    const newSegments = [...bookingForm.segments];
    newSegments[index][field] = value;
    if (field === 'service_id') {
      const svc = services.find((s) => s.id === value);
      if (svc) newSegments[index].duration_minutes = svc.duration_minutes;
    }
    setBookingForm({ ...bookingForm, segments: newSegments });
  }

  async function handleBook(e) {
    e.preventDefault(); setBookingError(''); setBooking(true);
    try {
      const visitStart = `${bookingForm.date}T${bookingForm.start_time}:00`;
      let latestEnd = new Date(visitStart).getTime();
      for (const seg of bookingForm.segments) {
        const segStart = new Date(`${bookingForm.date}T${seg.start_time}:00`).getTime();
        const segEnd = segStart + seg.duration_minutes * 60000;
        if (segEnd > latestEnd) latestEnd = segEnd;
      }
      const segments = bookingForm.segments.map((seg) => {
        const segStart = new Date(`${bookingForm.date}T${seg.start_time}:00`);
        const segEnd = new Date(segStart.getTime() + seg.duration_minutes * 60000);
        return { provider_id: seg.provider_id, service_id: seg.service_id, start_time: segStart.toISOString(), end_time: segEnd.toISOString(), duration_minutes: seg.duration_minutes };
      });
      await api.createVisit({ client_id: bookingForm.client_id, booking_source: bookingForm.booking_source, start_time: new Date(visitStart).toISOString(), end_time: new Date(latestEnd).toISOString(), notes: bookingForm.notes || undefined, segments });
      setShowBooking(false);
      setBookingForm({ client_id: '', booking_source: 'phone', date: new Date().toISOString().split('T')[0], start_time: '09:00', notes: '', segments: [{ provider_id: '', service_id: '', start_time: '09:00', duration_minutes: 30 }] });
      loadVisits();
    } catch (err) { setBookingError(err.message || 'Booking failed'); }
    finally { setBooking(false); }
  }

  async function handleStatusChange(visitId, status) {
    try { await api.updateVisitStatus(visitId, status); loadVisits(); }
    catch (err) { alert(err.message); }
  }

  const sourceLabels = { walk_in: '🚶 Walk-in', whatsapp: '💬 WhatsApp', instagram: '📸 Instagram', phone: '📞 Phone', contact_form: '📝 Form', other: '❓ Other' };
  const statusColors = { booked: 'bg-blue-100 text-blue-800', arrived: 'bg-yellow-100 text-yellow-800', completed: 'bg-green-100 text-green-800', no_show: 'bg-red-100 text-red-800', cancelled: 'bg-gray-100 text-gray-800' };

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Visits</h1><p className="text-sm text-gray-500">{visits.length} appointments</p></div>
        {isAdmin && <button onClick={openBooking} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">+ New Visit</button>}
      </div>

      <div className="mb-6 flex gap-3">
        <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="booked">Booked</option><option value="arrived">Arrived</option><option value="completed">Completed</option><option value="no_show">No-Show</option><option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="rounded-lg bg-white shadow-sm">
        {loading ? <div className="p-6 text-center text-gray-500">Loading...</div> :
         visits.length === 0 ? <div className="p-6 text-center text-gray-500">No visits for this date</div> : (
          <div className="divide-y divide-gray-100">
            {visits.map((visit) => (
              <div key={visit.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{visit.client_name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[visit.status] || 'bg-gray-100'}`}>{visit.status.replace('_', ' ')}</span>
                        {visit.segments.length > 1 && <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">{visit.segments.length} services</span>}
                        {visit.is_locked && <span className="text-xs text-gray-400">🔒</span>}
                      </div>
                      <p className="text-sm text-gray-500">
                        {new Date(visit.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – {new Date(visit.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        · {visit.segments.map((s) => s.service_name).join(' + ')} · {visit.segments.map((s) => s.provider_name).join(', ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{sourceLabels[visit.booking_source] || visit.booking_source}</span>
                    {isAdmin && !visit.is_locked && visit.status === 'booked' && (
                      <div className="flex gap-1">
                        <button onClick={() => handleStatusChange(visit.id, 'arrived')} className="rounded px-2 py-1 text-xs text-yellow-600 hover:bg-yellow-50">Check in</button>
                        <button onClick={() => handleStatusChange(visit.id, 'cancelled')} className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50">Cancel</button>
                      </div>
                    )}
                    {isAdmin && visit.status === 'arrived' && <button onClick={() => handleStatusChange(visit.id, 'completed')} className="rounded px-2 py-1 text-xs text-green-600 hover:bg-green-50">Complete</button>}
                    {isAdmin && visit.status === 'booked' && <button onClick={() => handleStatusChange(visit.id, 'no_show')} className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50">No-show</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showBooking && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-10 pb-10">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">New Visit</h2>
            {bookingError && <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{bookingError}</div>}
            <form onSubmit={handleBook}>
              <div className="mb-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Client *</label>
                  <select required value={bookingForm.client_id} onChange={(e) => setBookingForm({ ...bookingForm, client_id: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                    <option value="">Select client...</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.phone}){c.is_flagged ? ' ⚠️' : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Booking Source *</label>
                  <select required value={bookingForm.booking_source} onChange={(e) => setBookingForm({ ...bookingForm, booking_source: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                    <option value="phone">Phone</option><option value="walk_in">Walk-in</option><option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option><option value="contact_form">Contact Form</option><option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="mb-4 grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700">Date *</label><input type="date" required value={bookingForm.date} onChange={(e) => setBookingForm({ ...bookingForm, date: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
                <div><label className="block text-sm font-medium text-gray-700">Visit Start *</label><input type="time" required value={bookingForm.start_time} onChange={(e) => setBookingForm({ ...bookingForm, start_time: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
              </div>
              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Service Segments *</label>
                  <button type="button" onClick={addSegment} className="text-sm text-primary-600 hover:text-primary-700">+ Add segment</button>
                </div>
                <div className="space-y-3">
                  {bookingForm.segments.map((seg, i) => (
                    <div key={i} className="flex items-end gap-2 rounded-md border border-gray-200 p-3">
                      <div className="flex-1"><label className="block text-xs text-gray-500">Provider</label><select required value={seg.provider_id} onChange={(e) => updateSegment(i, 'provider_id', e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"><option value="">Select...</option>{providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                      <div className="flex-1"><label className="block text-xs text-gray-500">Service</label><select required value={seg.service_id} onChange={(e) => updateSegment(i, 'service_id', e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"><option value="">Select...</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes}m)</option>)}</select></div>
                      <div className="w-24"><label className="block text-xs text-gray-500">Start</label><input type="time" required value={seg.start_time} onChange={(e) => updateSegment(i, 'start_time', e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" /></div>
                      <div className="w-20"><label className="block text-xs text-gray-500">Duration</label><input type="number" required min={5} step={5} value={seg.duration_minutes} onChange={(e) => updateSegment(i, 'duration_minutes', Number(e.target.value))} className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" /></div>
                      {bookingForm.segments.length > 1 && <button type="button" onClick={() => removeSegment(i)} className="mb-0.5 text-red-400 hover:text-red-600">✕</button>}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mb-6"><label className="block text-sm font-medium text-gray-700">Notes</label><textarea value={bookingForm.notes} onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" rows={2} /></div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowBooking(false)} className="rounded-md px-4 py-2 text-sm text-gray-600">Cancel</button>
                <button type="submit" disabled={booking} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">{booking ? 'Booking...' : 'Book Visit'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
