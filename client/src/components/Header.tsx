import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../api/client';

type Panel = 'invite' | 'child' | 'colors' | null;

const DEFAULT_CHILD_COLORS = ['#8a5cf6', '#f472b6', '#22c55e', '#f97316', '#06b6d4'];

export default function Header() {
  const { user, family, members, children, logout, refreshFamily } = useAuth();
  const [panel, setPanel] = useState<Panel>(null);
  const [childName, setChildName] = useState('');
  const [childColor, setChildColor] = useState(DEFAULT_CHILD_COLORS[0]);
  const [childColors, setChildColors] = useState<Record<number, string>>({});
  const [combinedColor, setCombinedColor] = useState(family?.combined_child_color ?? '#14b8a6');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function togglePanel(next: Panel) {
    setError(null);
    if (next === 'colors') {
      setChildColors(Object.fromEntries(children.map((c) => [c.id, c.color])));
      setCombinedColor(family?.combined_child_color ?? '#14b8a6');
    }
    setPanel((current) => (current === next ? null : next));
  }

  async function addChild() {
    if (!childName.trim()) return;
    setError(null);
    try {
      await api.post('/family/children', { name: childName.trim(), color: childColor });
      setChildName('');
      setChildColor(DEFAULT_CHILD_COLORS[(children.length + 1) % DEFAULT_CHILD_COLORS.length]);
      setPanel(null);
      await refreshFamily();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add child.');
    }
  }

  async function saveColors() {
    setError(null);
    setSaving(true);
    try {
      await Promise.all([
        ...children
          .filter((c) => childColors[c.id] && childColors[c.id] !== c.color)
          .map((c) => api.put(`/family/children/${c.id}`, { color: childColors[c.id] })),
        combinedColor !== family?.combined_child_color
          ? api.patch('/family', { combinedChildColor: combinedColor })
          : Promise.resolve(),
      ]);
      setPanel(null);
      await refreshFamily();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save colours.');
    } finally {
      setSaving(false);
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
          <div className="card" style={{ position: 'absolute', top: '110%', right: 170, padding: 12, zIndex: 20, width: 220 }}>
            <input
              placeholder="Child's name"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              style={{ width: '100%', marginBottom: 8 }}
              autoFocus
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <label style={{ fontSize: 13 }}>Colour</label>
              <input
                type="color"
                value={childColor}
                onChange={(e) => setChildColor(e.target.value)}
                style={{ width: 36, height: 28, padding: 2 }}
              />
            </div>
            {error && <p className="error-text">{error}</p>}
            <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={addChild}>
              Add
            </button>
          </div>
        )}
        <button
          className="btn btn-sm"
          style={{ position: 'relative', zIndex: 20 }}
          onClick={() => togglePanel('colors')}
        >
          Colours
        </button>
        {panel === 'colors' && (
          <div className="card" style={{ position: 'absolute', top: '110%', right: 90, padding: 14, zIndex: 20, width: 260 }}>
            <p style={{ fontSize: 13, marginBottom: 10 }}>Calendar colours</p>
            {children.map((c) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13 }}>{c.name}</span>
                <input
                  type="color"
                  value={childColors[c.id] ?? c.color}
                  onChange={(e) => setChildColors((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  style={{ width: 36, height: 28, padding: 2 }}
                />
              </div>
            ))}
            {children.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--text)', marginBottom: 8 }}>Add a child first.</p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13 }}>Both kids together</span>
              <input
                type="color"
                value={combinedColor}
                onChange={(e) => setCombinedColor(e.target.value)}
                style={{ width: 36, height: 28, padding: 2 }}
              />
            </div>
            <p style={{ fontSize: 11, color: 'var(--text)', margin: '6px 0 10px' }}>
              Used when an activity is checked for more than one child.
            </p>
            {error && <p className="error-text">{error}</p>}
            <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={saveColors} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
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
