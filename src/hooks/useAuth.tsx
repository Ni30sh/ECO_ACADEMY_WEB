import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import type { Session as SupabaseSession, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'student' | 'teacher' | 'admin';

type AuthUser = {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
    role?: AppRole;
    school_name?: string;
  };
};

type AuthSession = {
  user: AuthUser;
  token: string;
};

interface Profile {
  id: string;
  role: AppRole;
  full_name: string;
  avatar_emoji: string;
  eco_points: number;
  streak_days: number;
  last_active_date: string | null;
  interests: string[];
  daily_goal: number;
  school_name: string;
  city: string;
  created_at: string;
}

interface AuthContextType {
  user: AuthUser | null;
  session: AuthSession | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    schoolName?: string,
    requestedRole?: string
  ) => Promise<{ error: Error | null; needsEmailConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; role: AppRole | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateUserRole: (userId: string, newRole: AppRole) => Promise<{ error: Error | null }>;
  isTeacher: boolean;
  resolveDashboardPath: (inputRole?: AppRole | null) => '/student-dashboard' | '/teacher-dashboard' | '/admin-dashboard';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function resolveDashboardPathFromRole(inputRole?: AppRole | null): '/student-dashboard' | '/teacher-dashboard' | '/admin-dashboard' {
  if (inputRole === 'teacher') return '/teacher-dashboard';
  if (inputRole === 'admin') return '/admin-dashboard';
  return '/student-dashboard';
}

function normalizeRole(value: unknown): AppRole {
  if (value === 'teacher' || value === 'admin') return value;
  return 'student';
}

function toAuthUser(user: SupabaseUser): AuthUser {
  return {
    id: user.id,
    email: user.email ?? '',
    user_metadata: {
      full_name: typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : undefined,
      role: normalizeRole(user.user_metadata?.role),
      school_name: typeof user.user_metadata?.school_name === 'string' ? user.user_metadata.school_name : undefined,
    },
  };
}

function toAuthSession(session: SupabaseSession): AuthSession {
  return {
    user: toAuthUser(session.user),
    token: session.access_token,
  };
}

function toProfile(row: any): Profile {
  const schoolFromJoin = Array.isArray(row?.schools) ? row.schools[0]?.name : row?.schools?.name;
  return {
    id: row.id,
    role: normalizeRole(row.role),
    full_name: row.full_name ?? 'Student',
    avatar_emoji: row.avatar_emoji ?? '🌱',
    eco_points: row.eco_points ?? 0,
    streak_days: row.streak_days ?? 0,
    last_active_date: row.last_active_date ?? null,
    interests: Array.isArray(row.interests) ? row.interests : [],
    daily_goal: row.daily_goal ?? 2,
    school_name: row.school_name ?? schoolFromJoin ?? '',
    city: row.city ?? '',
    created_at: row.created_at ?? new Date().toISOString(),
  };
}

function buildFallbackProfile(user: AuthUser): Profile {
  const role = normalizeRole(user.user_metadata?.role);
  const emailPrefix = user.email?.split('@')[0] || 'Student';
  const fullName = user.user_metadata?.full_name?.trim() || emailPrefix;

  return {
    id: user.id,
    role,
    full_name: fullName,
    avatar_emoji: role === 'teacher' ? '📚' : role === 'admin' ? '⚙️' : '🌱',
    eco_points: 0,
    streak_days: 0,
    last_active_date: null,
    interests: [],
    daily_goal: 2,
    school_name: user.user_metadata?.school_name?.trim() || '',
    city: '',
    created_at: new Date().toISOString(),
  };
}

async function resolveSchoolIdByName(schoolName?: string): Promise<string | null> {
  const normalized = (schoolName || '').trim();
  if (!normalized) return null;

  const { data: existing, error: existingError } = await supabase
    .from('schools')
    .select('id')
    .eq('name', normalized)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.id) return existing.id;

  const { data: created, error: createError } = await supabase
    .from('schools')
    .insert({ name: normalized })
    .select('id')
    .single();

  if (createError) throw createError;
  return created.id;
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, schools(name)')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    // Gracefully allow newly created users before profile insert completes.
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data ? toProfile(data) : null;
}

async function ensureProfileForSessionUser(sessionUser: SupabaseUser): Promise<Profile | null> {
  const desiredFullName =
    typeof sessionUser.user_metadata?.full_name === 'string' && sessionUser.user_metadata.full_name.trim().length > 0
      ? sessionUser.user_metadata.full_name.trim()
      : (sessionUser.email || '').split('@')[0] || 'Student';
  const desiredRole = normalizeRole(sessionUser.user_metadata?.role);
  const desiredSchoolName = typeof sessionUser.user_metadata?.school_name === 'string' ? sessionUser.user_metadata.school_name : '';

  const syncExistingProfile = async (baseProfile: Profile): Promise<Profile> => {
    const now = new Date().toISOString();
    const school_id = await resolveSchoolIdByName(desiredSchoolName);
    const desiredAvatar = desiredRole === 'teacher' ? '📚' : desiredRole === 'admin' ? '⚙️' : '🌱';

    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: desiredFullName,
        role: desiredRole,
        school_id,
        avatar_emoji: baseProfile.avatar_emoji || desiredAvatar,
        updated_at: now,
      } as any)
      .eq('id', sessionUser.id)
      .select('*, schools(name)')
      .maybeSingle();

    if (error) return baseProfile;
    return data ? toProfile(data) : baseProfile;
  };

  const tryInsertMissingProfile = async (): Promise<Profile | null> => {
    const school_id = await resolveSchoolIdByName(desiredSchoolName);
    const desiredAvatar = desiredRole === 'teacher' ? '📚' : desiredRole === 'admin' ? '⚙️' : '🌱';

    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: sessionUser.id,
        full_name: desiredFullName,
        role: desiredRole,
        school_id,
        avatar_emoji: desiredAvatar,
      } as any)
      .select('*, schools(name)')
      .maybeSingle();

    if (error) return null;
    return data ? toProfile(data) : null;
  };

  try {
    const existing = await fetchProfile(sessionUser.id);
    if (existing) return await syncExistingProfile(existing);

    // The DB trigger creates profiles on auth signup; allow short propagation time.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 120 * (attempt + 1)));
      const delayed = await fetchProfile(sessionUser.id);
      if (delayed) return await syncExistingProfile(delayed);
    }

    const inserted = await tryInsertMissingProfile();
    if (inserted) return await syncExistingProfile(inserted);

    return null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const signUpInFlightRef = useRef(false);
  const signInInFlightRef = useRef(false);

  const clearAuthState = () => {
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  };

  const applySession = async (nextSession: SupabaseSession | null) => {
    if (!nextSession) {
      clearAuthState();
      return;
    }

    const nextUser = toAuthUser(nextSession.user);
    setUser(nextUser);
    setSession(toAuthSession(nextSession));

    const fetchedProfile = await ensureProfileForSessionUser(nextSession.user);
    const fallbackProfile = buildFallbackProfile(nextUser);
    const effectiveProfile = fetchedProfile ?? fallbackProfile;

    setProfile(effectiveProfile);
    setRole(effectiveProfile.role);
  };

  const refreshProfile = async () => {
    if (!user?.id) {
      setProfile(null);
      setRole(null);
      return;
    }

    // Re-run profile provisioning to avoid fallback-only state when DB row is missing.
    const { data: authData } = await supabase.auth.getUser();
    const ensuredProfile = authData?.user ? await ensureProfileForSessionUser(authData.user) : null;
    const fetchedProfile = ensuredProfile ?? (await fetchProfile(user.id));
    const effectiveProfile = fetchedProfile ?? buildFallbackProfile(user);
    setProfile(effectiveProfile);
    setRole(effectiveProfile.role);
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (mounted) {
          await applySession(data.session);
        }
      } catch {
        if (mounted) clearAuthState();
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setLoading(false);
      void applySession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    schoolName?: string,
    requestedRole?: string
  ) => {
    if (signUpInFlightRef.current) {
      return { error: new Error('Signup already in progress'), needsEmailConfirmation: false };
    }

    signUpInFlightRef.current = true;
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = fullName.trim();
      const effectiveRole = normalizeRole(requestedRole);

      if (!cleanEmail || !cleanName || !password) {
        return { error: new Error('Missing required signup fields'), needsEmailConfirmation: false };
      }

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName,
            role: effectiveRole,
            school_name: (schoolName || '').trim(),
          },
        },
      });

      if (error) {
        return { error: new Error(error.message), needsEmailConfirmation: false };
      }

      if (data.user) {
        // Do not insert directly: current RLS allows profile UPDATE but not INSERT.
        // Trigger-created profile is synchronized once a session is available.
        if (data.session) {
          await ensureProfileForSessionUser(data.user);
        }
      }

      if (data.session) {
        await applySession(data.session);
      }

      return { error: null, needsEmailConfirmation: !data.session };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('Signup failed'), needsEmailConfirmation: false };
    } finally {
      signUpInFlightRef.current = false;
    }
  };

  const signIn = async (email: string, password: string) => {
    if (signInInFlightRef.current) {
      return { error: new Error('Login already in progress'), role: null };
    }

    signInInFlightRef.current = true;
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error || !data.session) {
        return { error: new Error(error?.message || 'Invalid email or password'), role: null };
      }

      await applySession(data.session);
      const nextProfile = await fetchProfile(data.user.id);
      const nextRole = nextProfile?.role ?? normalizeRole(data.user.user_metadata?.role);
      return { error: null, role: nextRole };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('Login failed'), role: null };
    } finally {
      signInInFlightRef.current = false;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    clearAuthState();
  };

  const updateUserRole = async (userId: string, newRole: AppRole) => {
    if (role !== 'admin') {
      return { error: new Error('Only admin can change roles') };
    }

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole, updated_at: new Date().toISOString() } as any)
      .eq('id', userId);

    if (error) {
      return { error: new Error(error.message) };
    }

    if (user?.id === userId) {
      await refreshProfile();
    }

    return { error: null };
  };

  const resolveDashboardPath = (inputRole?: AppRole | null): '/student-dashboard' | '/teacher-dashboard' | '/admin-dashboard' => {
    return resolveDashboardPathFromRole(inputRole ?? role);
  };

  const isTeacher = role === 'teacher';

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        loading,
        signUp,
        signIn,
        signOut,
        refreshProfile,
        updateUserRole,
        isTeacher,
        resolveDashboardPath,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
