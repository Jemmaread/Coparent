import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../api/client';

type Panel = 'invite' | 'child' | null;

export default function Header() {
  const { user, family, members, children, logout, refreshFamily } = useAuth();
  const [panel, setPanel] = useState<Panel>(null);
  const [childName, setChildName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function togglePanel(next: Panel) {
    setError(null);
    setPanel((current) => (current === next ? null : next));
  }

  async function addChild() {
    if (!childName.trim()) return;
    setError(null);
    try {
      await api.post('/family/children', { name: childName.trim() });
      setChildName('');
      setPanel(null);
      await refreshFamily();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add child.');
    }
  }

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 24px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        flexWrap: 'wrap',
        gap: 12,
      }}
    >
      <div>
        <h1 style={{ fontSize: 18 }}>{family?.name ?? 'Co-Parenting Calendar'}</h1>
        <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
          {members.map((m) => (
            <span
              key={m.id}
              className="pill"
              style={{ background: `${m.color}22`, color: m.color }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.color, display: 'inline-block' }} />
              {m.name}
              {m.id === user?.id ? ' (you)' : ''}
            </span>
          ))}
          {children.map((c) => (
            <span key={c.id} className="pill" style={{ background: `${c.color}22`, color: c.color }}>
              {c.name}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', position: 'relative' }}>
        {panel && <div className="popover-backdrop" onClick={() => setPanel(null)} />}
        <button
          className="btn btn-sm"
          style={{ position: 'relative', zIndex: 20 }}
          onClick={() => togglePanel('child')}
        >
          + Child
        </button>
        {panel === 'child' && (
          <div className="card" style={{ position: 'absolute', top: '110%', right: 90, padding: 12, zIndex: 20, width: 220 }}>
            <input
              placeholder="Child's name"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              style={{ width: '100%', marginBottom: 8 }}
              autoFocus
            />
            {error && <p className="error-text">{error}</p>}
            <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={addChild}>
              Add
            </button>
          </div>
        )}
        <button
          className="btn btn-sm"
          style={{ position: 'relative', zIndex: 20 }}
          onClick={() => togglePanel('invite')}
        >
          Invite code
        </button>
        {panel === 'invite' && (
          <div className="card" style={{ position: 'absolute', top: '110%', right: 0, padding: 14, zIndex: 20, width: 240 }}>
            <p style={{ fontSize: 13, marginBottom: 8 }}>Share this code with your co-parent so they can join:</p>
            <code style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2, display: 'block', textAlign: 'center' }}>
              {family?.invite_code}
            </code>
          </div>
        )}
        <button className="btn btn-sm" onClick={logout}>
          Log out
        </button>
      </div>
    </header>
  );
}
