import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { todayInTimezone } from '@/lib/utils';

type RedAlertContextType = {
  alertActive: boolean;
  alertLoading: boolean;
  alertError: boolean;
  refreshAlert: () => Promise<void>;
};

const RedAlertContext = createContext<RedAlertContextType | undefined>(undefined);

export function RedAlertProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [alertActive, setAlertActive] = useState(false);
  const [alertLoading, setAlertLoading] = useState(true);
  const [alertError, setAlertError] = useState(false);

  const checkPlan = useCallback(async () => {
    if (!profile) {
      setAlertActive(false);
      setAlertLoading(false);
      return;
    }

    setAlertLoading(true);
    setAlertError(false);

    try {
      const today = todayInTimezone(profile.timezone || 'Africa/Kigali');
      const { data, error } = await supabase
        .from('daily_plans')
        .select('id')
        .eq('user_id', profile.id)
        .eq('plan_date', today)
        .maybeSingle();

      if (error) {
        setAlertError(true);
        setAlertActive(false);
      } else {
        setAlertActive(!data);
      }
    } catch {
      setAlertError(true);
      setAlertActive(false);
    }

    setAlertLoading(false);
  }, [profile]);

  useEffect(() => {
    checkPlan();
  }, [checkPlan]);

  // Re-check when the date changes (handle midnight rollover)
  useEffect(() => {
    if (!profile) return;
    const interval = setInterval(() => {
      checkPlan();
    }, 60000); // Check every minute for date rollover
    return () => clearInterval(interval);
  }, [profile, checkPlan]);

  async function refreshAlert() {
    await checkPlan();
  }

  return (
    <RedAlertContext.Provider value={{ alertActive, alertLoading, alertError, refreshAlert }}>
      {children}
    </RedAlertContext.Provider>
  );
}

export function useRedAlert() {
  const ctx = useContext(RedAlertContext);
  if (!ctx) throw new Error('useRedAlert must be used within RedAlertProvider');
  return ctx;
}
