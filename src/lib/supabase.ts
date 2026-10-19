import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  account_type: 'personal' | 'business';
  business_name: string | null;
  timezone: string;
  avatar_url: string | null;
  onboarding_completed: boolean;
  onboarding_step: number;
  date_of_birth: string | null;
  country: string;
  district: string;
  education_level: string;
  skills_talents: string;
  languages_spoken: string;
  personal_responsibilities: string;
  areas_to_improve: string;
  created_at: string;
  updated_at: string;
};

export type UserEmployment = {
  id: string;
  user_id: string;
  employment_status: string[];
  work_description: string;
  skills_used: string;
  income_sources: string;
  income_type: '' | 'regular' | 'irregular' | 'zero';
  looking_for_work: boolean;
  work_challenges: string;
  created_at: string;
  updated_at: string;
};

export type UserSocial = {
  id: string;
  user_id: string;
  living_situation: string;
  family_responsibilities: string;
  community_opportunities: string;
  community_challenges: string;
  has_internet: boolean;
  has_computer: boolean;
  has_smartphone: boolean;
  daily_available_hours: number;
  support_network: string;
  external_challenges: string;
  created_at: string;
  updated_at: string;
};

export type OnboardingProgress = {
  id: string;
  user_id: string;
  step: number;
  step_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type GoalCycle = {
  id: string;
  user_id: string;
  cycle_number: number;
  start_date: string;
  end_date: string;
  status: 'active' | 'completed' | 'partially_completed' | 'not_completed' | 'reviewing';
  review_completed: boolean;
  carried_forward_goals: string;
  created_at: string;
  updated_at: string;
};

export type CycleReview = {
  id: string;
  user_id: string;
  cycle_id: string;
  goals_achieved: string;
  goals_partial: string;
  goals_not_achieved: string;
  success_factors: string;
  obstacles: string;
  lessons: string;
  next_cycle_changes: string;
  next_cycle_goals: string;
  created_at: string;
};

export type DailyPlan = {
  id: string;
  user_id: string;
  plan_date: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type Task = {
  id: string;
  plan_id: string;
  user_id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  start_time: string | null;
  end_time: string | null;
  estimated_duration_minutes: number;
  category: string;
  completed: boolean;
  completed_at: string | null;
  notes: string;
  deadline: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type EveningReview = {
  id: string;
  user_id: string;
  review_date: string;
  accomplishments: string;
  incomplete_tasks: string;
  reasons_incomplete: string;
  difficulties: string;
  lessons_learned: string;
  improvements: string;
  ai_summary: string | null;
  summary_approved: boolean;
  tasks_planned: number;
  tasks_completed: number;
  created_at: string;
  updated_at: string;
};

export type Goal = {
  id: string;
  user_id: string;
  title: string;
  why_it_matters: string;
  current_situation: string;
  available_resources: string;
  skills_strengths: string;
  daily_responsibilities: string;
  local_environment: string;
  obstacles_risks: string;
  available_time: string;
  available_budget: string;
  success_metrics: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'completed' | 'paused' | 'abandoned';
  cycle_id: string | null;
  is_primary: boolean;
  desired_outcome: string;
  goal_area: string;
  target_completion_date: string | null;
  created_at: string;
  updated_at: string;
};

export type Milestone = {
  id: string;
  goal_id: string;
  user_id: string;
  title: string;
  description: string;
  month_number: 1 | 2 | 3;
  target_date: string | null;
  weekly_objectives: string;
  daily_tasks_hint: string;
  success_indicators: string;
  potential_obstacles: string;
  solutions: string;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Account = {
  id: string;
  user_id: string;
  name: string;
  account_type: 'cash' | 'bank' | 'mobile_money' | 'savings' | 'other';
  provider: string | null;
  balance: number;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Transaction = {
  id: string;
  user_id: string;
  transaction_type: 'income' | 'expense' | 'transfer' | 'savings_contribution' | 'savings_withdrawal';
  amount: number;
  account_id: string | null;
  to_account_id: string | null;
  category: string;
  description: string;
  payment_method: string;
  reference: string | null;
  transaction_date: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type Achievement = {
  id: string;
  code: string;
  name: string;
  description: string;
  tier: 'gold' | 'silver' | 'bronze';
  icon: string;
  criteria: string;
  created_at: string;
};

export type UserAchievement = {
  id: string;
  user_id: string;
  achievement_id: string;
  earned_at: string;
};

export type ChatMessage = {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  detected_language: string | null;
  detection_confidence: number;
  response_language: string | null;
  english_translation: string | null;
  translation_used: boolean;
  translation_error: string | null;
  source: string;
  created_at: string;
};

export const LANGUAGE_LABELS: Record<string, string> = {
  automatic: 'Automatic',
  en: 'English',
  rw: 'Kinyarwanda',
  fr: 'French',
  sw: 'Kiswahili',
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  notification_type: 'reminder' | 'achievement' | 'report' | 'info' | 'ai';
  is_read: boolean;
  action_url: string | null;
  scheduled_for: string | null;
  created_at: string;
};

export type UserPreferences = {
  id: string;
  theme: 'light' | 'dark';
  planning_time: string;
  review_time: string;
  weekly_report_day: number;
  monthly_report_day: number;
  currency: string;
  notifications_enabled: boolean;
  browser_notifications_enabled: boolean;
  ollama_endpoint: string;
  ollama_model: string;
  preferred_language: 'automatic' | 'en' | 'rw' | 'fr' | 'sw';
  created_at: string;
  updated_at: string;
};

export type Report = {
  id: string;
  user_id: string;
  report_type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';
  title: string;
  content: string;
  period_start: string;
  period_end: string;
  tasks_planned: number;
  tasks_completed: number;
  total_income: number;
  total_expenses: number;
  net_cash_flow: number;
  savings_balance: number;
  ai_analysis: string | null;
  created_at: string;
};
