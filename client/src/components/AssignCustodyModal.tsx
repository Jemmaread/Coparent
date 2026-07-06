import { useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { toDateInputValue } from '../utils/datetime';

interface Props {
  onClose: () => void;
  onAssigned: () => void;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function AssignCustodyModal({ onClose, onAssigned }: Props) {
  const { members, user } = useAuth();
  const [ownerParentId, setOwnerParentId] = useState<string>(user?.id.toString() ?? '');
  const [month, setMonth] = useState(() => new Date());
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const gridStart = startOfWeek(startOfMonth(month));
  const gridEnd = endOfWeek(endOfMonth(month));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  function toggleDay(day: Date) {
    const key = toDateInputValue(day);
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSubmit() {
    if (!ownerParentId || selectedDates.size === 0) {
      setError('Pick a parent and at least one day.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/events/custody-days', {
        ownerParentId: Number(ownerParentId),
        dates: Array.from(selectedDates).sort(),
      });
      onAssigned();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not assign these days.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="card" style={{ width: 420, padding: 28 }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginBottom: 4 }}>Assign custody days</h2>
        <p style={{ fontSize: 13, marginBottom: 18 }}>
          Pick a parent, then click each day they'll have the kids. This replaces any existing
          custody entry on those days.
        </p>

        <div className="field">
          <label htmlFor="custody-owner">Parent</label>
          <select id="custody-owner" value={ownerParentId} onChange={(e) => setOwnerParentId(e.target.value)}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 8px' }}>
          <button type="button" className="btn btn-sm" onClick={() => setMonth((m) => subMonths(m, 1))}>
            ←
          </button>
          <strong style={{ fontSize: 14 }}>{format(month, 'MMMM yyyy')}</strong>
          <button type="button" className="btn btn-sm" onClick={() => setMonth((m) => addMonths(m, 1))}>
            →
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
          {WEEKDAYS.map((d, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>
              {d}
            </div>
          ))}
          {days.map((day) => {
            const key = toDateInputValue(day);
            const selected = selectedDates.has(key);
            const inMonth = isSameMonth(day, month);
            return (
              <button
                type="button"
                key={key}
                onClick={() => toggleDay(day)}
                style={{
                  height: 34,
                  borderRadius: 8,
                  border: selected ? 'none' : '1px solid var(--border)',
                  background: selected ? 'var(--accent)' : 'var(--surface)',
                  color: selected ? 'white' : inMonth ? 'var(--text-h)' : 'var(--text)',
                  opacity: inMonth ? 1 : 0.4,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>

        <p style={{ fontSize: 12, color: 'var(--text)', marginBottom: 12 }}>
          {selectedDates.size === 0 ? 'No days selected yet' : `${selectedDates.size} day${selectedDates.size === 1 ? '' : 's'} selected`}
        </p>

        {error && <p className="error-text">{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={submitting} onClick={handleSubmit}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
