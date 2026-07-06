CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#4f8cff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS families (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  combined_child_color TEXT NOT NULL DEFAULT '#14b8a6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE families ADD COLUMN IF NOT EXISTS combined_child_color TEXT NOT NULL DEFAULT '#14b8a6';

CREATE TABLE IF NOT EXISTS family_members (
  id SERIAL PRIMARY KEY,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(family_id, user_id)
);

CREATE TABLE IF NOT EXISTS children (
  id SERIAL PRIMARY KEY,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#8a5cf6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- type: 'custody' | 'activity' | 'unavailable'
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('custody', 'activity', 'unavailable')),
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT false,
  child_id INTEGER REFERENCES children(id) ON DELETE SET NULL,
  owner_parent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_family_range ON events(family_id, start_time, end_time);

-- Which children an activity applies to (0, 1, or many). Replaces the legacy
-- single events.child_id column, which is kept around unused for old rows.
CREATE TABLE IF NOT EXISTS event_children (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, child_id)
);

INSERT INTO event_children (event_id, child_id)
SELECT id, child_id FROM events WHERE child_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- status: 'pending' | 'accepted' | 'declined' | 'cancelled'
CREATE TABLE IF NOT EXISTS swap_requests (
  id SERIAL PRIMARY KEY,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  related_event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
  requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'declined', 'cancelled')),
  message TEXT,
  proposed_start_time TEXT NOT NULL,
  proposed_end_time TEXT NOT NULL,
  proposed_owner_parent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_swap_requests_family ON swap_requests(family_id, status);
