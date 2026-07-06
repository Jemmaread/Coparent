import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register({
        name,
        email,
        password,
        family:
          mode === 'create'
            ? { mode: 'create', familyName }
            : { mode: 'join', inviteCode: inviteCode.trim().toUpperCase() },
      });
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <form onSubmit={handleSubmit} className="card" style={{ width: 420, padding: 32 }}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Create your account</h1>
        <p style={{ marginBottom: 24, fontSize: 14 }}>
          Each co-parent signs up separately and shares one family calendar.
        </p>

        <div className="field">
          <label htmlFor="name">Your name</label>
          <input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>

        <div style={{ display: 'flex', gap: 8, margin: '4px 0 16px' }}>
          <button
            type="button"
            className="btn btn-sm"
            style={mode === 'create' ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
            onClick={() => setMode('create')}
          >
            Start a new family
          </button>
          <button
            type="button"
            className="btn btn-sm"
            style={mode === 'join' ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
            onClick={() => setMode('join')}
          >
            Join my co-parent
          </button>
        </div>

        {mode === 'create' ? (
          <div className="field">
            <label htmlFor="familyName">Family name</label>
            <input
              id="familyName"
              placeholder="e.g. The Smith Family"
              required
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
            />
          </div>
        ) : (
          <div className="field">
            <label htmlFor="inviteCode">Invite code from your co-parent</label>
            <input
              id="inviteCode"
              placeholder="e.g. K2NT5H"
              required
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              style={{ textTransform: 'uppercase' }}
            />
          </div>
        )}

        {error && <p className="error-text">{error}</p>}

        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>

        <p style={{ marginTop: 18, fontSize: 14, textAlign: 'center' }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
