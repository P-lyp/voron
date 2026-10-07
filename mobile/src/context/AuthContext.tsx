import React, { useState, useEffect, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase.js';
import { UserProfileDTO, CompanyDTO } from '@ai-db/shared';
import { syncUserProfile, fetchUserProfile, claimCompanyWithCode } from '../services/api.js';
import { AuthContext } from './useAuth.js';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfileDTO | null>(null);
  const [company, setCompany] = useState<CompanyDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUserData = useCallback(async (supabaseUser: User) => {
    try {
      const email = supabaseUser.email || '';
      const fullName = (supabaseUser.user_metadata?.full_name as string) || '';
      const res = await syncUserProfile(supabaseUser.id, email, fullName);
      setProfile(res.profile);
      setCompany(res.company);
    } catch (err) {
      console.error('Erro ao sincronizar perfil do usuário:', err);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetchUserProfile(user.id);
      setProfile(res.profile);
      setCompany(res.company);
    } catch (err) {
      console.error('Erro ao atualizar perfil:', err);
    }
  }, [user]);

  useEffect(() => {
    // Timer de segurança para nunca travar tela em loading infinito
    const safetyTimer = setTimeout(() => {
      setIsLoading(false);
    }, 2500);

    // 1. Obter sessão inicial
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          loadUserData(session.user).finally(() => {
            clearTimeout(safetyTimer);
            setIsLoading(false);
          });
        } else {
          clearTimeout(safetyTimer);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.warn('[AuthContext] Erro ao obter sessão inicial:', err);
        clearTimeout(safetyTimer);
        setIsLoading(false);
      });

    // 2. Escutar mudanças de estado de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        await loadUserData(newSession.user);
      } else {
        setProfile(null);
        setCompany(null);
      }
      clearTimeout(safetyTimer);
      setIsLoading(false);
    });

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [loadUserData]);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) return { error };
      if (data.user) {
        await loadUserData(data.user);
      }
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (error) return { error, user: null };
      if (data.user) {
        await loadUserData(data.user);
      }
      return { error: null, user: data.user };
    } catch (err: any) {
      return { error: err, user: null };
    }
  };

  const sendPasswordReset = async (email: string) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined,
      });
      return { error };
    } catch (err: any) {
      return { error: err };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setCompany(null);
    localStorage.removeItem('ai_db_selected_company');
  };

  const claimCompany = async (activationCode: string) => {
    if (!user) throw new Error('Usuário não autenticado.');
    const result = await claimCompanyWithCode(user.id, activationCode);
    setCompany(result.company);
    setProfile(result.profile);
    return { success: true, company: result.company };
  };

  const isAdmin = profile?.role === 'admin' || user?.email?.toLowerCase() === 'felipealves13tga@hotmail.com';
  const hasCompany = Boolean(profile?.companyId || company?.id);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        company,
        isLoading,
        isAdmin,
        hasCompany,
        signIn,
        signUp,
        sendPasswordReset,
        signOut,
        claimCompany,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
