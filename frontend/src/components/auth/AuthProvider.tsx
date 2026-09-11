"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase, hasSupabaseConfig } from "@/lib/supabase";

export type UserType = "consumer" | "existing_business" | "new_business";

export type OnboardingData = {
  consumerGoal?: string;
  consumerCategory?: string;
  businessName?: string;
  businessType?: string;
  industry?: string;
  productCategories?: string;
  certifications?: string;
  standards?: string;
  productName?: string;
  productionStatus?: string;
  productDescription?: string;
  /** "india" or "abroad": decides the certification scheme. */
  madeIn?: string;
};

type AuthUser = {
  id: string;
  identifier: string;
  name: string;
  isNewUser: boolean;
  userType?: UserType;
  onboardingData?: OnboardingData;
};

type AuthContextValue = {
  user: AuthUser | null;
  isNewUser: boolean;
  isLoading: boolean;
  signIn: (identifier: string, password?: string) => Promise<void>;
  signUp: (
    name: string,
    identifier: string,
    password?: string,
  ) => Promise<{ requiresEmailConfirmation: boolean }>;
  saveOnboardingData: (userType: UserType, onboardingData: OnboardingData) => void;
  completeOnboarding: (userType: UserType, onboardingData?: OnboardingData) => void;
  logout: () => Promise<void>;
};

const STORAGE_KEY = "bis-sahayak-auth";
const AuthContext = createContext<AuthContextValue | null>(null);

const fallbackUser = (): AuthUser | null => {
  const storedUser = window.localStorage.getItem(STORAGE_KEY);
  if (!storedUser) return null;

  try {
    return JSON.parse(storedUser) as AuthUser;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      if (!supabase) {
        const stored = fallbackUser();
        setUser(stored);
        setIsLoading(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        setUser({
          id: session.user.id,
          identifier: session.user.email ?? session.user.user_metadata?.username ?? "",
          name: session.user.user_metadata?.full_name ?? session.user.email ?? "User",
          isNewUser: false,
        });
      } else {
        setUser(fallbackUser());
      }

      setIsLoading(false);
    };

    void loadUser();

    const { data: authListener } = supabase
      ? supabase.auth.onAuthStateChange((_event, session) => {
          if (session?.user) {
            setUser({
              id: session.user.id,
              identifier: session.user.email ?? session.user.user_metadata?.username ?? "",
              name: session.user.user_metadata?.full_name ?? session.user.email ?? "User",
              isNewUser: false,
            });
          } else {
            setUser(null);
            window.localStorage.removeItem(STORAGE_KEY);
          }
        })
      : { data: { subscription: { unsubscribe: () => {} } } };

    return () => authListener.subscription.unsubscribe();
  }, []);

  function saveUser(nextUser: AuthUser) {
    setUser(nextUser);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
  }

  async function signIn(identifier: string, password = "password") {
    if (!supabase || !hasSupabaseConfig) {
      const email = identifier.trim();
      saveUser({ id: `local-${email}`, identifier: email, name: email, isNewUser: false });
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: identifier.trim(),
      password: password.trim() || "password",
    });

    if (error) throw new Error(error.message);

    if (data.user) {
      setUser({
        id: data.user.id,
        identifier: data.user.email ?? identifier,
        name: data.user.user_metadata?.full_name ?? data.user.email ?? identifier,
        isNewUser: false,
      });
    }
  }

  async function signUp(
    name: string,
    identifier: string,
    password = "password",
  ): Promise<{ requiresEmailConfirmation: boolean }> {
    if (!supabase || !hasSupabaseConfig) {
      const email = identifier.trim();
      saveUser({ id: `local-${email}`, identifier: email, name: name.trim() || email, isNewUser: true });
      return { requiresEmailConfirmation: false };
    }

    const { data, error } = await supabase.auth.signUp({
      email: identifier.trim(),
      password: password.trim() || "password",
      options: {
        data: {
          full_name: name.trim(),
        },
      },
    });

    if (error) throw new Error(error.message);

    if (data.user && data.session) {
      setUser({
        id: data.user.id,
        identifier: data.user.email ?? identifier,
        name: data.user.user_metadata?.full_name ?? (name.trim() || identifier),
        isNewUser: true,
      });
    }

    return { requiresEmailConfirmation: !data.session };
  }

  function saveOnboardingData(userType: UserType, onboardingData: OnboardingData) {
    if (!user) return;
    saveUser({ ...user, userType, onboardingData });
  }

  function completeOnboarding(userType: UserType, onboardingData: OnboardingData = {}) {
    if (!user) return;
    saveUser({ ...user, userType, onboardingData, isNewUser: false });
  }

  async function logout() {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    window.localStorage.removeItem(STORAGE_KEY);
  }

  const value = {
    user,
    isNewUser: user?.isNewUser ?? false,
    isLoading,
    signIn,
    signUp,
    saveOnboardingData,
    completeOnboarding,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
