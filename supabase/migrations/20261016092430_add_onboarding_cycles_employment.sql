/*
# Onboarding, Goal Cycles, Employment/Social Profiles

## Changes
1. ALTER profiles — add onboarding_completed, onboarding_step, date_of_birth, country, district, education_level, skills_talents, languages_spoken, personal_responsibilities, areas_to_improve
2. CREATE user_employment — employment situation, income type, work challenges
3. CREATE user_social — social environment, living situation, community access, daily available time
4. CREATE onboarding_progress — save partial onboarding answers per step
5. CREATE goal_cycles — 90-day cycle tracking with status, review fields
6. ALTER goals — add cycle_id FK, is_primary, desired_outcome fields
7. CREATE cycle_reviews — end-of-cycle review answers

## Security
- RLS enabled on all new tables with owner-scoped policies (TO authenticated)
- All user-scoped tables have user_id DEFAULT auth.uid()
*/

-- ==================== ALTER PROFILES ====================
DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_step integer NOT NULL DEFAULT 0;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_birth date;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country text DEFAULT '';
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS district text DEFAULT '';
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS education_level text DEFAULT '';
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS skills_talents text DEFAULT '';
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS languages_spoken text DEFAULT '';
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS personal_responsibilities text DEFAULT '';
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS areas_to_improve text DEFAULT '';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ==================== USER EMPLOYMENT ====================
CREATE TABLE IF NOT EXISTS user_employment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  employment_status text[] DEFAULT '{}',
  work_description text DEFAULT '',
  skills_used text DEFAULT '',
  income_sources text DEFAULT '',
  income_type text DEFAULT '' CHECK (income_type IN ('', 'regular', 'irregular', 'zero')),
  looking_for_work boolean DEFAULT false,
  work_challenges text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_employment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_employment" ON user_employment;
CREATE POLICY "select_own_employment" ON user_employment FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_employment" ON user_employment;
CREATE POLICY "insert_own_employment" ON user_employment FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_employment" ON user_employment;
CREATE POLICY "update_own_employment" ON user_employment FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_employment" ON user_employment;
CREATE POLICY "delete_own_employment" ON user_employment FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ==================== USER SOCIAL ====================
CREATE TABLE IF NOT EXISTS user_social (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  living_situation text DEFAULT '',
  family_responsibilities text DEFAULT '',
  community_opportunities text DEFAULT '',
  community_challenges text DEFAULT '',
  has_internet boolean DEFAULT true,
  has_computer boolean DEFAULT false,
  has_smartphone boolean DEFAULT true,
  daily_available_hours integer DEFAULT 2,
  support_network text DEFAULT '',
  external_challenges text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_social ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_social" ON user_social;
CREATE POLICY "select_own_social" ON user_social FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_social" ON user_social;
CREATE POLICY "insert_own_social" ON user_social FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_social" ON user_social;
CREATE POLICY "update_own_social" ON user_social FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_social" ON user_social;
CREATE POLICY "delete_own_social" ON user_social FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ==================== ONBOARDING PROGRESS ====================
CREATE TABLE IF NOT EXISTS onboarding_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  step integer NOT NULL DEFAULT 0,
  step_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_onboarding" ON onboarding_progress;
CREATE POLICY "select_own_onboarding" ON onboarding_progress FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_onboarding" ON onboarding_progress;
CREATE POLICY "insert_own_onboarding" ON onboarding_progress FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_onboarding" ON onboarding_progress;
CREATE POLICY "update_own_onboarding" ON onboarding_progress FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_onboarding" ON onboarding_progress;
CREATE POLICY "delete_own_onboarding" ON onboarding_progress FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ==================== GOAL CYCLES ====================
CREATE TABLE IF NOT EXISTS goal_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  cycle_number integer NOT NULL DEFAULT 1,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date NOT NULL DEFAULT (CURRENT_DATE + 90),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'partially_completed', 'not_completed', 'reviewing')),
  review_completed boolean DEFAULT false,
  carried_forward_goals text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, cycle_number)
);

ALTER TABLE goal_cycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_cycles" ON goal_cycles;
CREATE POLICY "select_own_cycles" ON goal_cycles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_cycles" ON goal_cycles;
CREATE POLICY "insert_own_cycles" ON goal_cycles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_cycles" ON goal_cycles;
CREATE POLICY "update_own_cycles" ON goal_cycles FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_cycles" ON goal_cycles;
CREATE POLICY "delete_own_cycles" ON goal_cycles FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_cycles_user ON goal_cycles(user_id, status);

-- ==================== ALTER GOALS — add cycle + primary + outcome ====================
DO $$ BEGIN
  ALTER TABLE goals ADD COLUMN IF NOT EXISTS cycle_id uuid REFERENCES goal_cycles(id) ON DELETE SET NULL;
  ALTER TABLE goals ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT false;
  ALTER TABLE goals ADD COLUMN IF NOT EXISTS desired_outcome text DEFAULT '';
  ALTER TABLE goals ADD COLUMN IF NOT EXISTS goal_area text DEFAULT '';
  ALTER TABLE goals ADD COLUMN IF NOT EXISTS target_completion_date date;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ==================== CYCLE REVIEWS ====================
CREATE TABLE IF NOT EXISTS cycle_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  cycle_id uuid NOT NULL REFERENCES goal_cycles(id) ON DELETE CASCADE,
  goals_achieved text DEFAULT '',
  goals_partial text DEFAULT '',
  goals_not_achieved text DEFAULT '',
  success_factors text DEFAULT '',
  obstacles text DEFAULT '',
  lessons text DEFAULT '',
  next_cycle_changes text DEFAULT '',
  next_cycle_goals text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, cycle_id)
);

ALTER TABLE cycle_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_cycle_reviews" ON cycle_reviews;
CREATE POLICY "select_own_cycle_reviews" ON cycle_reviews FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_cycle_reviews" ON cycle_reviews;
CREATE POLICY "insert_own_cycle_reviews" ON cycle_reviews FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_cycle_reviews" ON cycle_reviews;
CREATE POLICY "update_own_cycle_reviews" ON cycle_reviews FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_cycle_reviews" ON cycle_reviews;
CREATE POLICY "delete_own_cycle_reviews" ON cycle_reviews FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
