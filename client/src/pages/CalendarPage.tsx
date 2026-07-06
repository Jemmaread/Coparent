import { useEffect, useState, useCallback } from 'react';
import { addMonths, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import type { CalendarEvent, SwapRequest } from '../types';
import Header from '../components/Header';
import CalendarGrid from '../components/CalendarGrid';
import EventModal from '../components/EventModal';
import ProposeSwapModal from '../components/ProposeSwapModal';
import SwapRequestsPanel from '../components/SwapRequestsPanel';
import AssignCustodyModal from '../components/AssignCustodyModal';

export default function CalendarPage() {
  const { members, children, family } = useAuth();
  const [month, setMonth] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [modalDate, setModalDate] = useState<Date | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [swapTarget, setSwapTarget] = useState<CalendarEvent | null>(null);
  const [assigningCustody, setAssigningCustody] = useState(false);

  const loadEvents = useCallback(async () => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    const data = await api.get<CalendarEvent[]>(
      `/events?start=${start.toISOString()}&end=${end.toISOString()}`
    );
    setEvents(data);
  }, [month]);

  const loadSwaps = useCallback(async () => {
    const data = await api.get<SwapRequest[]>('/swap-requests');
    setSwaps(data);
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    loadSwaps();
  }, [loadSwaps]);

  function closeEventModal() {
    setModalDate(null);
    setEditingEvent(null);
  }

  async function handleSaved() {
    closeEventModal();
    await loadEvents();
  }

  async function handleDeleted() {
    closeEventModal();
    await loadEvents();
  }

  function handleProposeSwap(event: CalendarEvent) {
    closeEventModal();
    setSwapTarget(event);
  }

  async function handleSwapCreated() {
    setSwapTarget(null);
    await loadSwaps();
  }

  async function handleSwapsChanged() {
    await Promise.all([loadSwaps(), loadEvents()]);
  }

  async function handleCustodyAssigned() {
    setAssigningCustody(false);
    await loadEvents();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      <main style={{ flex: 1, padding: 24, display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn btn-sm" onClick={() => setMonth((m) => subMonths(m, 1))}>
                ←
              </button>
              <h2 style={{ fontSize: 18, minWidth: 160, textAlign: 'center' }}>{format(month, 'MMMM yyyy')}</h2>
              <button className="btn btn-sm" onClick={() => setMonth((m) => addMonths(m, 1))}>
                →
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Legend />
              <button className="btn btn-sm" onClick={() => setAssigningCustody(true)}>
                Assign custody days
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setModalDate(new Date())}>
                + New event
              </button>
            </div>
          </div>
          <CalendarGrid
            month={month}
            events={events}
            members={members}
            children={children}
            family={family}
            onDayClick={(day) => setModalDate(day)}
            onEventClick={(event) => setEditingEvent(event)}
          />
        </div>
        <SwapRequestsPanel swaps={swaps} onChanged={handleSwapsChanged} />
      </main>

      {(modalDate || editingEvent) && (
        <EventModal
          defaultDate={modalDate ?? new Date(editingEvent!.start_time)}
          editingEvent={editingEvent}
          onClose={closeEventModal}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onProposeSwap={handleProposeSwap}
        />
      )}

      {swapTarget && (
        <ProposeSwapModal relatedEvent={swapTarget} onClose={() => setSwapTarget(null)} onCreated={handleSwapCreated} />
      )}

      {assigningCustody && (
        <AssignCustodyModal onClose={() => setAssigningCustody(false)} onAssigned={handleCustodyAssigned} />
      )}
    </div>
  );
}

function Legend() {
  return (
    <div style={{ display: 'flex', gap: 10, fontSize: 12, color: 'var(--text)' }}>
      <LegendItem color="var(--activity)" label="Activity" />
      <LegendItem color="var(--unavailable)" label="Unavailable" />
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
      {label}
    </span>
  );
}
