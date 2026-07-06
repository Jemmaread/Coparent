import { format } from 'date-fns';
import type { SwapRequest, User } from '../types';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

interface Props {
  swaps: SwapRequest[];
  onChanged: () => void;
}

function nameFor(members: User[], id: number): string {
  return members.find((m) => m.id === id)?.name ?? 'Someone';
}

export default function SwapRequestsPanel({ swaps, onChanged }: Props) {
  const { user, members } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const incoming = swaps.filter((s) => s.status === 'pending' && s.target_user_id === user?.id);
  const outgoing = swaps.filter((s) => s.status === 'pending' && s.requested_by === user?.id);
  const resolved = swaps.filter((s) => s.status !== 'pending').slice(0, 5);

  async function respond(id: number, status: 'accepted' | 'declined' | 'cancelled') {
    setError(null);
    setBusyId(id);
    try {
      await api.post(`/swap-requests/${id}/respond`, { status });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update this request.');
    } finally {
      setBusyId(null);
    }
  }

  if (swaps.length === 0) {
    return (
      <div className="card" style={{ padding: 18 }}>
        <h2 style={{ fontSize: 15, marginBottom: 6 }}>Schedule swap requests</h2>
        <p style={{ fontSize: 13 }}>No swap requests yet. Mark yourself unavailable on the calendar to prompt one.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 18 }}>
      <h2 style={{ fontSize: 15, marginBottom: 12 }}>Schedule swap requests</h2>
      {error && <p className="error-text">{error}</p>}

      {incoming.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--text)', marginBottom: 6 }}>
            Needs your response
          </h3>
          {incoming.map((s) => (
            <div key={s.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 8, textAlign: 'left' }}>
              <p style={{ fontSize: 13, marginBottom: 4 }}>
                <strong>{nameFor(members, s.requested_by)}</strong> proposes{' '}
                {format(new Date(s.proposed_start_time), 'MMM d, h:mm a')} –{' '}
                {format(new Date(s.proposed_end_time), 'MMM d, h:mm a')}
              </p>
              {s.message && <p style={{ fontSize: 13, marginBottom: 8, color: 'var(--text)' }}>"{s.message}"</p>}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={busyId === s.id}
                  onClick={() => respond(s.id, 'accepted')}
                >
                  Accept
                </button>
                <button className="btn btn-danger btn-sm" disabled={busyId === s.id} onClick={() => respond(s.id, 'declined')}>
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {outgoing.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--text)', marginBottom: 6 }}>
            Waiting on {nameFor(members, outgoing[0]?.target_user_id ?? 0)}
          </h3>
          {outgoing.map((s) => (
            <div key={s.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 8, textAlign: 'left' }}>
              <p style={{ fontSize: 13, marginBottom: 8 }}>
                {format(new Date(s.proposed_start_time), 'MMM d, h:mm a')} –{' '}
                {format(new Date(s.proposed_end_time), 'MMM d, h:mm a')}
              </p>
              <button className="btn btn-sm" disabled={busyId === s.id} onClick={() => respond(s.id, 'cancelled')}>
                Cancel request
              </button>
            </div>
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <div>
          <h3 style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--text)', marginBottom: 6 }}>Recent history</h3>
          {resolved.map((s) => (
            <p key={s.id} style={{ fontSize: 12, marginBottom: 4, color: 'var(--text)' }}>
              {nameFor(members, s.requested_by)} → {nameFor(members, s.target_user_id)}:{' '}
              <span
                className="pill"
                style={{
                  background: s.status === 'accepted' ? 'var(--success-bg)' : 'var(--danger-bg)',
                  color: s.status === 'accepted' ? 'var(--success)' : 'var(--danger)',
                }}
              >
                {s.status}
              </span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
