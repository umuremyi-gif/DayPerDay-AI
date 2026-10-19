import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase, Profile, OnboardingProgress } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type OnboardingContextType = {
  needsOnboarding: boolean;
  onboardingLoading: boolean;
  savedStep: number;
  savedProgress: OnboardingProgress | null;
  saveStepProgress: (step: number, data: Record<string, unknown>) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  refreshOnboarding: () => Promise<void>;
};

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { profile, refreshProfile } = useAuth();
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [onboardingLoading, setOnboardingLoading] = useState(true);
  const [savedStep, setSavedStep] = useState(0);
  const [savedProgress, setSavedProgress] = useState<OnboardingProgress | null>(null);

  const loadProgress = useCallback(async () => {
    if (!profile) {
      setNeedsOnboarding(false);
      setOnboardingLoading(false);
      return;
    }

    if (profile.onboarding_completed) {
      setNeedsOnboarding(false);
      setOnboardingLoading(false);
      return;
    }

    setNeedsOnboarding(true);
    setSavedStep(profile.onboarding_step || 0);

    const { data } = await supabase
      .from('onboarding_progress')
      .select('*')
      .eq('user_id', profile.id)
      .maybeSingle();

    setSavedProgress(data as OnboardingProgress | null);
    if (data && (data as OnboardingProgress).step > (profile.onboarding_step || 0)) {
      setSavedStep((data as OnboardingProgress).step);
    }
    setOnboardingLoading(false);
  }, [profile]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  async function saveStepProgress(step: number, data: Record<string, unknown>) {
    if (!profile) return;

    const { data: existing } = await supabase
      .from('onboarding_progress')
      .select('id')
      .eq('user_id', profile.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('onboarding_progress')
        .update({ step, step_data: data, updated_at: new Date().toISOString() })
        .eq('user_id', profile.id);
    } else {
      await supabase
        .from('onboarding_progress')
        .insert({ user_id: profile.id, step, step_data: data });
    }

    await supabase
      .from('profiles')
      .update({ onboarding_step: step, updated_at: new Date().toISOString() })
      .eq('id', profile.id);

    setSavedStep(step);
  }

  async function completeOnboarding() {
    if (!profile) return;
    await supabase
      .from('profiles')
      .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
      .eq('id', profile.id);
    setNeedsOnboarding(false);
    await refreshProfile();
  }

  async function refreshOnboarding() {
    setOnboardingLoading(true);
    await loadProgress();
  }

  return (
    <OnboardingContext.Provider
      value={{
        needsOnboarding,
        onboardingLoading,
        savedStep,
        savedProgress,
        saveStepProgress,
        completeOnboarding,
        refreshOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
