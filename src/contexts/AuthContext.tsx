import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase, Profile, UserPreferences } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  preferences: UserPreferences | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, accountType: 'personal' | 'business') => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshPreferences: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        loadUserData(data.session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        (async () => {
          await loadUserData(newSession.user.id);
        })();
      } else {
        setProfile(null);
        setPreferences(null);
        setLoading(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function loadUserData(userId: string) {
    setLoading(true);
    await Promise.all([loadProfile(userId), loadPreferences(userId)]);
    setLoading(false);
  }

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    setProfile(data as Profile | null);
  }

  async function loadPreferences(userId: string) {
    const { data } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    setPreferences(data as UserPreferences | null);
  }

  async function signUp(email: string, password: string, fullName: string, accountType: 'personal' | 'business') {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) return { error: error.message };

    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: fullName,
        email: email,
        account_type: accountType,
      });
      await supabase.from('user_preferences').insert({
        id: data.user.id,
      });
    }

    return { error: null };
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { error: error.message };
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setPreferences(null);
  }

  async function refreshProfile() {
    if (user) await loadProfile(user.id);
  }

  async function refreshPreferences() {
    if (user) await loadPreferences(user.id);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        preferences,
        loading,
        signUp,
        signIn,
        signOut,
        refreshProfile,
        refreshPreferences,
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
