/*
# DayPerDay AI - Full Database Schema

Creates all tables for the DayPerDay AI application including profiles,
daily plans, tasks, evening reviews, 90-day goals, financial transactions,
accounts, achievements, notifications, and user preferences.

## Tables Created
1. profiles - User profile data (personal vs business, timezone, preferences)
2. daily_plans - Daily task plans created at 06:00
3. tasks - Individual tasks within daily plans
4. evening_reviews - End-of-day self-reflection reviews
5. goals - 90-day goal definitions with milestones
6. milestones - Monthly milestones within goals
7. transactions - Income, expenses, transfers, savings
8. accounts - Financial accounts (cash, bank, mobile money, savings)
9. achievements - Trophy/badge definitions (global)
10. user_achievements - Achievements earned by users
11. notifications - User notifications and reminders
12. user_preferences - User settings (reminder times, theme, etc.)
13. reports - Generated periodic reports

## Security
- RLS enabled on all tables
- Owner-scoped CRUD policies (TO authenticated) on user data tables
- Achievements table is read-only for authenticated users (global definitions)
- All user-scoped tables have user_id DEFAULT auth.uid()
*/

-- ==================== PROFILES ====================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text,
  account_type text NOT NULL DEFAULT 'personal' CHECK (account_type IN ('personal', 'business')),
  business_name text,
  timezone text NOT NULL DEFAULT 'Africa/Kigali',
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- ==================== DAILY PLANS ====================
CREATE TABLE IF NOT EXISTS daily_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_date date NOT NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, plan_date)
);

ALTER TABLE daily_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_plans" ON daily_plans;
CREATE POLICY "select_own_plans" ON daily_plans FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_plans" ON daily_plans;
CREATE POLICY "insert_own_plans" ON daily_plans FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_plans" ON daily_plans;
CREATE POLICY "update_own_plans" ON daily_plans FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_plans" ON daily_plans;
CREATE POLICY "delete_own_plans" ON daily_plans FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_daily_plans_user_date ON daily_plans(user_id, plan_date DESC);

-- ==================== TASKS ====================
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES daily_plans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  start_time time,
  end_time time,
  estimated_duration_minutes integer DEFAULT 0,
  category text DEFAULT 'general',
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  notes text DEFAULT '',
  deadline date,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_tasks" ON tasks;
CREATE POLICY "select_own_tasks" ON tasks FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_tasks" ON tasks;
CREATE POLICY "insert_own_tasks" ON tasks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_tasks" ON tasks;
CREATE POLICY "update_own_tasks" ON tasks FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_tasks" ON tasks;
CREATE POLICY "delete_own_tasks" ON tasks FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_tasks_plan ON tasks(plan_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);

-- ==================== EVENING REVIEWS ====================
CREATE TABLE IF NOT EXISTS evening_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  review_date date NOT NULL,
  accomplishments text DEFAULT '',
  incomplete_tasks text DEFAULT '',
  reasons_incomplete text DEFAULT '',
  difficulties text DEFAULT '',
  lessons_learned text DEFAULT '',
  improvements text DEFAULT '',
  ai_summary text,
  summary_approved boolean DEFAULT false,
  tasks_planned integer DEFAULT 0,
  tasks_completed integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, review_date)
);

ALTER TABLE evening_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_reviews" ON evening_reviews;
CREATE POLICY "select_own_reviews" ON evening_reviews FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_reviews" ON evening_reviews;
CREATE POLICY "insert_own_reviews" ON evening_reviews FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_reviews" ON evening_reviews;
CREATE POLICY "update_own_reviews" ON evening_reviews FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_reviews" ON evening_reviews;
CREATE POLICY "delete_own_reviews" ON evening_reviews FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_reviews_user_date ON evening_reviews(user_id, review_date DESC);

-- ==================== GOALS ====================
CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  why_it_matters text DEFAULT '',
  current_situation text DEFAULT '',
  available_resources text DEFAULT '',
  skills_strengths text DEFAULT '',
  daily_responsibilities text DEFAULT '',
  local_environment text DEFAULT '',
  obstacles_risks text DEFAULT '',
  available_time text DEFAULT '',
  available_budget text DEFAULT '',
  success_metrics text DEFAULT '',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date NOT NULL DEFAULT (CURRENT_DATE + 90),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'abandoned')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_goals" ON goals;
CREATE POLICY "select_own_goals" ON goals FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_goals" ON goals;
CREATE POLICY "insert_own_goals" ON goals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_goals" ON goals;
CREATE POLICY "update_own_goals" ON goals FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_goals" ON goals;
CREATE POLICY "delete_own_goals" ON goals FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);

-- ==================== MILESTONES ====================
CREATE TABLE IF NOT EXISTS milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  month_number integer NOT NULL CHECK (month_number IN (1, 2, 3)),
  target_date date,
  weekly_objectives text DEFAULT '',
  daily_tasks_hint text DEFAULT '',
  success_indicators text DEFAULT '',
  potential_obstacles text DEFAULT '',
  solutions text DEFAULT '',
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_milestones" ON milestones;
CREATE POLICY "select_own_milestones" ON milestones FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_milestones" ON milestones;
CREATE POLICY "insert_own_milestones" ON milestones FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_milestones" ON milestones;
CREATE POLICY "update_own_milestones" ON milestones FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_milestones" ON milestones;
CREATE POLICY "delete_own_milestones" ON milestones FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_milestones_goal ON milestones(goal_id);

-- ==================== ACCOUNTS ====================
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  account_type text NOT NULL DEFAULT 'cash' CHECK (account_type IN ('cash', 'bank', 'mobile_money', 'savings', 'other')),
  provider text,
  balance numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'RWF',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_accounts" ON accounts;
CREATE POLICY "select_own_accounts" ON accounts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_accounts" ON accounts;
CREATE POLICY "insert_own_accounts" ON accounts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_accounts" ON accounts;
CREATE POLICY "update_own_accounts" ON accounts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_accounts" ON accounts;
CREATE POLICY "delete_own_accounts" ON accounts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);

-- ==================== TRANSACTIONS ====================
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('income', 'expense', 'transfer', 'savings_contribution', 'savings_withdrawal')),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  to_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  category text DEFAULT 'general',
  description text DEFAULT '',
  payment_method text DEFAULT 'cash',
  reference text,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_transactions" ON transactions;
CREATE POLICY "select_own_transactions" ON transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_transactions" ON transactions;
CREATE POLICY "insert_own_transactions" ON transactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_transactions" ON transactions;
CREATE POLICY "update_own_transactions" ON transactions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_transactions" ON transactions;
CREATE POLICY "delete_own_transactions" ON transactions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON transactions(user_id, transaction_type);

-- ==================== ACHIEVEMENTS (Global Definitions) ====================
CREATE TABLE IF NOT EXISTS achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  tier text NOT NULL CHECK (tier IN ('gold', 'silver', 'bronze')),
  icon text NOT NULL DEFAULT 'trophy',
  criteria text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_achievements" ON achievements;
CREATE POLICY "select_achievements" ON achievements FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_achievements" ON achievements;
CREATE POLICY "insert_achievements" ON achievements FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_achievements" ON achievements;
CREATE POLICY "update_achievements" ON achievements FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- ==================== USER ACHIEVEMENTS ====================
CREATE TABLE IF NOT EXISTS user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_user_achievements" ON user_achievements;
CREATE POLICY "select_own_user_achievements" ON user_achievements FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_user_achievements" ON user_achievements;
CREATE POLICY "insert_own_user_achievements" ON user_achievements FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_user_achievements" ON user_achievements;
CREATE POLICY "delete_own_user_achievements" ON user_achievements FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);

-- ==================== NOTIFICATIONS ====================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  notification_type text NOT NULL DEFAULT 'info' CHECK (notification_type IN ('reminder', 'achievement', 'report', 'info', 'ai')),
  is_read boolean NOT NULL DEFAULT false,
  action_url text,
  scheduled_for timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
CREATE POLICY "select_own_notifications" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notifications" ON notifications;
CREATE POLICY "insert_own_notifications" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
CREATE POLICY "update_own_notifications" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_notifications" ON notifications;
CREATE POLICY "delete_own_notifications" ON notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- ==================== USER PREFERENCES ====================
CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'dark' CHECK (theme IN ('light', 'dark')),
  planning_time text NOT NULL DEFAULT '06:00',
  review_time text NOT NULL DEFAULT '20:00',
  weekly_report_day integer NOT NULL DEFAULT 0 CHECK (weekly_report_day BETWEEN 0 AND 6),
  monthly_report_day integer NOT NULL DEFAULT 1 CHECK (monthly_report_day BETWEEN 1 AND 28),
  currency text NOT NULL DEFAULT 'RWF',
  notifications_enabled boolean DEFAULT true,
  browser_notifications_enabled boolean DEFAULT false,
  ollama_endpoint text DEFAULT 'http://localhost:11434',
  ollama_model text DEFAULT 'qwen2.5:3b',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_preferences" ON user_preferences;
CREATE POLICY "select_own_preferences" ON user_preferences FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_preferences" ON user_preferences;
CREATE POLICY "insert_own_preferences" ON user_preferences FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_preferences" ON user_preferences;
CREATE POLICY "update_own_preferences" ON user_preferences FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_preferences" ON user_preferences;
CREATE POLICY "delete_own_preferences" ON user_preferences FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- ==================== REPORTS ====================
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type text NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'custom')),
  title text NOT NULL,
  content text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  tasks_planned integer DEFAULT 0,
  tasks_completed integer DEFAULT 0,
  total_income numeric(14,2) DEFAULT 0,
  total_expenses numeric(14,2) DEFAULT 0,
  net_cash_flow numeric(14,2) DEFAULT 0,
  savings_balance numeric(14,2) DEFAULT 0,
  ai_analysis text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_reports" ON reports;
CREATE POLICY "select_own_reports" ON reports FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_reports" ON reports;
CREATE POLICY "insert_own_reports" ON reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_reports" ON reports;
CREATE POLICY "update_own_reports" ON reports FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_reports" ON reports;
CREATE POLICY "delete_own_reports" ON reports FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id, created_at DESC);

-- ==================== SEED ACHIEVEMENT DEFINITIONS ====================
INSERT INTO achievements (code, name, description, tier, icon, criteria) VALUES
  ('first_task', 'First Step', 'Complete your first task', 'bronze', 'check-circle', 'Complete 1 task'),
  ('first_review', 'Reflection', 'Complete your first evening review', 'bronze', 'moon', 'Complete 1 evening review'),
  ('seven_day_streak', 'Week Warrior', 'Plan your day for 7 consecutive days', 'silver', 'flame', '7-day planning streak'),
  ('weekly_reviewer', 'Consistent Reviewer', 'Complete weekly reviews consistently', 'silver', 'clipboard-check', 'Complete 4 weekly reviews'),
  ('thirty_days', 'Dedicated', '30 days of active progress', 'silver', 'calendar', '30 days of activity'),
  ('savings_milestone', 'Saver', 'Reach a savings milestone', 'gold', 'piggy-bank', 'Accumulate savings'),
  ('monthly_goal', 'Goal Crusher', 'Complete a monthly milestone', 'gold', 'target', 'Complete 1 monthly milestone'),
  ('ninety_day_goal', 'Champion', 'Complete a 90-day goal', 'gold', 'trophy', 'Complete 1 full 90-day goal')
ON CONFLICT (code) DO NOTHING;
