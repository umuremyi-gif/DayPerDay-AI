import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Briefcase, Users, Target, CheckCircle2, ChevronLeft,
  ChevronRight, Save, Loader2, Sparkles, AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useToast } from '@/components/ui/Toast';
import Logo from '@/components/ui/Logo';
import { formatDate } from '@/lib/utils';

const employmentOptions = [
  'Employed by a company',
  'Self-employed / running a business',
  'Student',
  'Looking for a job',
  'Unemployed, not looking',
  'Farmer',
  'Freelancer / casual worker',
  'Other',
];

const goalAreas = [
  'Education & Learning', 'Employment & Career', 'Business & Entrepreneurship',
  'Personal Finances & Savings', 'Health & Personal Development',
  'Family & Community', 'Technology & Digital Skills', 'Other',
];

export default function OnboardingWizard() {
  const { profile } = useAuth();
  const { savedStep, savedProgress, saveStepProgress, completeOnboarding } = useOnboarding();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(savedStep || 1);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // Form data for all steps
  const [step1, setStep1] = useState<Record<string, string>>({});
  const [step2, setStep2] = useState<Record<string, unknown>>({});
  const [step3, setStep3] = useState<Record<string, unknown>>({});
  const [step4Data, setStep4Data] = useState<{ goals: Partial<OnboardingGoal>[] }>({ goals: [] });
  const [step5Data, setStep5Data] = useState<{ approved: boolean }>({ approved: false });

  type OnboardingGoal = {
    title: string;
    why_it_matters: string;
    current_situation: string;
    desired_outcome: string;
    success_metrics: string;
    target_completion_date: string;
    available_time: string;
    obstacles_risks: string;
    goal_area: string;
    is_primary: boolean;
  };

  // Load saved progress
  useEffect(() => {
    if (savedProgress?.step_data) {
      const d = savedProgress.step_data as Record<string, unknown>;
      if (d.step1) setStep1(d.step1 as Record<string, string>);
      if (d.step2) setStep2(d.step2 as Record<string, unknown>);
      if (d.step3) setStep3(d.step3 as Record<string, unknown>);
      if (d.step4) setStep4Data(d.step4 as { goals: Partial<OnboardingGoal>[] });
      if (d.step5) setStep5Data(d.step5 as { approved: boolean });
    }
    setStep(Math.max(1, savedStep || 1));
  }, [savedProgress]);

  const totalSteps = 5;

  function collectAllData() {
    return { step1, step2, step3, step4: step4Data, step5: step5Data };
  }

  async function handleSaveProgress() {
    setSaving(true);
    await saveStepProgress(step, collectAllData());
    showToast('Progress saved. You can continue later.', 'success');
    setSaving(false);
  }

  async function handleNext() {
    await saveStepProgress(step, collectAllData());
    if (step < totalSteps) setStep(step + 1);
  }

  async function handlePrev() {
    await saveStepProgress(step, collectAllData());
    if (step > 1) setStep(step - 1);
  }

  async function handleFinish() {
    if (!profile) return;
    if (!step5Data.approved) {
      showToast('Please review and approve the plan before finishing.', 'error');
      return;
    }
    setFinishing(true);

    try {
      // Save step 1 data to profile
      await supabase.from('profiles').update({
        full_name: step1.full_name || profile.full_name,
        date_of_birth: step1.date_of_birth || null,
        country: step1.country || '',
        district: step1.district || '',
        education_level: step1.education_level || '',
        skills_talents: step1.skills_talents || '',
        languages_spoken: step1.languages_spoken || '',
        personal_responsibilities: step1.personal_responsibilities || '',
        areas_to_improve: step1.areas_to_improve || '',
      }).eq('id', profile.id);

      // Save step 2 — employment (upsert)
      const existingEmp = await supabase.from('user_employment').select('id').eq('user_id', profile.id).maybeSingle();
      const empData = {
        user_id: profile.id,
        employment_status: step2.employment_status as string[] || [],
        work_description: step2.work_description as string || '',
        skills_used: step2.skills_used as string || '',
        income_sources: step2.income_sources as string || '',
        income_type: step2.income_type as string || '',
        looking_for_work: step2.looking_for_work as boolean || false,
        work_challenges: step2.work_challenges as string || '',
      };
      if (existingEmp.data) {
        await supabase.from('user_employment').update(empData).eq('user_id', profile.id);
      } else {
        await supabase.from('user_employment').insert(empData);
      }

      // Save step 3 — social (upsert)
      const existingSocial = await supabase.from('user_social').select('id').eq('user_id', profile.id).maybeSingle();
      const socialData = {
        user_id: profile.id,
        living_situation: step3.living_situation as string || '',
        family_responsibilities: step3.family_responsibilities as string || '',
        community_opportunities: step3.community_opportunities as string || '',
        community_challenges: step3.community_challenges as string || '',
        has_internet: step3.has_internet as boolean ?? true,
        has_computer: step3.has_computer as boolean ?? false,
        has_smartphone: step3.has_smartphone as boolean ?? true,
        daily_available_hours: step3.daily_available_hours as number || 2,
        support_network: step3.support_network as string || '',
        external_challenges: step3.external_challenges as string || '',
      };
      if (existingSocial.data) {
        await supabase.from('user_social').update(socialData).eq('user_id', profile.id);
      } else {
        await supabase.from('user_social').insert(socialData);
      }

      // Save step 4 — create goal cycle + goals
      const today = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];

      const { data: cycle } = await supabase
        .from('goal_cycles')
        .insert({
          user_id: profile.id,
          cycle_number: 1,
          start_date: today,
          end_date: endDate,
          status: 'active',
        })
        .select()
        .single();

      if (cycle && step4Data.goals.length > 0) {
        for (const g of step4Data.goals) {
          if (!g.title) continue;
          await supabase.from('goals').insert({
            user_id: profile.id,
            cycle_id: cycle.id,
            title: g.title,
            why_it_matters: g.why_it_matters || '',
            current_situation: g.current_situation || '',
            desired_outcome: g.desired_outcome || '',
            success_metrics: g.success_metrics || '',
            target_completion_date: g.target_completion_date || endDate,
            available_time: g.available_time || '',
            obstacles_risks: g.obstacles_risks || '',
            goal_area: g.goal_area || 'Other',
            is_primary: g.is_primary || false,
            start_date: today,
            end_date: endDate,
            status: 'active',
          });
        }
      }

      await completeOnboarding();
      showToast('Onboarding complete! Welcome to DayPerDay AI.', 'success');
      navigate('/dashboard');
    } catch (e) {
      showToast('Something went wrong saving your data. Please try again.', 'error');
    }

    setFinishing(false);
  }

  const stepIcons = [User, Briefcase, Users, Target, CheckCircle2];
  const stepLabels = ['Personal Info', 'Employment', 'Social', 'Goals', 'Review'];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 py-4 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Logo size="sm" />
          <button onClick={handleSaveProgress} disabled={saving} className="btn-ghost text-sm">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Progress
          </button>
        </div>
      </header>

      {/* Progress bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Step {step} of {totalSteps}: {stepLabels[step - 1]}
            </span>
            <span className="text-xs text-slate-400">{Math.round((step / totalSteps) * 100)}% complete</span>
          </div>
          <div className="flex gap-2">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                className={`flex-1 h-2 rounded-full transition-all ${
                  i + 1 <= step
                    ? 'bg-primary-500'
                    : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {step === 1 && <Step1Personal data={step1} onChange={setStep1} />}
          {step === 2 && <Step2Employment data={step2} onChange={setStep2} />}
          {step === 3 && <Step3Social data={step3} onChange={setStep3} />}
          {step === 4 && <Step4Goals data={step4Data} onChange={setStep4Data} />}
          {step === 5 && <Step5Review data={step5Data} onChange={setStep5Data} allData={collectAllData()} />}
        </div>
      </div>

      {/* Footer navigation */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-4 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={step === 1}
            className="btn-secondary text-sm"
          >
            <ChevronLeft size={16} /> Previous
          </button>
          {step < totalSteps ? (
            <button onClick={handleNext} className="btn-primary text-sm">
              Continue <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={handleFinish} disabled={finishing || !step5Data.approved} className="btn-primary text-sm">
              {finishing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Finish & Start
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

// ==================== STEP 1 ====================
function Step1Personal({ data, onChange }: { data: Record<string, string>; onChange: (d: Record<string, string>) => void }) {
  const set = (key: string, val: string) => onChange({ ...data, [key]: val });

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Tell us about yourself</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          This information helps personalize your experience. Fields marked optional can be skipped.
        </p>
      </div>

      <div className="card p-6 space-y-4">
        <div>
          <label className="label">Full Name <span className="text-error-500">*</span></label>
          <input value={data.full_name || ''} onChange={(e) => set('full_name', e.target.value)} className="input" placeholder="Your full name" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Date of Birth (optional)</label>
            <input type="date" value={data.date_of_birth || ''} onChange={(e) => set('date_of_birth', e.target.value)} className="input" />
            <p className="text-xs text-slate-400 mt-1">Used to tailor age-appropriate recommendations.</p>
          </div>
          <div>
            <label className="label">Education Level (optional)</label>
            <select value={data.education_level || ''} onChange={(e) => set('education_level', e.target.value)} className="input">
              <option value="">Select...</option>
              <option>Primary</option>
              <option>Secondary</option>
              <option>Vocational / Technical</option>
              <option>Diploma</option>
              <option>Bachelor's Degree</option>
              <option>Master's Degree</option>
              <option>PhD</option>
              <option>Other</option>
            </select>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Country</label>
            <input value={data.country || ''} onChange={(e) => set('country', e.target.value)} className="input" placeholder="e.g. Rwanda" />
          </div>
          <div>
            <label className="label">District / City</label>
            <input value={data.district || ''} onChange={(e) => set('district', e.target.value)} className="input" placeholder="e.g. Kigali" />
          </div>
        </div>
        <div>
          <label className="label">Main Skills and Talents (optional)</label>
          <textarea value={data.skills_talents || ''} onChange={(e) => set('skills_talents', e.target.value)} rows={2} className="input resize-none" placeholder="What are you good at?" />
        </div>
        <div>
          <label className="label">Languages Spoken (optional)</label>
          <input value={data.languages_spoken || ''} onChange={(e) => set('languages_spoken', e.target.value)} className="input" placeholder="e.g. Kinyarwanda, English, French" />
        </div>
        <div>
          <label className="label">Main Personal Responsibilities (optional)</label>
          <textarea value={data.personal_responsibilities || ''} onChange={(e) => set('personal_responsibilities', e.target.value)} rows={2} className="input resize-none" placeholder="What do you take care of daily?" />
        </div>
        <div>
          <label className="label">Areas of Life You Want to Improve (optional)</label>
          <textarea value={data.areas_to_improve || ''} onChange={(e) => set('areas_to_improve', e.target.value)} rows={2} className="input resize-none" placeholder="e.g. time management, savings, health..." />
        </div>
      </div>
    </div>
  );
}

// ==================== STEP 2 ====================
function Step2Employment({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const set = (key: string, val: unknown) => onChange({ ...data, [key]: val });
  const statuses = (data.employment_status as string[]) || [];

  function toggleStatus(opt: string) {
    const current = statuses.includes(opt);
    set('employment_status', current ? statuses.filter((s) => s !== opt) : [...statuses, opt]);
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Your work and economic situation</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          We never assume you have a job, income, or savings. This helps us give realistic advice.
        </p>
      </div>

      <div className="card p-6 space-y-4">
        <div>
          <label className="label">What is your current work or employment situation? <span className="text-error-500">*</span></label>
          <p className="text-xs text-slate-400 mb-2">Select all that apply.</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {employmentOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => toggleStatus(opt)}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm text-left transition-all ${
                  statuses.includes(opt)
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                  statuses.includes(opt) ? 'bg-primary-500 border-primary-500' : 'border-slate-300 dark:border-slate-600'
                }`}>
                  {statuses.includes(opt) && <CheckCircle2 size={10} className="text-white" />}
                </div>
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">What work do you do? (optional)</label>
          <input value={(data.work_description as string) || ''} onChange={(e) => set('work_description', e.target.value)} className="input" placeholder="Describe your work or business" />
        </div>
        <div>
          <label className="label">What skills do you use? (optional)</label>
          <input value={(data.skills_used as string) || ''} onChange={(e) => set('skills_used', e.target.value)} className="input" placeholder="Skills you use in your work" />
        </div>
        <div>
          <label className="label">What are your main sources of income? (optional)</label>
          <input value={(data.income_sources as string) || ''} onChange={(e) => set('income_sources', e.target.value)} className="input" placeholder="e.g. salary, business, farming" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Is your income regular, irregular, or zero?</label>
            <select value={(data.income_type as string) || ''} onChange={(e) => set('income_type', e.target.value)} className="input">
              <option value="">Select...</option>
              <option value="regular">Regular</option>
              <option value="irregular">Irregular</option>
              <option value="zero">Currently zero</option>
            </select>
          </div>
          <div>
            <label className="label">Are you looking for a job or business opportunity?</label>
            <select
              value={(data.looking_for_work as boolean) ? 'yes' : 'no'}
              onChange={(e) => set('looking_for_work', e.target.value === 'yes')}
              className="input"
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">What challenges are you facing in your work or financial situation? (optional)</label>
          <textarea value={(data.work_challenges as string) || ''} onChange={(e) => set('work_challenges', e.target.value)} rows={2} className="input resize-none" placeholder="Describe any difficulties..." />
        </div>
      </div>
    </div>
  );
}

// ==================== STEP 3 ====================
function Step3Social({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const set = (key: string, val: unknown) => onChange({ ...data, [key]: val });

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Your social environment</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Understanding your environment helps us set realistic goals. You can skip any question.
        </p>
      </div>

      <div className="card p-6 space-y-4">
        <div>
          <label className="label">Who do you live with? (optional)</label>
          <input value={(data.living_situation as string) || ''} onChange={(e) => set('living_situation', e.target.value)} className="input" placeholder="e.g. family, alone, roommates" />
        </div>
        <div>
          <label className="label">What responsibilities do you have toward your family or community? (optional)</label>
          <textarea value={(data.family_responsibilities as string) || ''} onChange={(e) => set('family_responsibilities', e.target.value)} rows={2} className="input resize-none" placeholder="e.g. caring for children, community role..." />
        </div>
        <div>
          <label className="label">What opportunities are available in your community? (optional)</label>
          <textarea value={(data.community_opportunities as string) || ''} onChange={(e) => set('community_opportunities', e.target.value)} rows={2} className="input resize-none" placeholder="Markets, schools, networks, resources..." />
        </div>
        <div>
          <label className="label">What difficulties in your society affect your progress? (optional)</label>
          <textarea value={(data.community_challenges as string) || ''} onChange={(e) => set('community_challenges', e.target.value)} rows={2} className="input resize-none" placeholder="Infrastructure, access, social barriers..." />
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Internet Access</label>
            <select value={(data.has_internet as boolean) ? 'yes' : 'no'} onChange={(e) => set('has_internet', e.target.value === 'yes')} className="input">
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div>
            <label className="label">Computer Access</label>
            <select value={(data.has_computer as boolean) ? 'yes' : 'no'} onChange={(e) => set('has_computer', e.target.value === 'yes')} className="input">
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div>
            <label className="label">Smartphone Access</label>
            <select value={(data.has_smartphone as boolean) ? 'yes' : 'no'} onChange={(e) => set('has_smartphone', e.target.value === 'yes')} className="input">
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">How much time can you realistically dedicate to your goals each day?</label>
          <select
            value={String(data.daily_available_hours || 2)}
            onChange={(e) => set('daily_available_hours', parseInt(e.target.value))}
            className="input"
          >
            <option value="1">1 hour</option>
            <option value="2">2 hours</option>
            <option value="3">3 hours</option>
            <option value="4">4 hours</option>
            <option value="6">6+ hours</option>
          </select>
        </div>
        <div>
          <label className="label">What resources, supportive people, skills, or networks can help you? (optional)</label>
          <textarea value={(data.support_network as string) || ''} onChange={(e) => set('support_network', e.target.value)} rows={2} className="input resize-none" placeholder="Who or what can support you?" />
        </div>
        <div>
          <label className="label">What external challenges might prevent you from achieving your goals? (optional)</label>
          <textarea value={(data.external_challenges as string) || ''} onChange={(e) => set('external_challenges', e.target.value)} rows={2} className="input resize-none" placeholder="What obstacles do you face?" />
        </div>
      </div>
    </div>
  );
}

// ==================== STEP 4 ====================
function Step4Goals({ data, onChange }: { data: { goals: Partial<{ title: string; why_it_matters: string; current_situation: string; desired_outcome: string; success_metrics: string; target_completion_date: string; available_time: string; obstacles_risks: string; goal_area: string; is_primary: boolean }>[] }; onChange: (d: { goals: Partial<{ title: string; why_it_matters: string; current_situation: string; desired_outcome: string; success_metrics: string; target_completion_date: string; available_time: string; obstacles_risks: string; goal_area: string; is_primary: boolean }>[] }) => void }) {
  const goals = data.goals || [];
  const endDate = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];

  function addGoal() {
    onChange({ goals: [...goals, { title: '', goal_area: 'Other', is_primary: goals.length === 0, target_completion_date: endDate }] });
  }

  function updateGoal(idx: number, updates: Record<string, unknown>) {
    onChange({ goals: goals.map((g, i) => (i === idx ? { ...g, ...updates } : g)) });
  }

  function removeGoal(idx: number) {
    onChange({ goals: goals.filter((_, i) => i !== idx) });
  }

  function setPrimary(idx: number) {
    onChange({ goals: goals.map((g, i) => ({ ...g, is_primary: i === idx })) });
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          What do you want to achieve in the next 90 days?
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Create one or more goals. Select the most important one as your primary goal.
        </p>
      </div>

      {goals.length === 0 ? (
        <div className="card p-8 text-center">
          <Target size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">No goals added yet.</p>
          <button onClick={addGoal} className="btn-primary text-sm">
            <Target size={16} /> Add Your First Goal
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map((goal, idx) => (
            <div key={idx} className="card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPrimary(idx)}
                    className={`flex items-center gap-2 text-xs font-medium px-2.5 py-1 rounded-full transition-all ${
                      goal.is_primary
                        ? 'bg-primary-100 dark:bg-primary-950/40 text-primary-700 dark:text-primary-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full ${goal.is_primary ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                    {goal.is_primary ? 'Primary Goal' : 'Set as Primary'}
                  </button>
                </div>
                <button onClick={() => removeGoal(idx)} className="text-slate-400 hover:text-error-500 p-1">
                  <span className="text-sm">Remove</span>
                </button>
              </div>
              <div>
                <label className="label">Goal Title</label>
                <input value={goal.title || ''} onChange={(e) => updateGoal(idx, { title: e.target.value })} className="input" placeholder="What do you want to achieve?" />
              </div>
              <div>
                <label className="label">Goal Area</label>
                <select value={goal.goal_area || 'Other'} onChange={(e) => updateGoal(idx, { goal_area: e.target.value })} className="input">
                  {goalAreas.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Why does this goal matter to you?</label>
                <textarea value={goal.why_it_matters || ''} onChange={(e) => updateGoal(idx, { why_it_matters: e.target.value })} rows={2} className="input resize-none" placeholder="Your motivation..." />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Current Starting Point</label>
                  <input value={goal.current_situation || ''} onChange={(e) => updateGoal(idx, { current_situation: e.target.value })} className="input" placeholder="Where are you now?" />
                </div>
                <div>
                  <label className="label">Desired Outcome</label>
                  <input value={goal.desired_outcome || ''} onChange={(e) => updateGoal(idx, { desired_outcome: e.target.value })} className="input" placeholder="What does success look like?" />
                </div>
              </div>
              <div>
                <label className="label">How will you measure progress?</label>
                <input value={goal.success_metrics || ''} onChange={(e) => updateGoal(idx, { success_metrics: e.target.value })} className="input" placeholder="e.g. Save 50,000 RWF, complete 3 courses..." />
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="label">Target Date</label>
                  <input type="date" value={goal.target_completion_date || endDate} onChange={(e) => updateGoal(idx, { target_completion_date: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="label">Available Time</label>
                  <input value={goal.available_time || ''} onChange={(e) => updateGoal(idx, { available_time: e.target.value })} className="input" placeholder="e.g. 2h/day" />
                </div>
                <div>
                  <label className="label">Expected Challenges</label>
                  <input value={goal.obstacles_risks || ''} onChange={(e) => updateGoal(idx, { obstacles_risks: e.target.value })} className="input" placeholder="What might get in the way?" />
                </div>
              </div>
            </div>
          ))}
          <button onClick={addGoal} className="btn-secondary text-sm w-full">
            <Target size={16} /> Add Another Goal
          </button>
        </div>
      )}
    </div>
  );
}

// ==================== STEP 5 ====================
function Step5Review({ data, onChange, allData }: { data: { approved: boolean }; onChange: (d: { approved: boolean }) => void; allData: Record<string, unknown> }) {
  const step1 = (allData.step1 as Record<string, string>) || {};
  const step2 = (allData.step2 as Record<string, unknown>) || {};
  const step3 = (allData.step3 as Record<string, unknown>) || {};
  const step4 = (allData.step4 as { goals: Partial<{ title: string; why_it_matters: string; current_situation: string; desired_outcome: string; success_metrics: string; target_completion_date: string; available_time: string; obstacles_risks: string; goal_area: string; is_primary: boolean }>[] }) || { goals: [] };
  const goals = step4.goals || [];
  const primaryGoal = goals.find((g) => g.is_primary) || goals[0];

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Review and approve your plan</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Check your information below. When ready, approve to start your 90-day journey.
        </p>
      </div>

      <div className="card p-6">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <User size={18} className="text-primary-500" /> Personal Information
        </h3>
        <dl className="grid sm:grid-cols-2 gap-2 text-sm">
          <div><dt className="text-slate-400">Name</dt><dd className="text-slate-700 dark:text-slate-200">{step1.full_name || '—'}</dd></div>
          <div><dt className="text-slate-400">Location</dt><dd className="text-slate-700 dark:text-slate-200">{[step1.country, step1.district].filter(Boolean).join(', ') || '—'}</dd></div>
          <div><dt className="text-slate-400">Education</dt><dd className="text-slate-700 dark:text-slate-200">{step1.education_level || '—'}</dd></div>
          <div><dt className="text-slate-400">Skills</dt><dd className="text-slate-700 dark:text-slate-200">{step1.skills_talents || '—'}</dd></div>
        </dl>
      </div>

      <div className="card p-6">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <Briefcase size={18} className="text-primary-500" /> Employment Situation
        </h3>
        <dl className="grid sm:grid-cols-2 gap-2 text-sm">
          <div><dt className="text-slate-400">Status</dt><dd className="text-slate-700 dark:text-slate-200">{((step2.employment_status as string[]) || []).join(', ') || '—'}</dd></div>
          <div><dt className="text-slate-400">Income Type</dt><dd className="text-slate-700 dark:text-slate-200 capitalize">{(step2.income_type as string) || '—'}</dd></div>
          <div><dt className="text-slate-400">Work</dt><dd className="text-slate-700 dark:text-slate-200">{(step2.work_description as string) || '—'}</dd></div>
        </dl>
      </div>

      <div className="card p-6">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <Target size={18} className="text-primary-500" /> Your 90-Day Goals
        </h3>
        {goals.length === 0 ? (
          <p className="text-sm text-slate-400">No goals defined.</p>
        ) : (
          <div className="space-y-3">
            {goals.map((g, i) => (
              <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-2 mb-1">
                  {g.is_primary && <span className="badge text-[10px] bg-primary-100 dark:bg-primary-950/40 text-primary-700 dark:text-primary-400">Primary</span>}
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{g.title || 'Untitled Goal'}</span>
                </div>
                <p className="text-xs text-slate-400">{g.goal_area} — {g.why_it_matters}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-6 bg-primary-50 dark:bg-primary-950/20 border-primary-200 dark:border-primary-800">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center flex-shrink-0">
            <Sparkles size={20} className="text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900 dark:text-white">Your Plan</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              We'll create a 90-day cycle starting today with your goals. You can edit them anytime in the Goals page,
              and we'll help break them into monthly milestones and weekly targets.
            </p>
            {primaryGoal && (
              <div className="mt-3 p-3 rounded-lg bg-white dark:bg-slate-900">
                <p className="text-xs text-slate-400">Your primary goal:</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{primaryGoal.title}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <label className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 cursor-pointer hover:border-primary-300 dark:hover:border-primary-700 transition-all">
        <input
          type="checkbox"
          checked={data.approved}
          onChange={(e) => onChange({ approved: e.target.checked })}
          className="w-5 h-5 rounded accent-primary-600"
        />
        <span className="text-sm text-slate-700 dark:text-slate-200">
          I have reviewed my information and goals. I approve this plan and want to start my 90-day journey.
        </span>
      </label>
    </div>
  );
}
