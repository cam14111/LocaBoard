import { createContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { Utilisateur, UserRole } from '@/types/database.types';

export interface AuthContextType {
  user: User | null;
  profile: Utilisateur | null;
  role: UserRole | null;
  isAdmin: boolean;
  loading: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Utilisateur | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Erreur chargement profil:', error);
      setProfile(null);
      return;
    }
    setProfile(data as Utilisateur);
  }

  useEffect(() => {
    // Fallback : si onAuthStateChange ne se déclenche pas (AbortError WebSocket),
    // on sort du spinner après 5s pour éviter un blocage infini
    const fallbackTimer = setTimeout(() => {
      setLoading(false);
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        clearTimeout(fallbackTimer);

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          if (session?.user) {
            setUser(session.user);
            // fetchProfile en arrière-plan : ne bloque pas setLoading(false)
            fetchProfile(session.user.id);
          } else {
            setUser(null);
            setProfile(null);
          }
        }

        if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
        }

        setLoading(false);
      }
    );

    return () => {
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id);
  }

  const role = profile?.role ?? null;
  const isAdmin = role === 'ADMIN';

  return (
    <AuthContext.Provider value={{ user, profile, role, isAdmin, loading, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
