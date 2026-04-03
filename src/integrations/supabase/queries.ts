import { supabase } from './client';
import { TablesInsert, TablesUpdate } from './types.ts';

type ProfileWithSchoolName = {
  school_name: string | null;
} & Record<string, any>;

function normalizeProfileSchool(row: any): ProfileWithSchoolName {
  const schoolFromJoin = Array.isArray(row?.schools) ? row.schools[0]?.name : row?.schools?.name;
  return {
    ...row,
    school_name: row?.school_name ?? schoolFromJoin ?? null,
  };
}

function normalizeMissionPayload<T extends Record<string, any>>(payload: T): T {
  const nextPayload: Record<string, any> = { ...payload };

  delete nextPayload.icon;
  delete nextPayload.school_only;
  delete nextPayload.expires_at;

  return nextPayload as T;
}

async function resolveSchoolIdByName(schoolName?: string | null): Promise<string | null> {
  const normalizedName = (schoolName || '').trim();
  if (!normalizedName) return null;

  const { data: existing, error: existingError } = await supabase
    .from('schools')
    .select('id')
    .eq('name', normalizedName)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.id) return existing.id;

  const { data: created, error: createError } = await supabase
    .from('schools')
    .insert({ name: normalizedName })
    .select('id')
    .single();

  if (createError) throw createError;
  return created.id;
}

/**
 * Supabase Database Query Utilities
 * Replaces localStore with proper Supabase queries
 */

export const supabaseQueries = {
  // ============================================================================
  // PROFILES (Users)
  // ============================================================================
  
  profiles: {
    async getById(userId: string) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, schools(name)')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) throw error;
      return data ? normalizeProfileSchool(data) : data;
    },

    async getAll() {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, schools(name)');
      
      if (error) throw error;
      return (data || []).map(normalizeProfileSchool);
    },

    async getByRole(role: 'student' | 'teacher' | 'admin') {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, schools(name)')
        .eq('role', role);
      
      if (error) throw error;
      return (data || []).map(normalizeProfileSchool);
    },

    async update(userId: string, updates: TablesUpdate<'profiles'> & { school_name?: string | null }) {
      const nextUpdates: Record<string, any> = { ...updates };
      if ('school_name' in nextUpdates) {
        nextUpdates.school_id = await resolveSchoolIdByName(nextUpdates.school_name);
        delete nextUpdates.school_name;
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(nextUpdates)
        .eq('id', userId)
        .select('*, schools(name)')
        .maybeSingle();
      
      if (error) throw error;
      if (!data) {
        throw new Error(`Profile update blocked or not found for user ${userId}.`);
      }
      return data ? normalizeProfileSchool(data) : data;
    },

    async create(profile: TablesInsert<'profiles'> & { school_name?: string | null }) {
      const { school_name, ...baseProfile } = profile as TablesInsert<'profiles'> & { school_name?: string | null };
      const payload: TablesInsert<'profiles'> = {
        ...baseProfile,
        school_id: await resolveSchoolIdByName(school_name),
      };

      const { data, error } = await supabase
        .from('profiles')
        .insert(payload)
        .select('*, schools(name)')
        .maybeSingle();
      
      if (error) throw error;
      if (!data) {
        throw new Error('Profile could not be created.');
      }
      return data ? normalizeProfileSchool(data) : data;
    },

    async addEcoPoints(userId: string, points: number) {
      const profile = await this.getById(userId);
      const newPoints = (profile.eco_points || 0) + points;
      
      return this.update(userId, { 
        eco_points: newPoints,
        updated_at: new Date().toISOString()
      });
    },

    async updateStreak(userId: string, days: number) {
      return this.update(userId, { 
        streak_days: days,
        last_active_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
  },

  // ============================================================================
  // LEARNING TOPICS
  // ============================================================================

  learningTopics: {
    async getAll() {
      const { data, error } = await supabase
        .from('learning_topics')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },

    async getById(topicId: string) {
      const { data, error } = await supabase
        .from('learning_topics')
        .select('*')
        .eq('id', topicId)
        .single();

      if (error) throw error;
      return data;
    },

    async create(topic: TablesInsert<'learning_topics'>) {
      const payload = topic as TablesInsert<'learning_topics'>;
      const { data, error } = await supabase
        .from('learning_topics')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async update(topicId: string, updates: TablesUpdate<'learning_topics'>) {
      const payload = updates as TablesUpdate<'learning_topics'>;
      const { data, error } = await supabase
        .from('learning_topics')
        .update(payload)
        .eq('id', topicId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async delete(topicId: string) {
      const { error } = await supabase
        .from('learning_topics')
        .delete()
        .eq('id', topicId);

      if (error) throw error;
      return true;
    }
  },

  // ============================================================================
  // MISSIONS
  // ============================================================================
  
  missions: {
    async getAll() {
      const { data, error } = await supabase
        .from('missions')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },

    async getById(missionId: string) {
      const { data, error } = await supabase
        .from('missions')
        .select('*')
        .eq('id', missionId)
        .single();
      
      if (error) throw error;
      return data;
    },

    async getByCategory(category: string) {
      const { data, error } = await supabase
        .from('missions')
        .select('*')
        .eq('category', category)
        .eq('is_active', true);
      
      if (error) throw error;
      return data || [];
    },

    async create(mission: TablesInsert<'missions'>) {
      const { data, error } = await supabase
        .from('missions')
        .insert(normalizeMissionPayload(mission))
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },

    async update(missionId: string, updates: TablesUpdate<'missions'>) {
      const { data, error } = await supabase
        .from('missions')
        .update(normalizeMissionPayload(updates))
        .eq('id', missionId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
  },

  // ============================================================================
  // MISSION STEPS (New Step System)
  // ============================================================================
  
  missionSteps: {
    async getByMissionId(missionId: string) {
      const { data, error } = await supabase
        .from('mission_steps')
        .select('*')
        .eq('mission_id', missionId)
        .order('step_number', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },

    async getById(stepId: string) {
      const { data, error } = await supabase
        .from('mission_steps')
        .select('*')
        .eq('id', stepId)
        .single();
      
      if (error) throw error;
      return data;
    },

    async create(step: any) {
      const { data, error } = await supabase
        .from('mission_steps')
        .insert(step)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },

    async update(stepId: string, updates: any) {
      const { data, error } = await supabase
        .from('mission_steps')
        .update(updates)
        .eq('id', stepId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
  },

  // ============================================================================
  // MISSION SUBMISSIONS
  // ============================================================================
  
  missionSubmissions: {
    async getUserSubmissions(userId: string) {
      const { data, error } = await supabase
        .from('mission_submissions')
        .select(`
          *,
          missions(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },

    async getById(submissionId: string) {
      const { data, error } = await supabase
        .from('mission_submissions')
        .select(`
          *,
          missions(*)
        `)
        .eq('id', submissionId)
        .single();
      
      if (error) throw error;
      return data;
    },

    async getByStatus(status: string) {
      const { data, error } = await supabase
        .from('mission_submissions')
        .select(`
          *,
          missions(*)
        `)
        .eq('status', status)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },

    async create(submission: TablesInsert<'mission_submissions'>) {
      const { data, error } = await supabase
        .from('mission_submissions')
        .insert(submission)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },

    async update(submissionId: string, updates: TablesUpdate<'mission_submissions'>) {
      const { data, error } = await supabase
        .from('mission_submissions')
        .update(updates)
        .eq('id', submissionId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },

    async submitProof(submissionId: string, photoUrl: string, notes?: string, coords?: { lat: number; lng: number }) {
      return this.update(submissionId, {
        status: 'pending',
        photo_url: photoUrl,
        notes: notes,
        location_lat: coords?.lat,
        location_lng: coords?.lng,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    },

    async approveSubmission(submissionId: string, reviewedById: string, feedback?: string) {
      return this.update(submissionId, {
        status: 'approved',
        reviewed_by: reviewedById,
        reviewed_at: new Date().toISOString(),
        teacher_feedback: feedback || null,
        rejection_reason: null,
        updated_at: new Date().toISOString()
      });
    },

    async rejectSubmission(submissionId: string, reviewedById: string, reason: string) {
      return this.update(submissionId, {
        status: 'rejected',
        reviewed_by: reviewedById,
        reviewed_at: new Date().toISOString(),
        teacher_feedback: reason,
        rejection_reason: reason,
        updated_at: new Date().toISOString()
      });
    }
  },

  // ============================================================================
  // MISSION STEP SUBMISSIONS (Track individual step completions)
  // ============================================================================
  
  missionStepSubmissions: {
    async getByMissionSubmission(missionSubmissionId: string) {
      const { data, error } = await supabase
        .from('mission_step_submissions')
        .select(`
          *,
          mission_steps(*)
        `)
        .eq('mission_submission_id', missionSubmissionId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },

    async getById(stepSubmissionId: string) {
      const { data, error } = await supabase
        .from('mission_step_submissions')
        .select(`
          *,
          mission_steps(*)
        `)
        .eq('id', stepSubmissionId)
        .single();
      
      if (error) throw error;
      return data;
    },

    async submitStep(
      missionSubmissionId: string, 
      stepId: string, 
      checkpointData?: any
    ) {
      const { data, error } = await supabase
        .from('mission_step_submissions')
        .upsert(
          {
            mission_submission_id: missionSubmissionId,
            step_id: stepId,
            checkpoint_data: checkpointData,
            submitted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          { onConflict: 'mission_submission_id,step_id' }
        )
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },

    async verifyStep(
      stepSubmissionId: string,
      verifiedById: string,
      notes?: string
    ) {
      const { data, error } = await supabase
        .from('mission_step_submissions')
        .update({
          status: 'verified',
          verified_by: verifiedById,
          verified_at: new Date().toISOString(),
          verification_notes: notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', stepSubmissionId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },

    async rejectStep(
      stepSubmissionId: string,
      verifiedById: string,
      reason: string
    ) {
      const { data, error } = await supabase
        .from('mission_step_submissions')
        .update({
          status: 'rejected',
          verified_by: verifiedById,
          verified_at: new Date().toISOString(),
          verification_notes: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', stepSubmissionId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
  },

  // ============================================================================
  // LESSONS
  // ============================================================================
  
  lessons: {
    async getAll() {
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .order('topic', { ascending: true })
        .order('order_index', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },

    async getByTopic(topic: string) {
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('topic_id', topic)
        .order('order_index', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },

    async getById(lessonId: string) {
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', lessonId)
        .single();
      
      if (error) throw error;
      return data;
    },

    async create(lesson: TablesInsert<'lessons'>) {
      const { data, error } = await supabase
        .from('lessons')
        .insert(lesson)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async update(lessonId: string, updates: TablesUpdate<'lessons'>) {
      const { data, error } = await supabase
        .from('lessons')
        .update(updates)
        .eq('id', lessonId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async delete(lessonId: string) {
      const { error } = await supabase
        .from('lessons')
        .delete()
        .eq('id', lessonId);

      if (error) throw error;
      return true;
    }
  },

  // ============================================================================
  // LESSON COMPLETIONS
  // ============================================================================
  
  lessonCompletions: {
    async getUserCompletions(userId: string) {
      const { data, error } = await supabase
        .from('lesson_completions')
        .select('lesson_id')
        .eq('user_id', userId);
      
      if (error) throw error;
      return data?.map(c => c.lesson_id) || [];
    },

    async markComplete(userId: string, lessonId: string) {
      const { data, error } = await supabase
        .from('lesson_completions')
        .upsert(
          {
            user_id: userId,
            lesson_id: lessonId,
            completed_at: new Date().toISOString()
          },
          { onConflict: 'user_id,lesson_id' }
        )
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
  },

  // ============================================================================
  // QUIZ ATTEMPTS
  // ============================================================================
  
  quizAttempts: {
    async getUserAttempts(userId: string, lessonId?: string) {
      const query = supabase
        .from('quiz_attempts')
        .select('*')
        .eq('user_id', userId);
      
      if (lessonId) {
        query.eq('lesson_id', lessonId);
      }
      
      const { data, error } = await query.order('attempted_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },

    async create(attempt: TablesInsert<'quiz_attempts'>) {
      const { data, error } = await supabase
        .from('quiz_attempts')
        .insert(attempt)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
  },

  // ============================================================================
  // BADGES
  // ============================================================================
  
  badges: {
    async getAll() {
      const { data, error } = await supabase
        .from('badges')
        .select('*');
      
      if (error) throw error;
      return data || [];
    },

    async getUserBadges(userId: string) {
      const { data, error } = await supabase
        .from('user_badges')
        .select('badges(*)')
        .eq('user_id', userId);
      
      if (error) throw error;
      return data?.map(ub => ub.badges).filter(Boolean) || [];
    },

    async awardBadge(userId: string, badgeId: string) {
      const { data, error } = await supabase
        .from('user_badges')
        .upsert(
          {
            user_id: userId,
            badge_id: badgeId,
            earned_at: new Date().toISOString()
          },
          { onConflict: 'user_id,badge_id' }
        )
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
  },

  // ============================================================================
  // NOTIFICATIONS
  // ============================================================================
  
  notifications: {
    async getUserNotifications(userId: string) {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },

    async create(notification: TablesInsert<'notifications'>) {
      const { error } = await supabase
        .from('notifications')
        .insert(notification);

      if (error) throw error;
      return notification;
    },

    async markAsRead(notificationId: string) {
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq('id', notificationId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },

    async markAllAsRead(userId: string) {
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('is_read', false)
        .select();
      
      if (error) throw error;
      return data || [];
    }
  },

  // ============================================================================
  // DAILY POINTS
  // ============================================================================
  
  dailyPoints: {
    async getByUserAndDate(userId: string, date: string) {
      const { data, error } = await supabase
        .from('daily_points')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },

    async recordPoints(userId: string, points: number, date: string) {
      const { data, error } = await supabase
        .from('daily_points')
        .upsert(
          {
            user_id: userId,
            date: date,
            points_earned: points
          },
          { onConflict: 'user_id,date' }
        )
        .select()
        .maybeSingle();
      
      if (error) throw error;
      if (!data) {
        throw new Error(`Daily points upsert blocked for user ${userId} on ${date}.`);
      }
      return data;
    },

    async getWeeklyPoints(userId: string) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      const startDate = sevenDaysAgo.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('daily_points')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate)
        .order('date', { ascending: true });
      
      if (error) throw error;
      return data || [];
    }
  },

  // ============================================================================
  // LEADERBOARD
  // ============================================================================
  
  leaderboard: {
    async getTopUsers(limit: number = 10) {
      const students = await supabaseQueries.profiles.getByRole('student');
      return students
        .sort((a, b) => (b.eco_points || 0) - (a.eco_points || 0))
        .slice(0, limit);
    },

    async getRank(userId: string) {
      const user = await supabaseQueries.profiles.getById(userId);
      const { data, error } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: false })
        .eq('role', 'student')
        .gt('eco_points', user.eco_points);
      
      if (error) throw error;
      return (data?.length || 0) + 1;
    }
  }
};
