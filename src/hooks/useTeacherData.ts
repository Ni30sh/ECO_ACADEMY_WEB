import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { supabaseQueries } from '@/integrations/supabase/queries';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

const ts = () => new Date().toISOString();

const isPendingReviewStatus = (row: { status?: string | null; submitted_at?: string | null; reviewed_at?: string | null }) => {
  return row.status === 'pending' || row.status === 'submitted';
};

const getSubmissionOrderTs = (row: { submitted_at?: string | null; updated_at?: string | null; created_at?: string | null }) => {
  const candidate = row.submitted_at || row.updated_at || row.created_at;
  return candidate ? new Date(candidate).getTime() : 0;
};

export function useTeacherData() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const schoolName = (profile?.school_name || '').trim();
  const bonusAwardLocksRef = useRef<Set<string>>(new Set());
  const reviewerProfileIdRef = useRef<string | null>(null);

  const ensureReviewerProfileId = async (): Promise<string | null> => {
    if (!userId) return null;
    if (reviewerProfileIdRef.current) return reviewerProfileIdRef.current;

    try {
      const existing = await supabaseQueries.profiles.getById(userId);
      if (existing?.id) {
        reviewerProfileIdRef.current = existing.id;
        return existing.id;
      }
    } catch {
      // Continue to create path.
    }

    try {
      const created = await supabaseQueries.profiles.create({
        id: userId,
        full_name: profile?.full_name || user?.email?.split('@')[0] || 'Teacher',
        role: profile?.role === 'admin' ? 'admin' : 'teacher',
        avatar_emoji: profile?.avatar_emoji || (profile?.role === 'admin' ? '⚙️' : '📚'),
        school_name: schoolName || null,
      } as any);

      if (created?.id) {
        reviewerProfileIdRef.current = created.id;
        return created.id;
      }
    } catch (createError) {
      console.warn(`[teacher-sync ${ts()}] could not ensure reviewer profile`, createError);
    }

    return null;
  };

  const resolveProfileSchoolName = (row: any): string => {
    const direct = typeof row?.school_name === 'string' ? row.school_name : '';
    if (direct.trim()) return direct.trim();
    const joined = Array.isArray(row?.schools) ? row?.schools?.[0]?.name : row?.schools?.name;
    return typeof joined === 'string' ? joined.trim() : '';
  };

  const isSameSchool = (row: any): boolean => {
    if (!schoolName) return false;
    return resolveProfileSchoolName(row).toLowerCase() === schoolName.toLowerCase();
  };

  const toErrorMessage = (error: unknown) => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object') {
      const candidate = error as Record<string, unknown>;
      const message = candidate.message;
      if (typeof message === 'string' && message.trim()) return message;

      const details = candidate.details;
      if (typeof details === 'string' && details.trim()) return details;

      const hint = candidate.hint;
      if (typeof hint === 'string' && hint.trim()) return hint;

      const code = candidate.code;
      if (typeof code === 'string' && code.trim()) return `Error code ${code}`;
    }
    return 'Unknown error';
  };

  const invalidateTeacherViews = () => {
    queryClient.invalidateQueries({ queryKey: ['teacher-submissions'] });
    queryClient.invalidateQueries({ queryKey: ['teacher-pending-submissions'] });
    queryClient.invalidateQueries({ queryKey: ['teacher-students'] });
    queryClient.invalidateQueries({ queryKey: ['teacher-weekly-approved'] });
    queryClient.invalidateQueries({ queryKey: ['teacher-class-weekly'] });
    queryClient.invalidateQueries({ queryKey: ['teacher-top-students-week'] });
    queryClient.invalidateQueries({ queryKey: ['teacher-active-week'] });
  };

  const studentsQuery = useQuery({
    queryKey: ['teacher-students', schoolName],
    queryFn: async () => {
      if (!schoolName) return [];
      const rows = await supabaseQueries.profiles.getByRole('student');
      return rows
        .filter((p) => (p.school_name || '').trim().toLowerCase() === schoolName.toLowerCase())
        .sort((a, b) => (b.eco_points || 0) - (a.eco_points || 0));
    },
    enabled: !!userId && !!schoolName,
    staleTime: 5000,
    refetchInterval: 10000,
  });

  const studentIds = useMemo(() => (studentsQuery.data ?? []).map((s) => s.id), [studentsQuery.data]);
  const studentIdsKey = useMemo(() => studentIds.join(','), [studentIds]);

  const submissionsQuery = useQuery({
    queryKey: ['teacher-submissions', schoolName, studentIdsKey],
    queryFn: async () => {
      if (!schoolName) return [];

      console.log(`[teacher-sync ${ts()}] polling submissions start`, {
        userId,
        schoolName,
      });

      // Only fetch submissions with status 'submitted' or 'for_review'
      const { data, error } = await supabase
        .from('mission_submissions')
        .select('*, missions(*)')
        .in('status', ['submitted', 'for_review'])
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      const allowedStudentIds = new Set(studentIds);
      const scoped = (data || []).filter((row: any) => allowedStudentIds.has(row.user_id));
      const sorted = [...scoped].sort((a: any, b: any) => getSubmissionOrderTs(b) - getSubmissionOrderTs(a));
      console.log(`[teacher-sync ${ts()}] polling submissions done`, {
        count: sorted.length,
        statusCounts: sorted.reduce((acc: Record<string, number>, row: any) => {
          const key = String(row?.status || 'unknown');
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {}),
      });
      return sorted;
    },
    enabled: !!userId && !!schoolName,
    staleTime: 5000,
    refetchInterval: 8000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: 'always',
  });

  const pendingSubmissions = useMemo(
    () => (submissionsQuery.data ?? []).filter((s: any) => isPendingReviewStatus(s)),
    [submissionsQuery.data]
  );

  const pendingCount = pendingSubmissions.length;

  useEffect(() => {
    if (!userId) return;
    void refreshProfile();
  }, [userId, refreshProfile]);

  useEffect(() => {
    if (!userId || !schoolName) return;

    const channel = supabase
      .channel(`teacher-live-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mission_submissions' }, () => {
        console.log(`[teacher-sync ${ts()}] realtime mission_submissions event received`);
        queryClient.invalidateQueries({ queryKey: ['teacher-submissions'] });
        queryClient.refetchQueries({ queryKey: ['teacher-submissions'], type: 'active' });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_points' }, () => {
        console.log(`[teacher-sync ${ts()}] realtime daily_points event received`);
        queryClient.invalidateQueries({ queryKey: ['teacher-class-weekly'] });
        queryClient.invalidateQueries({ queryKey: ['teacher-top-students-week'] });
        queryClient.invalidateQueries({ queryKey: ['teacher-active-week'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        console.log(`[teacher-sync ${ts()}] realtime profiles event received`);
        queryClient.invalidateQueries({ queryKey: ['teacher-students'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, schoolName, queryClient]);

  const weeklyApprovedQuery = useQuery({
    queryKey: ['teacher-weekly-approved', schoolName],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const limitDate = sevenDaysAgo.toISOString();

      return (submissionsQuery.data ?? []).filter(
        (s) => s.status === 'approved' && (s.submitted_at || '') >= limitDate
      ).length;
    },
    enabled: !!userId && !!schoolName,
    staleTime: 5000,
    refetchInterval: 10000,
  });

  const classTotalPoints = (studentsQuery.data ?? []).reduce((sum, s) => sum + (s.eco_points || 0), 0);

  const activeThisWeekQuery = useQuery({
    queryKey: ['teacher-active-week', schoolName],
    queryFn: async () => {
      const studentIds = (studentsQuery.data ?? []).map((s) => s.id);
      if (studentIds.length === 0) return 0;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const limitDate = sevenDaysAgo.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('daily_points')
        .select('user_id,date')
        .in('user_id', studentIds)
        .gte('date', limitDate);

      if (error) throw error;

      return new Set((data || []).map((d) => d.user_id)).size;
    },
    enabled: !!userId && !!schoolName,
    staleTime: 5000,
    refetchInterval: 10000,
  });

  const classWeeklyQuery = useQuery({
    queryKey: ['teacher-class-weekly', schoolName],
    queryFn: async () => {
      const studentIds = (studentsQuery.data ?? []).map((s) => s.id);
      if (studentIds.length === 0) return [];

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      const limitDate = sevenDaysAgo.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('daily_points')
        .select('*')
        .in('user_id', studentIds)
        .gte('date', limitDate);

      if (error) throw error;

      const byDate: Record<string, number> = {};
      (data || []).forEach((d) => {
        byDate[d.date] = (byDate[d.date] || 0) + (d.points_earned || 0);
      });

      const result = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const key = date.toISOString().split('T')[0];
        const dayName = date.toLocaleDateString('en', { weekday: 'short' });
        result.push({ date: key, day: dayName, points: byDate[key] || 0 });
      }
      return result;
    },
    enabled: !!userId && !!schoolName,
    staleTime: 5000,
    refetchInterval: 10000,
  });

  const topStudentsWeekQuery = useQuery({
    queryKey: ['teacher-top-students-week', schoolName],
    queryFn: async () => {
      const studentIds = (studentsQuery.data ?? []).map((s) => s.id);
      if (studentIds.length === 0) return [];

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const limitDate = sevenDaysAgo.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('daily_points')
        .select('*')
        .in('user_id', studentIds)
        .gte('date', limitDate);

      if (error) throw error;

      const byUser: Record<string, number> = {};
      (data || []).forEach((d) => {
        byUser[d.user_id] = (byUser[d.user_id] || 0) + (d.points_earned || 0);
      });

      const sorted = Object.entries(byUser)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

      const studentsById = new Map((studentsQuery.data ?? []).map((s) => [s.id, s]));

      return sorted.map(([id, weekPoints], i) => {
        const p = studentsById.get(id);
        return {
          rank: i + 1,
          user_id: id,
          full_name: p?.full_name ?? 'Unknown',
          avatar_emoji: p?.avatar_emoji ?? '🌱',
          eco_points: p?.eco_points ?? 0,
          week_points: weekPoints,
        };
      });
    },
    enabled: !!userId && !!schoolName,
    staleTime: 5000,
    refetchInterval: 10000,
  });

  const approveSubmission = useMutation({
    mutationFn: async ({
      submissionId,
      missionId,
      studentId,
      feedback,
    }: {
      submissionId: string;
      missionId: string;
      studentId: string;
      feedback?: string;
    }) => {
      if (!userId) throw new Error('Not authenticated');
      const reviewerId = await ensureReviewerProfileId();

      const targetStudent = await supabaseQueries.profiles.getById(studentId);
      if (!targetStudent) throw new Error('Student not found');
      if (!isSameSchool(targetStudent)) {
        throw new Error('Student is outside your school scope');
      }

      const submission = await supabaseQueries.missionSubmissions.getById(submissionId);
      if (!submission) throw new Error('Submission not found');

      const mission = submission.missions;
      if (!mission || mission.id !== missionId) throw new Error('Mission not found');

      if (submission.status === 'approved') {
        return {
          studentName: targetStudent?.full_name || '',
          points: 0,
          alreadyApproved: true,
        };
      }

      const reviewTimestamp = new Date().toISOString();
      const { data: transitionedSubmission, error: transitionError } = await supabase
        .from('mission_submissions')
        .update({
          status: 'approved',
          reviewed_at: reviewTimestamp,
          reviewed_by: reviewerId,
          teacher_feedback: feedback || null,
          rejection_reason: null,
        })
        .eq('id', submissionId)
        .in('status', ['pending', 'submitted'])
        .select('id,status')
        .maybeSingle();

      if (transitionError) throw transitionError;

      if (!transitionedSubmission) {
        const latest = await supabaseQueries.missionSubmissions.getById(submissionId);
        if (latest?.status === 'approved') {
          return {
            studentName: targetStudent?.full_name || '',
            points: 0,
            alreadyApproved: true,
          };
        }

        throw new Error('Submission is no longer pending and could not be approved');
      }

      const points = mission.eco_points_reward || 0;
      await supabaseQueries.profiles.addEcoPoints(studentId, points);

      const today = new Date().toISOString().split('T')[0];
      const existing = await supabaseQueries.dailyPoints.getByUserAndDate(studentId, today);
      const nextPoints = (existing?.points_earned || 0) + points;
      await supabaseQueries.dailyPoints.recordPoints(studentId, nextPoints, today);

      await supabaseQueries.notifications.create({
        user_id: studentId,
        title: `Mission approved! +${points} EcoPoints 🌿`,
        body: `Your mission "${mission.title}" was approved by ${profile?.full_name ?? 'your teacher'}.${feedback ? ` Feedback: ${feedback}` : ''}`,
        type: 'mission',
        is_read: false,
      });

      return {
        studentName: targetStudent?.full_name || '',
        points,
        alreadyApproved: false,
      };
    },
    onSuccess: (data) => {
      invalidateTeacherViews();
      queryClient.invalidateQueries({ queryKey: ['rank'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-points'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });

      if (data.alreadyApproved) {
        toast({ title: 'Already approved', description: 'Points were already awarded for this submission' });
      } else {
        toast({ title: 'Approved! 🌿', description: `Student earned ${data.points} EcoPoints` });
      }
    },
    onError: (err: Error) => {
      toast({ title: 'Error approving', description: err.message, variant: 'destructive' });
    },
    onSettled: () => {
      invalidateTeacherViews();
    },
  });

  const rejectSubmission = useMutation({
    mutationFn: async ({
      submissionId,
      studentId,
      reason,
      feedback,
    }: {
      submissionId: string;
      missionId: string;
      studentId: string;
      reason: string;
      feedback?: string;
    }) => {
      if (!userId) throw new Error('Not authenticated');
      const reviewerId = await ensureReviewerProfileId();

      const targetStudent = await supabaseQueries.profiles.getById(studentId);
      if (!targetStudent) throw new Error('Student not found');
      if (!isSameSchool(targetStudent)) {
        throw new Error('Student is outside your school scope');
      }

      const reviewTimestamp = new Date().toISOString();
      const rejectionText = `${reason}${feedback ? `. ${feedback}` : ''}`;
      const { data: transitionedSubmission, error: transitionError } = await supabase
        .from('mission_submissions')
        .update({
          status: 'rejected',
          reviewed_at: reviewTimestamp,
          reviewed_by: reviewerId,
          teacher_feedback: rejectionText,
          rejection_reason: rejectionText,
        })
        .eq('id', submissionId)
        .in('status', ['pending', 'submitted'])
        .select('id,status')
        .maybeSingle();

      if (transitionError) throw transitionError;

      if (!transitionedSubmission) {
        const latest = await supabaseQueries.missionSubmissions.getById(submissionId);
        if (latest?.status === 'rejected') return;
        if (latest?.status === 'approved') {
          throw new Error('Submission is already approved and cannot be rejected');
        }
        throw new Error('Submission is no longer pending and could not be rejected');
      }

      await supabaseQueries.notifications.create({
        user_id: studentId,
        title: 'Mission needs revision',
        body: `${reason}${feedback ? `. ${feedback}` : ''}. Try again! 💪`,
        type: 'mission',
        is_read: false,
      });
    },
    onSuccess: () => {
      invalidateTeacherViews();
      toast({ title: 'Submission rejected', description: 'Student has been notified' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error rejecting', description: err.message, variant: 'destructive' });
    },
    onSettled: () => {
      invalidateTeacherViews();
    },
  });

  const awardBonusPoints = useMutation({
    mutationFn: async ({ studentId, points, reason }: { studentId: string; points: number; reason: string }) => {
      if (points > 50 || points < 1) throw new Error('Points must be 1-50');
      const normalizedReason = reason.trim();
      if (!normalizedReason) throw new Error('Reason is required');

      const dedupeKey = `${studentId}:${points}:${normalizedReason.toLowerCase()}`;
      if (bonusAwardLocksRef.current.has(dedupeKey)) {
        throw new Error('Bonus award is already being processed');
      }

      bonusAwardLocksRef.current.add(dedupeKey);

      try {
        const student = await supabaseQueries.profiles.getById(studentId);
        if (!student) throw new Error('Student not found');
        if (!isSameSchool(student)) {
          throw new Error('Student is outside your school scope');
        }

        try {
          await supabaseQueries.profiles.addEcoPoints(studentId, points);
        } catch (error) {
          throw new Error(`Failed to update student EcoPoints: ${toErrorMessage(error)}`);
        }

        const today = new Date().toISOString().split('T')[0];
        let existing;
        try {
          existing = await supabaseQueries.dailyPoints.getByUserAndDate(studentId, today);
        } catch (error) {
          throw new Error(`Failed to read today's daily points: ${toErrorMessage(error)}`);
        }
        const nextPoints = (existing?.points_earned || 0) + points;
        try {
          await supabaseQueries.dailyPoints.recordPoints(studentId, nextPoints, today);
        } catch (error) {
          throw new Error(`Failed to write daily points: ${toErrorMessage(error)}`);
        }

        try {
          await supabaseQueries.notifications.create({
            user_id: studentId,
            title: `You received ${points} bonus EcoPoints! 🎉`,
            body: `From ${profile?.full_name ?? 'your teacher'}. Reason: ${normalizedReason}`,
            type: 'reward',
            is_read: false,
          });
        } catch (error) {
          console.warn(`[teacher-sync ${ts()}] notification creation failed but points were awarded`, error);
        }

        return student.full_name;
      } finally {
        bonusAwardLocksRef.current.delete(dedupeKey);
      }
    },
    onSuccess: (name) => {
      invalidateTeacherViews();
      queryClient.invalidateQueries({ queryKey: ['rank'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-points'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast({ title: `Bonus points awarded to ${name}! 🎉` });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const createMission = useMutation({
    mutationFn: async (mission: {
      title: string;
      description: string;
      category: string;
      difficulty: string;
      eco_points_reward: number;
      requires_photo: boolean;
      requires_location: boolean;
      school_only: boolean;
      expires_at?: string;
    }) => {
      const xpMap: Record<string, number> = { easy: 25, medium: 50, hard: 100 };
      await supabaseQueries.missions.create({
        title: mission.title,
        description: mission.description,
        category: mission.category as any,
        difficulty: mission.difficulty as any,
        eco_points_reward: mission.eco_points_reward,
        xp_reward: xpMap[mission.difficulty] ?? 25,
        requires_photo: mission.requires_photo,
        requires_location: mission.requires_location,
        requires_teacher_approval: true,
        is_active: true,
        created_by: userId,
        steps: [],
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-missions'] });
      toast({ title: 'Mission created! 🌿', description: 'Your students can now see it' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error creating mission', description: err.message, variant: 'destructive' });
    },
  });

  const missionsQuery = useQuery({
    queryKey: ['teacher-missions'],
    queryFn: async () => {
      const missions = await supabaseQueries.missions.getAll();
      return missions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
    enabled: !!userId,
  });

  const missionCompletionQuery = useQuery({
    queryKey: ['teacher-mission-completions', schoolName],
    queryFn: async () => {
      const approved = (submissionsQuery.data ?? []).filter((s) => s.status === 'approved');
      const counts: Record<string, number> = {};
      approved.forEach((d) => {
        counts[d.mission_id] = (counts[d.mission_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!userId && !!schoolName,
  });

  return {
    students: studentsQuery.data ?? [],
    submissions: submissionsQuery.data ?? [],
    pendingSubmissions,
    pendingCount,
    weeklyApproved: weeklyApprovedQuery.data ?? 0,
    classTotalPoints,
    activeThisWeek: activeThisWeekQuery.data ?? 0,
    classWeekly: classWeeklyQuery.data ?? [],
    topStudentsWeek: topStudentsWeekQuery.data ?? [],
    missions: missionsQuery.data ?? [],
    missionCompletions: missionCompletionQuery.data ?? {},
    isLoading: studentsQuery.isLoading || submissionsQuery.isLoading,
    approveSubmission,
    rejectSubmission,
    awardBonusPoints,
    createMission,
  };
}
