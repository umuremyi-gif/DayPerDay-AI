import { useState, useEffect, useCallback } from 'react';
import { Trophy, Crown, Medal, Award, Lock } from 'lucide-react';
import { supabase, Achievement, UserAchievement } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate } from '@/lib/utils';
import EmptyState from '@/components/ui/EmptyState';

export default function Achievements() {
  const { profile } = useAuth();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!profile) return;
    const [achRes, uaRes] = await Promise.all([
      supabase.from('achievements').select('*').order('tier'),
      supabase.from('user_achievements').select('*').eq('user_id', profile.id),
    ]);
    setAchievements(achRes.data as Achievement[] || []);
    setUserAchievements(uaRes.data as UserAchievement[] || []);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const earnedIds = new Set(userAchievements.map((ua) => ua.achievement_id));

  const tierConfig = {
    gold: {
      gradient: 'from-yellow-400 via-yellow-500 to-yellow-600',
      bg: 'bg-yellow-50 dark:bg-yellow-950/20',
      border: 'border-yellow-300 dark:border-yellow-800',
      text: 'text-yellow-700 dark:text-yellow-400',
      icon: Crown,
      label: 'Gold',
    },
    silver: {
      gradient: 'from-gray-300 via-gray-400 to-gray-500',
      bg: 'bg-gray-50 dark:bg-gray-800/30',
      border: 'border-gray-300 dark:border-gray-700',
      text: 'text-gray-700 dark:text-gray-300',
      icon: Medal,
      label: 'Silver',
    },
    bronze: {
      gradient: 'from-orange-400 via-orange-500 to-orange-600',
      bg: 'bg-orange-50 dark:bg-orange-950/20',
      border: 'border-orange-300 dark:border-orange-800',
      text: 'text-orange-700 dark:text-orange-400',
      icon: Award,
      label: 'Bronze',
    },
  };

  const earned = achievements.filter((a) => earnedIds.has(a.id));
  const locked = achievements.filter((a) => !earnedIds.has(a.id));

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-6 bg-gradient-to-br from-primary-600 to-primary-800 border-primary-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-white">Achievements & Trophies</h2>
            <p className="text-sm text-primary-200 mt-1">
              {earned.length} of {achievements.length} earned
            </p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
            <Trophy size={28} className="text-white" />
          </div>
        </div>
        <div className="mt-4 h-2 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${achievements.length > 0 ? (earned.length / achievements.length) * 100 : 0}%` }} />
        </div>
      </div>

      {/* Tier summary */}
      <div className="grid grid-cols-3 gap-4">
        {(['gold', 'silver', 'bronze'] as const).map((tier) => {
          const tierEarned = earned.filter((a) => a.tier === tier);
          const tierTotal = achievements.filter((a) => a.tier === tier);
          const cfg = tierConfig[tier];
          const Icon = cfg.icon;
          return (
            <div key={tier} className={`card p-5 ${cfg.bg} ${cfg.border} border`}>
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cfg.gradient} flex items-center justify-center mb-3`}>
                <Icon size={20} className="text-white" />
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{tierEarned.length}</p>
              <p className={`text-xs ${cfg.text} capitalize`}>{cfg.label} Trophies</p>
              <p className="text-xs text-slate-400 mt-0.5">{tierTotal.length} total</p>
            </div>
          );
        })}
      </div>

      {/* Earned achievements */}
      {earned.length > 0 && (
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Earned Trophies</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {earned.map((ach) => {
              const cfg = tierConfig[ach.tier];
              const Icon = cfg.icon;
              const ua = userAchievements.find((u) => u.achievement_id === ach.id);
              return (
                <div key={ach.id} className={`card p-5 ${cfg.bg} ${cfg.border} border`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${cfg.gradient} flex items-center justify-center flex-shrink-0 shadow-md`}>
                      <Icon size={24} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900 dark:text-white text-sm">{ach.name}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{ach.description}</p>
                      <p className={`text-xs ${cfg.text} mt-2 font-medium`}>{ach.criteria}</p>
                      {ua && (
                        <p className="text-xs text-slate-400 mt-1">Earned {formatDate(ua.earned_at)}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Locked achievements */}
      {locked.length > 0 && (
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Locked</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {locked.map((ach) => {
              const cfg = tierConfig[ach.tier];
              return (
                <div key={ach.id} className="card p-5 opacity-60">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                      <Lock size={20} className="text-slate-400 dark:text-slate-500" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-700 dark:text-slate-300 text-sm">{ach.name}</h4>
                      <p className="text-xs text-slate-400 mt-1">{ach.description}</p>
                      <p className={`text-xs ${cfg.text} mt-2 font-medium`}>{ach.criteria}</p>
                      <span className={`badge text-[10px] mt-2 ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {achievements.length === 0 && (
        <div className="card p-6">
          <EmptyState icon={Trophy} title="No achievements available" description="Achievements will appear here as they are defined." />
        </div>
      )}
    </div>
  );
}
