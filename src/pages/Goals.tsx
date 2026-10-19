import { useState, useEffect, useCallback } from 'react';
import {
  Target, Plus, Trash2, Pencil, Save, X, Sparkles, Loader2,
  Flag, Calendar, CheckCircle2, AlertTriangle, Clock, History,
  RotateCw, ChevronRight, Trophy,
} from 'lucide-react';
import { supabase, Goal, Milestone, GoalCycle, CycleReview } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { formatDate, daysBetween, daysSince, todayISO } from '@/lib/utils';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';

export default function Goals() {
  const { profile, preferences } = useAuth();
  const { showToast } = useToast();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [milestones, setMilestones] = useState<Record<string, Milestone[]>>({});
  const [cycles, setCycles] = useState<GoalCycle[]>([]);
  const [activeCycle, setActiveCycle] = useState<GoalCycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);
  const [generatingPlan, setGeneratingPlan] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showNewCycleModal, setShowNewCycleModal] = useState(false);
  const [completingCycle, setCompletingCycle] = useState(false);

  const loadData = useCallback(async () => {
    if (!profile) return;

    const { data: cyclesData } = await supabase
      .from('goal_cycles')
      .select('*')
      .eq('user_id', profile.id)
      .order('cycle_number', { ascending: false });
    const cyclesList = (cyclesData as GoalCycle[]) || [];
    setCycles(cyclesList);
    const active = cyclesList.find((c) => c.status === 'active') || null;
    setActiveCycle(active);

    let goalsQuery = supabase
      .from('goals')
      .select('*')
      .eq('user_id', profile.id);
    if (active) {
      goalsQuery = goalsQuery.eq('cycle_id', active.id);
    }
    const { data: goalsData } = await goalsQuery.order('created_at', { ascending: false });
    const goalsList = (goalsData as Goal[]) || [];
    setGoals(goalsList);

    const msMap: Record<string, Milestone[]> = {};
    for (const goal of goalsList) {
      const { data: msData } = await supabase
        .from('milestones')
        .select('*')
        .eq('goal_id', goal.id)
        .order('month_number');
      msMap[goal.id] = (msData as Milestone[]) || [];
    }
    setMilestones(msMap);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function saveGoal(goalData: Partial<Goal>, id?: string) {
    if (!profile) return;
    if (id) {
      const { data } = await supabase.from('goals').update(goalData).eq('id', id).select().single();
      showToast('Goal updated', 'success');
      setGoals((prev) => prev.map((g) => (g.id === id ? data as Goal : g)));
    } else {
      const { data } = await supabase
        .from('goals')
        .insert({ ...goalData, user_id: profile.id, cycle_id: activeCycle?.id || null })
        .select()
        .single();
      showToast('Goal created! Now let\'s break it down.', 'success');
      setGoals((prev) => [data as Goal, ...prev]);
      setExpandedGoal((data as Goal).id);
    }
    setShowGoalModal(false);
    setEditingGoal(null);
    await loadData();
  }

  async function deleteGoal(id: string) {
    await supabase.from('goals').delete().eq('id', id);
    setGoals((prev) => prev.filter((g) => g.id !== id));
    showToast('Goal deleted', 'info');
  }

  async function generateMilestones(goal: Goal) {
    if (!profile) return;
    setGeneratingPlan(goal.id);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/ai/goal-breakdown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, user_id: profile.id, preferred_language: preferences?.preferred_language || 'automatic' }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.milestones && Array.isArray(result.milestones)) {
          for (const ms of result.milestones) {
            await supabase.from('milestones').insert({
              goal_id: goal.id,
              user_id: profile.id,
              ...ms,
            });
          }
          showToast('AI generated milestones!', 'success');
          await loadData();
        }
      } else {
        await createDefaultMilestones(goal);
        showToast('Created basic milestones (AI service unavailable)', 'info');
      }
    } catch {
      await createDefaultMilestones(goal);
      showToast('Created basic milestones (AI service offline)', 'info');
    }

    setGeneratingPlan(null);
  }

  async function createDefaultMilestones(goal: Goal) {
    if (!profile) return;
    const startDate = new Date(goal.start_date);
    for (let month = 1; month <= 3; month++) {
      const targetDate = new Date(startDate);
      targetDate.setMonth(targetDate.getMonth() + month);
      await supabase.from('milestones').insert({
        goal_id: goal.id,
        user_id: profile.id,
        title: `Month ${month} Milestone`,
        description: `Define your month ${month} objectives for: ${goal.title}`,
        month_number: month,
        target_date: targetDate.toISOString().split('T')[0],
        weekly_objectives: '',
        daily_tasks_hint: '',
        success_indicators: '',
        potential_obstacles: '',
        solutions: '',
      });
    }
    await loadData();
  }

  async function toggleMilestone(ms: Milestone) {
    const completed = !ms.completed;
    const { data } = await supabase
      .from('milestones')
      .update({ completed, completed_at: completed ? new Date().toISOString() : null })
      .eq('id', ms.id)
      .select()
      .single();
    if (data) {
      setMilestones((prev) => ({
        ...prev,
        [ms.goal_id]: prev[ms.goal_id]?.map((m) => (m.id === ms.id ? data as Milestone : m)),
      }));
    }
  }

  async function submitCycleReview(reviewData: Partial<CycleReview>, cycle: GoalCycle, finalStatus: GoalCycle['status']) {
    if (!profile) return;
    setCompletingCycle(true);

    await supabase.from('cycle_reviews').insert({
      user_id: profile.id,
      cycle_id: cycle.id,
      goals_achieved: reviewData.goals_achieved || '',
      goals_partial: reviewData.goals_partial || '',
      goals_not_achieved: reviewData.goals_not_achieved || '',
      success_factors: reviewData.success_factors || '',
      obstacles: reviewData.obstacles || '',
      lessons: reviewData.lessons || '',
      next_cycle_changes: reviewData.next_cycle_changes || '',
      next_cycle_goals: reviewData.next_cycle_goals || '',
    });

    await supabase
      .from('goal_cycles')
      .update({ status: finalStatus, review_completed: true, updated_at: new Date().toISOString() })
      .eq('id', cycle.id);

    showToast('Cycle review saved!', 'success');
    setShowReviewModal(false);
    setCompletingCycle(false);
    await loadData();
  }

  async function createNewCycle(carryForwardGoalIds: string[]) {
    if (!profile) return;
    const nextNumber = (cycles[0]?.cycle_number || 0) + 1;
    const today = todayISO();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 90);

    const { data: newCycle } = await supabase
      .from('goal_cycles')
      .insert({
        user_id: profile.id,
        cycle_number: nextNumber,
        start_date: today,
        end_date: endDate.toISOString().split('T')[0],
        status: 'active',
        carried_forward_goals: JSON.stringify(carryForwardGoalIds),
      })
      .select()
      .single();

    for (const goalId of carryForwardGoalIds) {
      await supabase
        .from('goals')
        .update({ cycle_id: (newCycle as GoalCycle).id, status: 'active' })
        .eq('id', goalId);
    }

    showToast(`Cycle ${nextNumber} started!`, 'success');
    setShowNewCycleModal(false);
    await loadData();
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" /></div>;
  }

  const today = todayISO();
  const daysRemaining = activeCycle ? daysBetween(today, activeCycle.end_date) : 0;
  const cycleElapsed = activeCycle ? daysSince(activeCycle.start_date) : 0;
  const cycleProgress = activeCycle ? Math.min(100, Math.round((cycleElapsed / 90) * 100)) : 0;
  const cycleEndingSoon = activeCycle && daysRemaining <= 7;
  const cycleEnded = activeCycle && daysRemaining <= 0;
  const pastCycles = cycles.filter((c) => c.status !== 'active');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">90-Day Goals</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            What do you want to achieve in the next 90 days?
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pastCycles.length > 0 && (
            <button onClick={() => setShowHistory(true)} className="btn-secondary text-sm">
              <History size={16} /> Cycle History
            </button>
          )}
          <button onClick={() => { setEditingGoal(null); setShowGoalModal(true); }} className="btn-primary text-sm">
            <Plus size={16} /> New Goal
          </button>
        </div>
      </div>

      {/* Active cycle card */}
      {activeCycle && (
        <div className={`card p-5 ${cycleEndingSoon ? 'border-warning-300 dark:border-warning-700' : ''}`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                cycleEnded ? 'bg-error-100 dark:bg-error-950/40 text-error-600' :
                cycleEndingSoon ? 'bg-warning-100 dark:bg-warning-950/40 text-warning-600' :
                'bg-primary-100 dark:bg-primary-950/40 text-primary-600'
              }`}>
                <Clock size={22} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Cycle {activeCycle.cycle_number}</h3>
                <p className="text-xs text-slate-400">
                  {formatDate(activeCycle.start_date)} — {formatDate(activeCycle.end_date)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-bold ${
                cycleEnded ? 'text-error-600 dark:text-error-400' :
                cycleEndingSoon ? 'text-warning-600 dark:text-warning-400' :
                'text-primary-600 dark:text-primary-400'
              }`}>
                {cycleEnded ? 'Ended' : `${Math.max(0, daysRemaining)}d`}
              </p>
              <p className="text-xs text-slate-400">{cycleEnded ? 'Review now' : 'remaining'}</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-400">Day {Math.min(cycleElapsed, 90)} of 90</span>
              <span className="text-xs font-medium text-primary-600 dark:text-primary-400">{cycleProgress}%</span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full transition-all duration-500" style={{ width: `${cycleProgress}%` }} />
            </div>
          </div>
          {(cycleEndingSoon || cycleEnded) && (
            <div className="mt-4 flex items-center gap-3">
              {cycleEndingSoon && !cycleEnded && (
                <p className="text-sm text-warning-700 dark:text-warning-400 flex items-center gap-1.5">
                  <AlertTriangle size={15} /> Your cycle ends in {daysRemaining} days. Time to review!
                </p>
              )}
              {cycleEnded && (
                <p className="text-sm text-error-700 dark:text-error-400 flex items-center gap-1.5">
                  <AlertTriangle size={15} /> This cycle has ended. Complete your review to start the next one.
                </p>
              )}
              <button
                onClick={() => setShowReviewModal(true)}
                className="btn-primary text-sm ml-auto"
              >
                <RotateCw size={15} /> Review & Start Next Cycle
              </button>
            </div>
          )}
        </div>
      )}

      {/* No active cycle prompt */}
      {!activeCycle && cycles.length === 0 && (
        <div className="card p-5 border-dashed border-2 border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <Target size={22} className="text-primary-500" />
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Start your first 90-day cycle</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Create a cycle to organize your goals into a structured 90-day sprint.</p>
            </div>
            <button
              onClick={() => createNewCycle([])}
              className="btn-primary text-sm ml-auto"
            >
              <Plus size={16} /> Start Cycle 1
            </button>
          </div>
        </div>
      )}

      {!activeCycle && cycles.length > 0 && (
        <div className="card p-5 border-dashed border-2 border-primary-200 dark:border-primary-700">
          <div className="flex items-center gap-3">
            <RotateCw size={22} className="text-primary-500" />
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">No active cycle</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Start a new 90-day cycle to begin tracking goals.</p>
            </div>
            <button
              onClick={() => setShowNewCycleModal(true)}
              className="btn-primary text-sm ml-auto"
            >
              <Plus size={16} /> Start New Cycle
            </button>
          </div>
        </div>
      )}

      {/* Goals list */}
      {goals.length === 0 ? (
        <div className="card p-6">
          <EmptyState
            icon={Target}
            title="No goals yet"
            description="Set your first 90-day goal. The AI will help break it down into monthly milestones, weekly objectives, and daily tasks."
            action={<button onClick={() => setShowGoalModal(true)} className="btn-primary text-sm"><Plus size={16} /> Create Your First Goal</button>}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => {
            const total = Math.max(1, daysBetween(goal.start_date, goal.end_date));
            const elapsed = Math.max(0, daysSince(goal.start_date));
            const progress = Math.min(100, Math.round((elapsed / total) * 100));
            const goalMilestones = milestones[goal.id] || [];
            const completedMs = goalMilestones.filter((m) => m.completed).length;
            const isExpanded = expandedGoal === goal.id;

            return (
              <div key={goal.id} className="card overflow-hidden">
                <div
                  className="p-5 cursor-pointer"
                  onClick={() => setExpandedGoal(isExpanded ? null : goal.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`badge text-[10px] ${
                          goal.status === 'active' ? 'bg-success-100 dark:bg-success-950/40 text-success-700 dark:text-success-400' :
                          goal.status === 'completed' ? 'bg-primary-100 dark:bg-primary-950/40 text-primary-700 dark:text-primary-400' :
                          'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}>{goal.status}</span>
                        {goal.is_primary && (
                          <span className="badge text-[10px] bg-secondary-100 dark:bg-secondary-950/40 text-secondary-700 dark:text-secondary-400">
                            <Trophy size={9} /> Primary
                          </span>
                        )}
                        {goalMilestones.length > 0 && (
                          <span className="text-xs text-slate-400">{completedMs}/{goalMilestones.length} milestones</span>
                        )}
                      </div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">{goal.title}</h3>
                      {goal.why_it_matters && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{goal.why_it_matters}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingGoal(goal); setShowGoalModal(true); }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-primary-500"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteGoal(goal.id); }}
                        className="p-1.5 rounded-lg hover:bg-error-50 dark:hover:bg-error-950/30 text-slate-400 hover:text-error-500"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">Day {Math.min(elapsed, total)} of {total}</span>
                      <span className="text-xs font-medium text-primary-600 dark:text-primary-400">{progress}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {formatDate(goal.start_date)} — {formatDate(goal.end_date)}
                    </p>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-200 dark:border-slate-800 p-5 animate-slide-up">
                    {goalMilestones.length === 0 ? (
                      <div className="text-center py-4">
                        <Sparkles size={24} className="text-primary-400 mx-auto mb-2" />
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                          Let AI help break this goal into 3 monthly milestones with weekly objectives and daily tasks.
                        </p>
                        <button
                          onClick={() => generateMilestones(goal)}
                          disabled={generatingPlan === goal.id}
                          className="btn-primary text-sm"
                        >
                          {generatingPlan === goal.id ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                          {generatingPlan === goal.id ? 'Generating...' : 'Generate Milestones with AI'}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-sm text-slate-900 dark:text-white">Milestones</h4>
                          <button
                            onClick={() => generateMilestones(goal)}
                            disabled={generatingPlan === goal.id}
                            className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                          >
                            {generatingPlan === goal.id ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                            Regenerate
                          </button>
                        </div>
                        {goalMilestones.map((ms) => (
                          <div key={ms.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                            <div className="flex items-start gap-3">
                              <button
                                onClick={() => toggleMilestone(ms)}
                                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                  ms.completed ? 'bg-success-500 border-success-500' : 'border-slate-300 dark:border-slate-600'
                                }`}
                              >
                                {ms.completed && <CheckCircle2 size={12} className="text-white" />}
                              </button>
                              <div className="flex-1">
                                <h5 className={`text-sm font-medium ${ms.completed ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                                  {ms.title}
                                </h5>
                                {ms.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{ms.description}</p>}
                                {ms.target_date && (
                                  <span className="flex items-center gap-1 text-xs text-slate-400 mt-2">
                                    <Calendar size={11} /> Target: {formatDate(ms.target_date)}
                                  </span>
                                )}
                                {ms.success_indicators && (
                                  <div className="mt-2 p-2 rounded-lg bg-white dark:bg-slate-900">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                      <strong>Success indicators:</strong> {ms.success_indicators}
                                    </p>
                                  </div>
                                )}
                                {ms.potential_obstacles && (
                                  <div className="mt-2 p-2 rounded-lg bg-white dark:bg-slate-900">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                      <strong>Obstacles:</strong> {ms.potential_obstacles}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showGoalModal && (
        <GoalModal
          goal={editingGoal}
          onClose={() => { setShowGoalModal(false); setEditingGoal(null); }}
          onSave={saveGoal}
        />
      )}

      {showReviewModal && activeCycle && (
        <CycleReviewModal
          cycle={activeCycle}
          goals={goals}
          loading={completingCycle}
          onClose={() => setShowReviewModal(false)}
          onSubmit={(review, status) => submitCycleReview(review, activeCycle, status)}
        />
      )}

      {showHistory && (
        <CycleHistoryModal
          cycles={pastCycles}
          onClose={() => setShowHistory(false)}
        />
      )}

      {showNewCycleModal && (
        <NewCycleModal
          previousGoals={goals}
          onClose={() => setShowNewCycleModal(false)}
          onCreate={createNewCycle}
        />
      )}
    </div>
  );
}

function GoalModal({
  goal, onClose, onSave,
}: {
  goal: Goal | null;
  onClose: () => void;
  onSave: (data: Partial<Goal>, id?: string) => void;
}) {
  const [form, setForm] = useState<Partial<Goal>>(
    goal || {
      title: '',
      why_it_matters: '',
      current_situation: '',
      available_resources: '',
      skills_strengths: '',
      daily_responsibilities: '',
      local_environment: '',
      obstacles_risks: '',
      available_time: '',
      available_budget: '',
      success_metrics: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'active',
    }
  );

  const fields = [
    { key: 'title', label: 'Main Goal', type: 'input', placeholder: 'What do you want to achieve?', required: true },
    { key: 'why_it_matters', label: 'Why does this goal matter?', type: 'textarea', placeholder: 'Your motivation...' },
    { key: 'current_situation', label: 'Current Situation', type: 'textarea', placeholder: 'Where are you now?' },
    { key: 'available_resources', label: 'Available Resources', type: 'textarea', placeholder: 'What resources do you have?' },
    { key: 'skills_strengths', label: 'Skills and Strengths', type: 'textarea', placeholder: 'What are you good at?' },
    { key: 'daily_responsibilities', label: 'Daily Responsibilities', type: 'textarea', placeholder: 'What do you do daily?' },
    { key: 'local_environment', label: 'Local Environment and Opportunities', type: 'textarea', placeholder: 'What opportunities exist around you?' },
    { key: 'obstacles_risks', label: 'Obstacles and Risks', type: 'textarea', placeholder: 'What could get in the way?' },
    { key: 'available_time', label: 'Available Time', type: 'input', placeholder: 'How much time can you dedicate?' },
    { key: 'available_budget', label: 'Available Budget', type: 'input', placeholder: 'What financial resources?' },
    { key: 'success_metrics', label: 'How will success be measured?', type: 'textarea', placeholder: 'What does success look like?' },
  ];

  return (
    <Modal isOpen={true} onClose={onClose} title={goal ? 'Edit Goal' : 'New 90-Day Goal'} size="lg">
      <div className="space-y-4">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="label">{field.label}{field.required && <span className="text-error-500"> *</span>}</label>
            {field.type === 'textarea' ? (
              <textarea
                value={(form[field.key as keyof Goal] as string) || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                rows={2}
                className="input resize-none"
                placeholder={field.placeholder}
              />
            ) : (
              <input
                value={(form[field.key as keyof Goal] as string) || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                className="input"
                placeholder={field.placeholder}
              />
            )}
          </div>
        ))}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Start Date</label>
            <input
              type="date"
              value={form.start_date as string}
              onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))}
              className="input"
            />
          </div>
          <div>
            <label className="label">End Date</label>
            <input
              type="date"
              value={form.end_date as string}
              onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value }))}
              className="input"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={() => onSave(form, goal?.id)}
            disabled={!form.title}
            className="btn-primary"
          >
            <Save size={16} /> {goal ? 'Update Goal' : 'Create Goal'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CycleReviewModal({
  cycle, goals, loading, onClose, onSubmit,
}: {
  cycle: GoalCycle;
  goals: Goal[];
  loading: boolean;
  onClose: () => void;
  onSubmit: (review: Partial<CycleReview>, status: GoalCycle['status']) => void;
}) {
  const [form, setForm] = useState<Partial<CycleReview>>({});
  const [status, setStatus] = useState<GoalCycle['status']>('completed');

  const reviewFields = [
    { key: 'goals_achieved', label: 'Which goals did you fully achieve?', placeholder: 'List the goals you completed this cycle...' },
    { key: 'goals_partial', label: 'Which goals did you partially achieve?', placeholder: 'Goals where you made progress but didn\'t finish...' },
    { key: 'goals_not_achieved', label: 'Which goals did you not achieve?', placeholder: 'Goals that didn\'t progress as planned...' },
    { key: 'success_factors', label: 'What factors contributed to your success?', placeholder: 'What helped you make progress?' },
    { key: 'obstacles', label: 'What obstacles did you face?', placeholder: 'Challenges that held you back...' },
    { key: 'lessons', label: 'What lessons did you learn?', placeholder: 'Key takeaways from this cycle...' },
    { key: 'next_cycle_changes', label: 'What will you change next cycle?', placeholder: 'Adjustments to your approach...' },
    { key: 'next_cycle_goals', label: 'What goals do you want for the next cycle?', placeholder: 'New goals or carried-forward goals...' },
  ];

  return (
    <Modal isOpen={true} onClose={onClose} title={`Review Cycle ${cycle.cycle_number}`} size="lg">
      <div className="space-y-4">
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            You had {goals.length} goal{goals.length !== 1 ? 's' : ''} in this cycle.
            {goals.filter((g) => g.status === 'completed').length} completed,{' '}
            {goals.filter((g) => g.status === 'active').length} still active.
          </p>
        </div>
        {reviewFields.map((field) => (
          <div key={field.key}>
            <label className="label">{field.label}</label>
            <textarea
              value={(form[field.key as keyof CycleReview] as string) || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
              rows={2}
              className="input resize-none"
              placeholder={field.placeholder}
            />
          </div>
        ))}
        <div>
          <label className="label">How did this cycle go overall?</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as GoalCycle['status'])}
            className="input"
          >
            <option value="completed">Completed — achieved my goals</option>
            <option value="partially_completed">Partially completed — some goals met</option>
            <option value="not_completed">Not completed — goals not met</option>
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={() => onSubmit(form, status)}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RotateCw size={16} />}
            Save Review & Start Next Cycle
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CycleHistoryModal({
  cycles, onClose,
}: {
  cycles: GoalCycle[];
  onClose: () => void;
}) {
  return (
    <Modal isOpen={true} onClose={onClose} title="Cycle History" size="md">
      <div className="space-y-3 max-h-[60vh] overflow-y-auto">
        {cycles.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">No past cycles yet.</p>
        ) : (
          cycles.map((cycle) => (
            <div key={cycle.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-slate-900 dark:text-white">Cycle {cycle.cycle_number}</h4>
                <span className={`badge text-[10px] ${
                  cycle.status === 'completed' ? 'bg-success-100 dark:bg-success-950/40 text-success-700 dark:text-success-400' :
                  cycle.status === 'partially_completed' ? 'bg-warning-100 dark:bg-warning-950/40 text-warning-700 dark:text-warning-400' :
                  cycle.status === 'not_completed' ? 'bg-error-100 dark:bg-error-950/40 text-error-700 dark:text-error-400' :
                  'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}>{cycle.status.replace('_', ' ')}</span>
              </div>
              <p className="text-xs text-slate-400">
                {formatDate(cycle.start_date)} — {formatDate(cycle.end_date)}
              </p>
              {cycle.review_completed && (
                <p className="text-xs text-success-600 dark:text-success-400 mt-1 flex items-center gap-1">
                  <CheckCircle2 size={11} /> Review completed
                </p>
              )}
            </div>
          ))
        )}
      </div>
      <div className="flex justify-end pt-3">
        <button onClick={onClose} className="btn-secondary">Close</button>
      </div>
    </Modal>
  );
}

function NewCycleModal({
  previousGoals, onClose, onCreate,
}: {
  previousGoals: Goal[];
  onClose: () => void;
  onCreate: (carryForwardIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Start New 90-Day Cycle" size="md">
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Select goals from your previous cycle to carry forward, or start fresh.
        </p>
        {previousGoals.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">No previous goals to carry forward.</p>
        ) : (
          <div className="space-y-2 max-h-[40vh] overflow-y-auto">
            {previousGoals.map((goal) => (
              <label
                key={goal.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(goal.id)}
                  onChange={() => toggle(goal.id)}
                  className="w-4 h-4 rounded"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{goal.title}</p>
                  <p className="text-xs text-slate-400">{goal.status}</p>
                </div>
              </label>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => onCreate(selected)} className="btn-primary">
            <Plus size={16} /> Start Cycle
          </button>
        </div>
      </div>
    </Modal>
  );
}
