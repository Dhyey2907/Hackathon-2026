"use client";

import { createContext, useContext, useEffect, useState } from "react";

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
};

type AuthUser = {
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
  signIn: (identifier: string) => void;
  signUp: (name: string, identifier: string) => void;
  saveOnboardingData: (userType: UserType, onboardingData: OnboardingData) => void;
  completeOnboarding: (userType: UserType, onboardingData?: OnboardingData) => void;
  logout: () => void;
};

const STORAGE_KEY = "bis-sahayak-mock-auth";
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      const storedUser = window.localStorage.getItem(STORAGE_KEY);
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser) as AuthUser);
        } catch {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
      setIsLoading(false);
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
  }, []);

  function saveUser(nextUser: AuthUser) {
    setUser(nextUser);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
  }

  function signIn(identifier: string) {
    saveUser({ identifier: identifier.trim(), name: identifier.trim(), isNewUser: false });
  }

  function signUp(name: string, identifier: string) {
    saveUser({ identifier: identifier.trim(), name: name.trim(), isNewUser: true });
  }

  function saveOnboardingData(userType: UserType, onboardingData: OnboardingData) {
    if (!user) return;
    saveUser({ ...user, userType, onboardingData });
  }

  function completeOnboarding(userType: UserType, onboardingData: OnboardingData = {}) {
    if (!user) return;
    saveUser({ ...user, userType, onboardingData, isNewUser: false });
  }

  function logout() {
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
