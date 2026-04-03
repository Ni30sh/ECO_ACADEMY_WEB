import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseQueries } from '@/integrations/supabase/queries';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export function useDashboardData() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const currentSchoolName = (profile?.school_name || '').trim();
  const previousSubmissionStatusRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`student-live-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mission_submissions',
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          queryClient.invalidateQueries({ queryKey: ['submissions', userId] });
          queryClient.invalidateQueries({ queryKey: ['activity', userId] });
          await refreshProfile();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_points',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['weekly-points', userId] });
          queryClient.invalidateQueries({ queryKey: ['rank', userId] });
          queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        async () => {
          await refreshProfile();
          queryClient.invalidateQueries({ queryKey: ['rank', userId] });
          queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient, refreshProfile]);

  const rankQuery = useQuery({
    queryKey: ['rank', userId, profile?.eco_points],
    queryFn: async () => {
      if (!userId || !profile) return 999;
      return supabaseQueries.leaderboard.getRank(userId);
    },
    enabled: !!userId && !!profile,
  });

  const leaderboardQuery = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const rows = await supabaseQueries.leaderboard.getTopUsers(5);
      return rows.map((p) => ({
        id: p.id,
        full_name: p.full_name,
        avatar_emoji: p.avatar_emoji,
        eco_points: p.eco_points,
        school_name: p.school_name,
      }));
    },
    enabled: !!userId,
  });

  const missionsQuery = useQuery({
    queryKey: ['dashboard-missions'],
    queryFn: async () => {
      const missions = await supabaseQueries.missions.getAll();
      return missions.slice(0, 3);
    },
    enabled: !!userId,
  });

  const submissionsQuery = useQuery({
    queryKey: ['submissions', userId],
    queryFn: async () => {
      if (!userId) return [];
      return supabaseQueries.missionSubmissions.getUserSubmissions(userId);
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (!userId) return;

    const rows = submissionsQuery.data ?? [];
    const currentStatusMap: Record<string, string> = {};

    rows.forEach((s: any) => {
      currentStatusMap[s.id] = s.status || 'available';
    });

    const previousMap = previousSubmissionStatusRef.current;
    const isFirstSync = Object.keys(previousMap).length === 0;

    if (!isFirstSync) {
      rows.forEach((s: any) => {
        const previous = previousMap[s.id];
        const current = s.status || 'available';
        if (previous && previous !== current) {
          if (current === 'approved') {
            toast({
              title: 'Mission approved! ✅',
              description: `Your submission for "${s.missions?.title || 'mission'}" was approved.`,
            });
          } else if (current === 'rejected') {
            toast({
              title: 'Submission needs revision',
              description: s.rejection_reason || `Your submission for "${s.missions?.title || 'mission'}" was rejected.`,
              variant: 'destructive',
            });
          }
        }
      });
    }

    previousSubmissionStatusRef.current = currentStatusMap;
  }, [submissionsQuery.data, toast, userId]);

  const weeklyQuery = useQuery({
    queryKey: ['weekly-points', userId],
    queryFn: async () => {
      if (!userId) return [];
      return supabaseQueries.dailyPoints.getWeeklyPoints(userId);
    },
    enabled: !!userId,
  });

  const activityQuery = useQuery({
    queryKey: ['activity', userId],
    queryFn: async () => {
      if (!userId) return [];
      const submissions = await supabaseQueries.missionSubmissions.getUserSubmissions(userId);
      return submissions
        .filter((s) => ['approved', 'pending', 'in_progress'].includes(s.status))
        .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
        .slice(0, 4);
    },
    enabled: !!userId,
  });

  const notificationsQuery = useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      if (!userId) return [];
      const notifications = await supabaseQueries.notifications.getUserNotifications(userId);
      return notifications.slice(0, 10);
    },
    enabled: !!userId,
  });

  const unreadCount = (notificationsQuery.data ?? []).filter((n) => !n.is_read).length;

  const acceptMission = useMutation({
    mutationFn: async (missionId: string) => {
      if (!userId) throw new Error('Not authenticated');

      // Ensure profile exists before creating submission
      await refreshProfile();

      const existing = (submissionsQuery.data ?? []).find((s: any) => s.mission_id === missionId);
      if (existing) return existing;

      return supabaseQueries.missionSubmissions.create({
        user_id: userId,
        mission_id: missionId,
        status: 'in_progress',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
      queryClient.invalidateQueries({ queryKey: ['activity'] });
      toast({ title: 'Quest accepted! 🌿', description: 'Complete it and submit proof to earn points' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const submitProof = useMutation({
    mutationFn: async ({
      submissionId,
      photoUrl,
      notes,
      coords,
    }: {
      submissionId: string;
      photoUrl?: string;
      notes?: string;
      coords?: { lat: number; lng: number };
    }) => {
      if (!userId) throw new Error('Not authenticated');

      // Ensure profile exists before operations
      await refreshProfile();

      const submission = await supabaseQueries.missionSubmissions.getById(submissionId);
      if (!submission) throw new Error('Submission not found');

      const mission = submission.missions;
      if (!mission) throw new Error('Mission not found');

      // If no evidence is required, auto-approve and reward instantly.
      const shouldAutoApprove = !mission.requires_photo && !mission.requires_location;

      await supabaseQueries.missionSubmissions.update(submissionId, {
        status: shouldAutoApprove ? 'approved' : 'pending',
        photo_url: photoUrl ?? null,
        notes: notes ?? null,
        location_lat: coords?.lat ?? null,
        location_lng: coords?.lng ?? null,
        submitted_at: new Date().toISOString(),
        reviewed_at: shouldAutoApprove ? new Date().toISOString() : null,
      });

      if (shouldAutoApprove) {
        const points = mission.eco_points_reward || 0;
        await supabaseQueries.profiles.addEcoPoints(userId, points);

        const today = new Date().toISOString().split('T')[0];
        const existingToday = await supabaseQueries.dailyPoints.getByUserAndDate(userId, today);
        const nextPoints = (existingToday?.points_earned || 0) + points;
        await supabaseQueries.dailyPoints.recordPoints(userId, nextPoints, today);

        await supabaseQueries.notifications.create({
          user_id: userId,
          title: `Mission completed! +${points} EcoPoints 🌿`,
          body: `Great work on "${mission.title}". Your reward was added instantly.`,
          type: 'mission',
          is_read: false,
        });
      } else {
        await supabaseQueries.notifications.create({
          user_id: userId,
          title: 'Proof submitted! 📸',
          body: `Your proof for "${mission.title}" is pending teacher review.`,
          type: 'mission',
          is_read: false,
        });
      }

      return {
        autoApproved: shouldAutoApprove,
        pointsAwarded: shouldAutoApprove ? (mission.eco_points_reward || 0) : 0,
      };
    },
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
      queryClient.invalidateQueries({ queryKey: ['activity'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-points'] });
      queryClient.invalidateQueries({ queryKey: ['rank'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      await refreshProfile();

      if (result.autoApproved) {
        toast({ title: 'Mission completed! 🎉', description: `You earned ${result.pointsAwarded} EcoPoints` });
      } else {
        toast({ title: 'Proof submitted! 📸', description: 'Your teacher will review it soon' });
      }
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const checkAutoApprove = async () => {
    // No background job required for Supabase flow.
  };

  const treesPlantedQuery = useQuery({
    queryKey: ['trees-planted', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const submissions = await supabaseQueries.missionSubmissions.getUserSubmissions(userId);
      return submissions.filter((s) => s.status === 'approved' && s.missions?.category === 'planting').length;
    },
    enabled: !!userId,
  });

  const realUserCountQuery = useQuery({
    queryKey: ['real-user-count'],
    queryFn: async () => {
      const profiles = await supabaseQueries.profiles.getAll();
      return profiles.length;
    },
    enabled: !!userId,
  });

  const markAllRead = async () => {
    if (!userId) return;
    await supabaseQueries.notifications.markAllAsRead(userId);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  return {
    profile,
    rank: rankQuery.data ?? 999,
    leaderboard: leaderboardQuery.data ?? [],
    missions: missionsQuery.data ?? [],
    submissions: submissionsQuery.data ?? [],
    weeklyPoints: weeklyQuery.data ?? [],
    activity: activityQuery.data ?? [],
    notifications: notificationsQuery.data ?? [],
    unreadCount,
    treesPlanted: treesPlantedQuery.data ?? 0,
    realUserCount: realUserCountQuery.data ?? 0,
    isLoading: !profile || missionsQuery.isLoading,
    acceptMission,
    submitProof,
    checkAutoApprove,
    markAllRead,
    refreshProfile,
  };
}
