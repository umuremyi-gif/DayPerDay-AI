import { useState, useEffect, useCallback } from 'react';
import { Moon, Save, CheckCircle2, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { supabase, EveningReview, Task } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { todayISO, formatDate } from '@/lib/utils';
import EmptyState from '@/components/ui/EmptyState';

const reviewQuestions = [
  { key: 'accomplishments', label: 'What did you accomplish today?', placeholder: 'List your completed tasks and achievements...' },
  { key: 'incomplete_tasks', label: 'Which tasks were not completed?', placeholder: 'Tasks that you planned but didn\'t finish...' },
  { key: 'reasons_incomplete', label: 'Why were they not completed?', placeholder: 'What got in the way? Be honest with yourself...' },
  { key: 'difficulties', label: 'What difficulties did you face?', placeholder: 'Challenges, obstacles, or frustrations...' },
  { key: 'lessons_learned', label: 'What did you learn today?', placeholder: 'Insights, realizations, or new understanding...' },
  { key: 'improvements', label: 'What should you improve tomorrow?', placeholder: 'Specific actions you\'ll take differently...' },
] as const;

export default function EveningReviewPage() {
  const { profile, preferences } = useAuth();
  const { showToast } = useToast();
  const [review, setReview] = useState<EveningReview | null>(null);
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    if (!profile) return;
    const today = todayISO();

    const { data: existingReview } = await supabase
      .from('evening_reviews')
      .select('*')
      .eq('user_id', profile.id)
      .eq('review_date', today)
      .maybeSingle();

    if (existingReview) {
      setReview(existingReview as EveningReview);
      setFormData({
        accomplishments: existingReview.accomplishments,
        incomplete_tasks: existingReview.incomplete_tasks,
        reasons_incomplete: existingReview.reasons_incomplete,
        difficulties: existingReview.difficulties,
        lessons_learned: existingReview.lessons_learned,
        improvements: existingReview.improvements,
      });
    }

    // Get today's tasks
    const { data: planData } = await supabase
      .from('daily_plans')
      .select('id')
      .eq('user_id', profile.id)
      .eq('plan_date', today)
      .maybeSingle();

    if (planData) {
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('plan_id', planData.id)
        .order('sort_order');
      setTodayTasks(tasksData as Task[] || []);
    }

    setLoading(false);
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSave(approved = false) {
    if (!profile) return;
    const today = todayISO();
    const completedCount = todayTasks.filter((t) => t.completed).length;

    const payload = {
      user_id: profile.id,
      review_date: today,
      accomplishments: formData.accomplishments || '',
      incomplete_tasks: formData.incomplete_tasks || '',
      reasons_incomplete: formData.reasons_incomplete || '',
      difficulties: formData.difficulties || '',
      lessons_learned: formData.lessons_learned || '',
      improvements: formData.improvements || '',
      tasks_planned: todayTasks.length,
      tasks_completed: completedCount,
      summary_approved: approved,
    };

    if (review) {
      const { data } = await supabase
        .from('evening_reviews')
        .update(payload)
        .eq('id', review.id)
        .select()
        .single();
      setReview(data as EveningReview);
    } else {
      const { data } = await supabase
        .from('evening_reviews')
        .insert(payload)
        .select()
        .single();
      setReview(data as EveningReview);
    }

    showToast(approved ? 'Review saved and approved!' : 'Review saved', 'success');
  }

  async function generateSummary() {
    if (!profile) return;
    setGenerating(true);

    try {
      // Try to call the backend Ollama service
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/ai/evening-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: profile.id,
          review_data: formData,
          tasks: todayTasks,
          preferred_language: preferences?.preferred_language || 'automatic',
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (review) {
          const { data } = await supabase
            .from('evening_reviews')
            .update({ ai_summary: result.summary })
            .eq('id', review.id)
            .select()
            .single();
          setReview(data as EveningReview);
        }
        showToast('AI summary generated!', 'success');
      } else {
        // Fallback: generate a basic summary from user data
        const completedCount = todayTasks.filter((t) => t.completed).length;
        const completionRate = todayTasks.length > 0 ? Math.round((completedCount / todayTasks.length) * 100) : 0;
        const summary = `Today you completed ${completedCount} out of ${completedCount + (todayTasks.length - completedCount)} planned tasks (${completionRate}% completion rate). ${
          formData.accomplishments ? `Your main accomplishments: ${formData.accomplishments}. ` : ''
        }${formData.improvements ? `For tomorrow, you plan to: ${formData.improvements}.` : 'Consider setting specific improvement goals for tomorrow.'}`;

        if (review) {
          const { data } = await supabase
            .from('evening_reviews')
            .update({ ai_summary: summary })
            .eq('id', review.id)
            .select()
            .single();
          setReview(data as EveningReview);
        }
        showToast('Using basic summary (AI service unavailable)', 'info');
      }
    } catch {
      // Fallback summary from user data
      const completedCount = todayTasks.filter((t) => t.completed).length;
      const summary = `Today you completed ${completedCount} out of ${todayTasks.length} planned tasks. ${
        formData.accomplishments ? `Accomplishments: ${formData.accomplishments}. ` : ''
      }${formData.improvements ? `Tomorrow's improvements: ${formData.improvements}.` : ''}`;

      if (review) {
        const { data } = await supabase
          .from('evening_reviews')
          .update({ ai_summary: summary })
          .eq('id', review.id)
          .select()
          .single();
        setReview(data as EveningReview);
      }
      showToast('Using basic summary (AI service offline)', 'info');
    }

    setGenerating(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" /></div>;
  }

  const completedCount = todayTasks.filter((t) => t.completed).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-6 bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-900 dark:to-slate-850 border-slate-700 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center">
            <Moon size={24} className="text-primary-400" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-white">Evening Review</h2>
            <p className="text-sm text-slate-400 mt-1">{formatDate(new Date(), { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
        {todayTasks.length > 0 && (
          <div className="mt-4 flex items-center gap-4 pt-4 border-t border-slate-700">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-success-400" />
              <span className="text-sm text-slate-300">{completedCount} completed</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-warning-400" />
              <span className="text-sm text-slate-300">{todayTasks.length - completedCount} incomplete</span>
            </div>
            <div className="text-sm text-slate-300">{todayTasks.length} total tasks</div>
          </div>
        )}
      </div>

      {/* Task comparison */}
      {todayTasks.length > 0 && (
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Planned vs Actual</h3>
          <div className="space-y-2">
            {todayTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                {task.completed ? (
                  <CheckCircle2 size={18} className="text-success-500 flex-shrink-0" />
                ) : (
                  <AlertCircle size={18} className="text-warning-500 flex-shrink-0" />
                )}
                <span className={`text-sm ${task.completed ? 'text-slate-600 dark:text-slate-300' : 'text-slate-700 dark:text-slate-200'}`}>
                  {task.title || 'Untitled task'}
                </span>
                <span className={`ml-auto text-xs ${task.completed ? 'text-success-500' : 'text-warning-500'}`}>
                  {task.completed ? 'Done' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review questions */}
      <div className="card p-6">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Reflect on Your Day</h3>
        <div className="space-y-4">
          {reviewQuestions.map((q) => (
            <div key={q.key}>
              <label className="label">{q.label}</label>
              <textarea
                value={formData[q.key] || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, [q.key]: e.target.value }))}
                rows={2}
                className="input resize-none"
                placeholder={q.placeholder}
              />
            </div>
          ))}
        </div>
      </div>

      {/* AI Summary */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles size={18} className="text-primary-500" /> AI Daily Summary
          </h3>
          <button
            onClick={generateSummary}
            disabled={generating}
            className="btn-primary text-sm"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {generating ? 'Generating...' : 'Generate Summary'}
          </button>
        </div>
        {review?.ai_summary ? (
          <div className="p-4 rounded-xl bg-primary-50 dark:bg-primary-950/20 border border-primary-200 dark:border-primary-800">
            <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{review.ai_summary}</p>
            {!review.summary_approved && (
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => handleSave(true)}
                  className="btn-primary text-sm"
                >
                  <CheckCircle2 size={16} /> Review & Approve
                </button>
                <span className="text-xs text-slate-400">Approve to add this to your history</span>
              </div>
            )}
            {review.summary_approved && (
              <div className="mt-3 flex items-center gap-2 text-success-600 dark:text-success-400">
                <CheckCircle2 size={16} />
                <span className="text-sm">Summary approved and saved to history</span>
              </div>
            )}
          </div>
        ) : (
          <EmptyState
            icon={Sparkles}
            title="No summary yet"
            description="Click 'Generate Summary' to create an AI-powered summary of your day. If the AI service is unavailable, a basic summary will be created from your data."
          />
        )}
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button onClick={() => handleSave(false)} className="btn-primary">
          <Save size={16} /> Save Review
        </button>
      </div>
    </div>
  );
}
