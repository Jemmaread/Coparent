import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { CalendarEvent } from '../types';
import { fromInputValue, toInputValue } from '../utils/datetime';

interface Props {
  relatedEvent: CalendarEvent;
  onClose: () => void;
  onCreated: () => void;
}

export default function ProposeSwapModal({ relatedEvent, onClose, onCreated }: Props) {
  const { user, members } = useAuth();
  const otherParent = members.find((m) => m.id !== user?.id);

  const [start, setStart] = useState(toInputValue(new Date(relatedEvent.start_time)));
  const [end, setEnd] = useState(toInputValue(new Date(relatedEvent.end_time)));
  const [message, setMessage] = useState(
    relatedEvent.type === 'unavailable'
      ? `Since you noted you're unavailable for "${relatedEvent.title}", I can take the kids during this time.`
      : ''
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!otherParent) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/swap-requests', {
        relatedEventId: relatedEvent.type === 'custody' ? relatedEvent.id : null,
        targetUserId: otherParent.id,
        message: message || null,
        proposedStartTime: fromInputValue(start),
        proposedEndTime: fromInputValue(end),
        proposedOwnerParentId: user?.id,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send this request.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="card" style={{ width: 440, padding: 28 }} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 style={{ marginBottom: 4 }}>Propose a schedule swap</h2>
        <p style={{ fontSize: 13, marginBottom: 18 }}>
          Send {otherParent?.name ?? 'your co-parent'} a request to adjust the schedule. They'll need to
          accept before anything changes.
        </p>

        <div style={{ display: 'flex', gap: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="pstart">New start</label>
            <input id="pstart" type="datetime-local" required value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="pend">New end</label>
            <input id="pend" type="datetime-local" required value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="message">Message</label>
          <textarea id="message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>

        {error && <p className="error-text">{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting || !otherParent}>
            {submitting ? 'Sending…' : 'Send request'}
          </button>
        </div>
      </form>
    </div>
  );
}
