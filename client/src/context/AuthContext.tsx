import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getToken, setToken } from '../api/client';
import type { Child, Family, User } from '../types';

interface MeResponse {
  user: User;
  family: Family | null;
  members: User[];
}

interface AuthState {
  user: User | null;
  family: Family | null;
  members: User[];
  children: Child[];
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  refreshFamily: () => Promise<void>;
}

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  family:
    | { mode: 'create'; familyName: string }
    | { mode: 'join'; inviteCode: string };
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children: appChildren }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [familyChildren, setFamilyChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!getToken()) {
      setUser(null);
      setFamily(null);
      setMembers([]);
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<MeResponse>('/auth/me');
      setUser(me.user);
      setFamily(me.family);
      setMembers(me.members);
    } catch {
      setToken(null);
      setUser(null);
      setFamily(null);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }

  async function refreshFamily() {
    if (!family) return;
    const data = await api.get<{ family: Family; members: User[]; children: Child[] }>('/family');
    setFamily(data.family);
    setMembers(data.members);
    setFamilyChildren(data.children);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (family) refreshFamily();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family?.id]);

  async function login(email: string, password: string) {
    const data = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
    setToken(data.token);
    await refresh();
  }

  async function register(input: RegisterInput) {
    const data = await api.post<{ token: string; user: User; family: Family }>(
      '/auth/register',
      input
    );
    setToken(data.token);
    await refresh();
  }

  function logout() {
    setToken(null);
    setUser(null);
    setFamily(null);
    setMembers([]);
    setFamilyChildren([]);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        family,
        members,
        children: familyChildren,
        loading,
        login,
        register,
        logout,
        refresh,
        refreshFamily,
      }}
    >
      {appChildren}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
