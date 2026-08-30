import { useEffect, useState, useRef, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { api } from '@/lib/api';

const HOUR_HEIGHT = 60;
const START_HOUR = 7;
const END_HOUR = 21;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const SEGMENT_COLORS = [
  'bg-blue-200 border-blue-400 text-blue-900', 'bg-green-200 border-green-400 text-green-900',
  'bg-purple-200 border-purple-400 text-purple-900', 'bg-amber-200 border-amber-400 text-amber-900',
  'bg-rose-200 border-rose-400 text-rose-900', 'bg-teal-200 border-teal-400 text-teal-900',
];

function getTimeOffset(date) {
  const hours = date.getHours() + date.getMinutes() / 60;
  return (hours - START_HOUR) * HOUR_HEIGHT;
}

function DraggableBlock({ segment, visit, colorClass, top, height, onDragEnd, compact }) {
  const blockRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  function handleMouseDown(e) {
    if (e.button !== 0) return;
    const rect = blockRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragOffset(e.clientY - rect.top);
    setIsDragging(true);
  }

  function handleMouseUp(e) {
    if (!isDragging) return;
    setIsDragging(false);
    const calendar = blockRef.current?.closest('[class*="relative"]');
    if (!calendar) return;
    const rect = calendar.getBoundingClientRect();
    const y = e.clientY - rect.top + calendar.scrollTop - dragOffset;
    const hours = y / HOUR_HEIGHT + START_HOUR;
    const roundedHours = Math.round(hours * 4) / 4;
    const newStart = new Date(segment.start_time);
    newStart.setHours(Math.floor(roundedHours), (roundedHours % 1) * 60, 0, 0);
    onDragEnd(visit.id, segment.id, newStart);
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mouseup', handleMouseUp);
      return () => document.removeEventListener('mouseup', handleMouseUp);
    }
  }, [isDragging]);

  const start = new Date(segment.start_time);
  const end = new Date(segment.end_time);

  return (
    <div ref={blockRef} className={`absolute left-1 right-1 rounded border-l-3 cursor-grab active:cursor-grabbing overflow-hidden shadow-sm hover:shadow-md transition-shadow ${colorClass} ${isDragging ? 'z-20 opacity-80' : 'z-10'} ${visit.segments.length > 1 ? 'ring-2 ring-purple-400 ring-opacity-50' : ''}`}
      style={{ top, height: Math.max(height, 28), borderWidth: '0 0 0 3px' }} onMouseDown={handleMouseDown}
      title={`${visit.client_name} — ${segment.service_name}\n${start.toLocaleTimeString()} - ${end.toLocaleTimeString()}\nWith: ${segment.provider_name}${visit.segments.length > 1 ? '\n🔗 Multi-service visit' : ''}`}>
      <div className="px-1.5 py-0.5">
        <div className="truncate text-xs font-semibold">{visit.client_name}</div>
        {!compact && height > 28 && <><div className="truncate text-[11px] opacity-80">{segment.service_name}</div>{height > 48 && <div className="truncate text-[10px] opacity-60">{start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - {end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>}</>}
        {compact && height > 24 && <div className="truncate text-[10px] opacity-70">{segment.service_name}</div>}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const [viewMode, setViewMode] = useState('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [visits, setVisits] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [undoStack, setUndoStack] = useState([]);
  const [showToast, setShowToast] = useState('');

  useEffect(() => { loadData(); }, [currentDate, viewMode]);

  async function loadData() {
    setLoading(true);
    try {
      const from = getRangeStart(currentDate, viewMode);
      const to = getRangeEnd(currentDate, viewMode);
      const [visitData, providerData] = await Promise.all([api.listVisits({ from: from.toISOString(), to: to.toISOString() }), api.listUsers()]);
      setVisits(visitData.visits);
      setProviders(providerData.users.filter((u) => u.is_provider && u.is_active));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  function getRangeStart(date, mode) {
    const d = new Date(date);
    if (mode === 'week') { d.setDate(d.getDate() - d.getDay() + 1); }
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function getRangeEnd(date, mode) {
    const d = new Date(date);
    if (mode === 'week') { d.setDate(d.getDate() - d.getDay() + 7); }
    d.setHours(23, 59, 59, 999);
    return d;
  }

  function navigateDate(direction) {
    const d = new Date(currentDate);
    if (viewMode === 'week') d.setDate(d.getDate() + direction * 7);
    else d.setDate(d.getDate() + direction);
    setCurrentDate(d);
  }

  const handleDragEnd = useCallback(async (visitId, segmentId, newStartTime) => {
    const visit = visits.find((v) => v.id === visitId);
    if (!visit) return;
    const segment = visit.segments.find((s) => s.id === segmentId);
    if (!segment) return;
    setUndoStack((prev) => [...prev, { visitId, segmentId, oldStartTime: segment.start_time, oldEndTime: segment.end_time }]);
    const duration = segment.duration_minutes * 60000;
    const newEndTime = new Date(newStartTime.getTime() + duration);
    try {
      const visitStart = new Date(Math.min(new Date(visit.start_time).getTime(), newStartTime.getTime()));
      const visitEnd = new Date(Math.max(new Date(visit.end_time).getTime(), newEndTime.getTime()));
      await api.updateVisit(visitId, { start_time: visitStart.toISOString(), end_time: visitEnd.toISOString() });
      showToastMsg(`Moved ${segment.service_name} to ${newStartTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`);
      loadData();
    } catch (err) { showToastMsg(`Failed: ${err.message}`); setUndoStack((prev) => prev.slice(0, -1)); }
  }, [visits]);

  async function handleUndo() {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    try { await api.updateVisit(last.visitId, { start_time: last.oldStartTime, end_time: last.oldEndTime }); showToastMsg('Undone'); loadData(); }
    catch (err) { showToastMsg(`Undo failed: ${err.message}`); }
  }

  function showToastMsg(msg) { setShowToast(msg); setTimeout(() => setShowToast(''), 3000); }

  const dateLabel = currentDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const weekDays = [];
  if (viewMode === 'week') { const start = getRangeStart(currentDate, 'week'); for (let i = 0; i < 7; i++) { const d = new Date(start); d.setDate(start.getDate() + i); weekDays.push(d); } }

  return (
    <DashboardLayout>
      <div className="mb-4 flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Calendar</h1><p className="text-sm text-gray-500">{dateLabel}</p></div>
        <div className="flex items-center gap-3">
          {undoStack.length > 0 && <button onClick={handleUndo} className="rounded-md bg-yellow-50 px-3 py-1.5 text-sm text-yellow-700 hover:bg-yellow-100">↩ Undo</button>}
          <button onClick={() => setCurrentDate(new Date())} className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200">Today</button>
          <div className="flex rounded-md border border-gray-300">
            <button onClick={() => navigateDate(-1)} className="px-3 py-1.5 text-sm hover:bg-gray-50">←</button>
            <button onClick={() => navigateDate(1)} className="px-3 py-1.5 text-sm hover:bg-gray-50">→</button>
          </div>
          <div className="flex rounded-md border border-gray-300">
            {['day', 'week', 'multi-provider'].map((mode) => (
              <button key={mode} onClick={() => setViewMode(mode)} className={`px-3 py-1.5 text-sm capitalize ${viewMode === mode ? 'bg-primary-600 text-white' : 'hover:bg-gray-50'}`}>
                {mode === 'multi-provider' ? 'Providers' : mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showToast && <div className="fixed bottom-4 right-4 z-50 rounded-md bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">{showToast}</div>}

      {loading ? <div className="text-center text-gray-500">Loading...</div> :
       viewMode === 'day' ? <DayView date={currentDate} visits={visits} onDragEnd={handleDragEnd} /> :
       viewMode === 'week' ? <WeekView days={weekDays} visits={visits} /> :
       <MultiProviderView date={currentDate} visits={visits} providers={providers} onDragEnd={handleDragEnd} />}
    </DashboardLayout>
  );
}

function DayView({ date, visits, onDragEnd }) {
  const dateStr = date.toISOString().split('T')[0];
  const daySegments = [];
  const visitColors = {};
  let colorIdx = 0;
  for (const visit of visits) {
    if (!visitColors[visit.id]) visitColors[visit.id] = colorIdx++ % SEGMENT_COLORS.length;
    for (const seg of visit.segments) {
      if (new Date(seg.start_time).toISOString().split('T')[0] === dateStr) {
        daySegments.push({ ...seg, visit, colorIndex: visitColors[visit.id] });
      }
    }
  }
  daySegments.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  return (
    <div className="rounded-lg bg-white shadow-sm overflow-hidden">
      <div className="relative" style={{ height: (END_HOUR - START_HOUR + 1) * HOUR_HEIGHT }}>
        {HOURS.map((hour) => (
          <div key={hour} className="absolute w-full border-t border-gray-100" style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}>
            <span className="absolute -top-3 left-2 text-xs text-gray-400">{hour.toString().padStart(2, '0')}:00</span>
          </div>
        ))}
        <div className="absolute left-0 right-0 border-t-2 border-red-400 z-10" style={{ top: getTimeOffset(new Date()) }}>
          <div className="absolute -left-1 -top-1.5 h-3 w-3 rounded-full bg-red-400" />
        </div>
        {daySegments.map((seg) => {
          const start = new Date(seg.start_time);
          const end = new Date(seg.end_time);
          const top = getTimeOffset(start);
          const height = Math.max(((end.getTime() - start.getTime()) / 3600000) * HOUR_HEIGHT, 30);
          return <DraggableBlock key={seg.id} segment={seg} visit={seg.visit} colorClass={SEGMENT_COLORS[seg.colorIndex]} top={top} height={height} onDragEnd={onDragEnd} />;
        })}
        {daySegments.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-gray-400">No appointments this day</div>}
      </div>
    </div>
  );
}

function WeekView({ days, visits }) {
  return (
    <div className="rounded-lg bg-white shadow-sm overflow-hidden">
      <div className="grid grid-cols-8 border-b border-gray-200">
        <div className="p-2" />
        {days.map((d) => (
          <div key={d.toISOString()} className={`p-2 text-center text-sm font-medium ${d.toDateString() === new Date().toDateString() ? 'bg-primary-50 text-primary-700' : 'text-gray-600'}`}>
            <div>{d.toLocaleDateString('en-US', { weekday: 'short' })}</div><div className="text-lg">{d.getDate()}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-8" style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT }}>
        <div className="relative border-r border-gray-100">
          {HOURS.map((hour) => (<div key={hour} className="absolute w-full border-t border-gray-100" style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}><span className="absolute -top-3 left-1 text-xs text-gray-400">{hour}:00</span></div>))}
        </div>
        {days.map((d) => {
          const dateStr = d.toISOString().split('T')[0];
          const daySegments = [];
          const visitColors = {};
          let colorIdx = 0;
          for (const visit of visits) {
            if (!visitColors[visit.id]) visitColors[visit.id] = colorIdx++ % SEGMENT_COLORS.length;
            for (const seg of visit.segments) {
              if (new Date(seg.start_time).toISOString().split('T')[0] === dateStr) daySegments.push({ ...seg, visit });
            }
          }
          return (
            <div key={dateStr} className="relative border-r border-gray-100">
              {HOURS.map((hour) => (<div key={hour} className="absolute w-full border-t border-gray-50" style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }} />))}
              {daySegments.map((seg) => {
                const start = new Date(seg.start_time);
                const end = new Date(seg.end_time);
                const top = getTimeOffset(start) - START_HOUR * HOUR_HEIGHT;
                const height = Math.max(((end.getTime() - start.getTime()) / 3600000) * HOUR_HEIGHT, 20);
                const ci = visitColors[seg.visit.id];
                return (
                  <div key={seg.id} className={`absolute left-0.5 right-0.5 rounded border-l-2 p-0.5 overflow-hidden text-xs ${SEGMENT_COLORS[ci]}`} style={{ top, height: Math.max(height, 18) }}
                    title={`${seg.visit.client_name} - ${seg.service_name} with ${seg.provider_name}`}>
                    <div className="truncate font-medium text-[10px]">{seg.visit.client_name}</div>
                    {height > 24 && <div className="truncate text-[10px] opacity-75">{seg.service_name}</div>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MultiProviderView({ date, visits, providers, onDragEnd }) {
  const dateStr = date.toISOString().split('T')[0];
  const segmentsByProvider = {};
  for (const p of providers) segmentsByProvider[p.id] = [];
  const visitColors = {};
  let colorIdx = 0;
  for (const visit of visits) {
    if (!visitColors[visit.id]) visitColors[visit.id] = colorIdx++ % SEGMENT_COLORS.length;
    for (const seg of visit.segments) {
      if (new Date(seg.start_time).toISOString().split('T')[0] === dateStr && segmentsByProvider[seg.provider_id]) {
        segmentsByProvider[seg.provider_id].push({ ...seg, visit, colorIndex: visitColors[visit.id] });
      }
    }
  }

  return (
    <div className="rounded-lg bg-white shadow-sm overflow-x-auto">
      <div className="flex border-b border-gray-200" style={{ minWidth: providers.length * 200 + 60 }}>
        <div className="flex-shrink-0 border-r border-gray-200 p-2 text-xs text-gray-500" style={{ width: 60 }} />
        {providers.map((p) => (<div key={p.id} className="flex-1 border-r border-gray-200 p-2 text-center"><div className="text-sm font-medium text-gray-900">{p.name}</div></div>))}
      </div>
      <div className="relative flex" style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT, minWidth: providers.length * 200 + 60 }}>
        <div className="relative flex-shrink-0 border-r border-gray-200" style={{ width: 60 }}>
          {HOURS.map((hour) => (<div key={hour} className="absolute w-full border-t border-gray-100" style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}><span className="absolute -top-3 left-1 text-xs text-gray-400">{hour}:00</span></div>))}
        </div>
        {providers.map((p) => (
          <div key={p.id} className="relative flex-1 border-r border-gray-100">
            {HOURS.map((hour) => (<div key={hour} className="absolute w-full border-t border-gray-50" style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }} />))}
            {segmentsByProvider[p.id]?.map((seg) => {
              const start = new Date(seg.start_time);
              const end = new Date(seg.end_time);
              const top = getTimeOffset(start);
              const height = Math.max(((end.getTime() - start.getTime()) / 3600000) * HOUR_HEIGHT, 30);
              return <DraggableBlock key={seg.id} segment={seg} visit={seg.visit} colorClass={SEGMENT_COLORS[seg.colorIndex]} top={top} height={height} onDragEnd={onDragEnd} compact />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
