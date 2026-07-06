import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { CalendarEvent, EventType } from '../types';
import { fromInputValue, toInputValue } from '../utils/datetime';

interface Props {
  defaultDate: Date;
  editingEvent: CalendarEvent | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
  onProposeSwap: (event: CalendarEvent) => void;
}

export default function EventModal({
  defaultDate,
  editingEvent,
  onClose,
  onSaved,
  onDeleted,
  onProposeSwap,
}: Props) {
  const { user, members, children } = useAuth();
  const isEditing = !!editingEvent;

  const initialStart = editingEvent ? new Date(editingEvent.start_time) : setHour(defaultDate, 9);
  const initialEnd = editingEvent ? new Date(editingEvent.end_time) : setHour(defaultDate, 10);

  const [type, setType] = useState<EventType>(editingEvent?.type ?? 'activity');
  const [title, setTitle] = useState(editingEvent?.title ?? '');
  const [description, setDescription] = useState(editingEvent?.description ?? '');
  const [location, setLocation] = useState(editingEvent?.location ?? '');
  const [allDay, setAllDay] = useState(!!editingEvent?.all_day);
  const [start, setStart] = useState(toInputValue(initialStart));
  const [end, setEnd] = useState(toInputValue(initialEnd));
  const [childIds, setChildIds] = useState<number[]>(editingEvent?.child_ids ?? []);
  const [ownerParentId, setOwnerParentId] = useState<string>(
    editingEvent?.owner_parent_id?.toString() ?? (type === 'custody' ? '' : user?.id.toString() ?? '')
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isOwnEvent = !isEditing || editingEvent?.created_by === user?.id;
  const belongsToOtherParent =
    isEditing &&
    editingEvent!.owner_parent_id != null &&
    editingEvent!.owner_parent_id !== user?.id &&
    (editingEvent!.type === 'unavailable' || editingEvent!.type === 'custody');

  function setHour(date: Date, hour: number) {
    const d = new Date(date);
    d.setHours(hour, 0, 0, 0);
    return d;
  }

  function handleTypeChange(next: EventType) {
    setType(next);
    if (next === 'unavailable') setOwnerParentId(user?.id.toString() ?? '');
    if (next === 'activity') setOwnerParentId('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        type,
        title,
        description: description || null,
        location: location || null,
        startTime: fromInputValue(start),
        endTime: fromInputValue(end),
        allDay,
        childIds: type === 'activity' ? childIds : [],
        ownerParentId: type !== 'activity' && ownerParentId ? Number(ownerParentId) : null,
      };
      if (isEditing) {
        await api.put(`/events/${editingEvent!.id}`, payload);
      } else {
        await api.post('/events', payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this event.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!editingEvent) return;
    if (!confirm('Delete this event?')) return;
    try {
      await api.delete(`/events/${editingEvent.id}`);
      onDeleted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete this event.');
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form
        className="card"
        style={{ width: 460, padding: 28, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 style={{ marginBottom: 18 }}>{isEditing ? 'Edit event' : 'New event'}</h2>

        <div className="field">
          <label>Type</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['activity', 'unavailable', 'custody'] as EventType[]).map((t) => (
              <button
                type="button"
                key={t}
                className="btn btn-sm"
                disabled={isEditing}
                onClick={() => handleTypeChange(t)}
                style={type === t ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
              >
                {t === 'activity' ? 'Activity' : t === 'unavailable' ? 'Unavailable' : 'Custody'}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="title">Title</label>
          <input
            id="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              type === 'activity' ? 'Soccer practice' : type === 'unavailable' ? 'Work travel' : 'Kids with Mum'
            }
            disabled={!isOwnEvent}
          />
        </div>

        {type === 'activity' && children.length > 0 && (
          <div className="field">
            <label>Who is this for?</label>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {children.map((c) => (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
                  <input
                    type="checkbox"
                    style={{ width: 'auto' }}
                    checked={childIds.includes(c.id)}
                    disabled={!isOwnEvent}
                    onChange={(e) => {
                      setChildIds((prev) =>
                        e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                      );
                    }}
                  />
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color, display: 'inline-block' }} />
                  {c.name}
                </label>
              ))}
            </div>
            {childIds.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--text)', marginTop: 4 }}>
                Leave unchecked if this isn't specific to any child.
              </p>
            )}
          </div>
        )}

        {type !== 'activity' && (
          <div className="field">
            <label htmlFor="owner">{type === 'unavailable' ? 'Who is unavailable' : 'Who has the kids'}</label>
            <select
              id="owner"
              value={ownerParentId}
              onChange={(e) => setOwnerParentId(e.target.value)}
              disabled={type === 'unavailable' || !isOwnEvent}
              required
            >
              <option value="">Select parent</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {type === 'activity' && (
          <div className="field">
            <label htmlFor="location">Location</label>
            <input id="location" value={location} onChange={(e) => setLocation(e.target.value)} disabled={!isOwnEvent} />
          </div>
        )}

        <div className="field">
          <label style={{ flexDirection: 'row', display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => {
                const checked = e.target.checked;
                setAllDay(checked);
                if (checked) {
                  setStart(`${start.slice(0, 10)}T00:00`);
                  setEnd(`${end.slice(0, 10)}T23:59`);
                }
              }}
              style={{ width: 'auto' }}
              disabled={!isOwnEvent}
            />
            All day
          </label>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="start">Start</label>
            <input
              id="start"
              type={allDay ? 'date' : 'datetime-local'}
              required
              value={allDay ? start.slice(0, 10) : start}
              onChange={(e) => setStart(allDay ? `${e.target.value}T00:00` : e.target.value)}
              disabled={!isOwnEvent}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="end">End</label>
            <input
              id="end"
              type={allDay ? 'date' : 'datetime-local'}
              required
              value={allDay ? end.slice(0, 10) : end}
              onChange={(e) => setEnd(allDay ? `${e.target.value}T23:59` : e.target.value)}
              disabled={!isOwnEvent}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="description">Notes</label>
          <textarea
            id="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!isOwnEvent}
          />
        </div>

        {error && <p className="error-text">{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18, gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {isEditing && isOwnEvent && (
              <button type="button" className="btn btn-danger" onClick={handleDelete}>
                Delete
              </button>
            )}
            {belongsToOtherParent && (
              <button type="button" className="btn" onClick={() => onProposeSwap(editingEvent!)}>
                Propose a swap
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            {isOwnEvent && (
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save'}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
