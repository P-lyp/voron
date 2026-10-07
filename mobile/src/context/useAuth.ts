import { createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { UserProfileDTO, CompanyDTO } from '@ai-db/shared';

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfileDTO | null;
  company: CompanyDTO | null;
  isLoading: boolean;
  isAdmin: boolean;
  hasCompany: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null; user: User | null }>;
  sendPasswordReset: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  claimCompany: (activationCode: string) => Promise<{ success: boolean; company: CompanyDTO }>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
