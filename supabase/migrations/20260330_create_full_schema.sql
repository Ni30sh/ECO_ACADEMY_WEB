-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. SCHOOLS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  city VARCHAR(255),
  country VARCHAR(255),
  logo_url VARCHAR(500),
  total_eco_points BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 2. PROFILES TABLE (Users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR(255),
  avatar_emoji VARCHAR(10) DEFAULT '🌱',
  school_id UUID REFERENCES schools(id),
  role VARCHAR(50) DEFAULT 'student', -- 'student', 'teacher', 'admin'
  eco_points BIGINT DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  last_active_date TIMESTAMP WITH TIME ZONE,
  interests TEXT[] DEFAULT '{}',
  daily_goal INTEGER DEFAULT 2,
  city VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 3. MISSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS missions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50), -- 'planting', 'waste', 'energy', 'water', 'transport', 'biodiversity', 'campus'
  difficulty VARCHAR(20), -- 'easy', 'medium', 'hard'
  eco_points_reward INTEGER DEFAULT 0,
  xp_reward INTEGER DEFAULT 0,
  requires_photo BOOLEAN DEFAULT FALSE,
  requires_location BOOLEAN DEFAULT FALSE,
  requires_teacher_approval BOOLEAN DEFAULT FALSE,
  icon_url VARCHAR(255),
  steps TEXT[], -- JSON array of steps
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 4. MISSION STEPS TABLE (New - for step-based system)
-- ============================================================================
CREATE TABLE IF NOT EXISTS mission_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  instructions TEXT,
  has_checkpoint BOOLEAN DEFAULT FALSE, -- Whether step requires verification
  checkpoint_type VARCHAR(50), -- 'photo', 'location', 'text', 'checkbox'
  checkpoint_requirement TEXT, -- Special requirements for this step
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(mission_id, step_number)
);

CREATE INDEX idx_mission_steps_mission ON mission_steps(mission_id);

-- ============================================================================
-- 5. MISSION SUBMISSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS mission_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'in_progress', -- 'in_progress', 'pending', 'approved', 'rejected', 'ai_verified'
  current_step INTEGER DEFAULT 0,
  completed_steps INTEGER[] DEFAULT '{}',
  photo_url VARCHAR(500),
  notes TEXT,
  location_lat FLOAT,
  location_lng FLOAT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_mission_submissions_user ON mission_submissions(user_id);
CREATE INDEX idx_mission_submissions_mission ON mission_submissions(mission_id);
CREATE INDEX idx_mission_submissions_status ON mission_submissions(status);

-- ============================================================================
-- 6. MISSION STEP SUBMISSIONS TABLE (New - track individual step completions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS mission_step_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_submission_id UUID NOT NULL REFERENCES mission_submissions(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES mission_steps(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'verified', 'rejected'
  checkpoint_data JSONB, -- Stores photo URL, location, text input, etc.
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  verification_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(mission_submission_id, step_id)
);

CREATE INDEX idx_mission_step_submissions_submission ON mission_step_submissions(mission_submission_id);
CREATE INDEX idx_mission_step_submissions_step ON mission_step_submissions(step_id);

-- ============================================================================
-- 7. LESSONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  topic VARCHAR(100), -- 'climate_change', 'pollution', 'waste', 'energy', 'water', 'biodiversity'
  content_type VARCHAR(50), -- 'article', 'quiz', 'mini_game', 'video'
  content_json JSONB, -- Stores article body/summary or quiz questions
  eco_points_reward INTEGER DEFAULT 0,
  estimated_minutes INTEGER,
  order_index INTEGER,
  media_url VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_lessons_topic ON lessons(topic);

-- ============================================================================
-- 8. LESSON COMPLETIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS lesson_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

CREATE INDEX idx_lesson_completions_user ON lesson_completions(user_id);
CREATE INDEX idx_lesson_completions_lesson ON lesson_completions(lesson_id);

-- ============================================================================
-- 9. QUIZ ATTEMPTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  score INTEGER,
  total_questions INTEGER,
  answers_json JSONB, -- Array of {question_index, selected_answer}
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_quiz_attempts_user ON quiz_attempts(user_id);
CREATE INDEX idx_quiz_attempts_lesson ON quiz_attempts(lesson_id);

-- ============================================================================
-- 10. BADGES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(100),
  trigger_type VARCHAR(100), -- 'missions_completed', 'streak', 'category_missions', etc.
  trigger_count INTEGER,
  trigger_category VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 11. USER BADGES TABLE (Many-to-Many)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

CREATE INDEX idx_user_badges_user ON user_badges(user_id);

-- ============================================================================
-- 12. NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title VARCHAR(255),
  body TEXT,
  type VARCHAR(50), -- 'mission', 'badge', 'streak', 'reward', 'challenge'
  is_read BOOLEAN DEFAULT FALSE,
  related_mission_id UUID REFERENCES missions(id) ON DELETE SET NULL,
  related_badge_id UUID REFERENCES badges(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, is_read);

-- ============================================================================
-- 13. DAILY POINTS TABLE (For weekly/daily tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS daily_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_daily_points_user ON daily_points(user_id);
CREATE INDEX idx_daily_points_date ON daily_points(date);

-- ============================================================================
-- 14. LEADERBOARD VIEW (for performance)
-- ============================================================================
CREATE OR REPLACE VIEW leaderboard_view AS
SELECT 
  p.id as user_id,
  p.full_name,
  p.avatar_emoji,
  p.eco_points,
  p.school_id,
  s.name as school_name,
  ROW_NUMBER() OVER (ORDER BY p.eco_points DESC) as rank
FROM profiles p
LEFT JOIN schools s ON p.school_id = s.id
WHERE p.role = 'student'
ORDER BY p.eco_points DESC;

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_step_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_points ENABLE ROW LEVEL SECURITY;

-- PROFILES: Users can view all profiles, but only edit their own
CREATE POLICY "profiles_select_public" ON profiles FOR SELECT USING (TRUE);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- MISSIONS: All authenticated users can view missions
CREATE POLICY "missions_select_public" ON missions FOR SELECT USING (TRUE);
CREATE POLICY "missions_insert_admin" ON missions FOR INSERT WITH CHECK (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);

-- MISSION SUBMISSIONS: Users can view and modify their own
CREATE POLICY "mission_submissions_select_own" ON mission_submissions 
  FOR SELECT USING (auth.uid() = user_id OR
    auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'teacher'))
  );
CREATE POLICY "mission_submissions_insert_own" ON mission_submissions 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mission_submissions_update_own" ON mission_submissions 
  FOR UPDATE USING (auth.uid() = user_id);

-- MISSION STEPS: Public read access
CREATE POLICY "mission_steps_select_public" ON mission_steps FOR SELECT USING (TRUE);

-- MISSION STEP SUBMISSIONS: Users can view their own, teachers can view all
CREATE POLICY "mission_step_submissions_select" ON mission_step_submissions
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM mission_submissions 
      WHERE id = mission_submission_id
    ) OR
    auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'teacher'))
  );

-- LESSONS: All authenticated users can view
CREATE POLICY "lessons_select_public" ON lessons FOR SELECT USING (TRUE);

-- LESSON COMPLETIONS: Users can view and modify their own
CREATE POLICY "lesson_completions_select_own" ON lesson_completions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "lesson_completions_insert_own" ON lesson_completions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- QUIZ ATTEMPTS: Users can view and insert their own
CREATE POLICY "quiz_attempts_select_own" ON quiz_attempts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "quiz_attempts_insert_own" ON quiz_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- BADGES: All can view
CREATE POLICY "badges_select_public" ON badges FOR SELECT USING (TRUE);

-- USER BADGES: Users can view all, insert badge assignments through triggers
CREATE POLICY "user_badges_select_public" ON user_badges FOR SELECT USING (TRUE);

-- NOTIFICATIONS: Users can view their own
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- DAILY POINTS: Users can view their own
CREATE POLICY "daily_points_select_own" ON daily_points
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "daily_points_insert_own" ON daily_points
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- INDEXES for performance
-- ============================================================================
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_school ON profiles(school_id);
CREATE INDEX idx_missions_category ON missions(category);
CREATE INDEX idx_missions_difficulty ON missions(difficulty);
