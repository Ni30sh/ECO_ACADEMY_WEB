import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseQueries } from '@/integrations/supabase/queries';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export function useProfileData() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const approvedSubmissionsQuery = useQuery({
    queryKey: ['profile-approved-submissions', userId],
    queryFn: async () => {
      if (!userId) return [];
      const submissions = await supabaseQueries.missionSubmissions.getUserSubmissions(userId);
      return submissions.filter((s) => s.status === 'approved');
    },
    enabled: !!userId,
  });

  const missionsCompletedQuery = useQuery({
    queryKey: ['profile-missions-completed', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const approved = approvedSubmissionsQuery.data ?? [];
      return approved.length;
    },
    enabled: !!userId,
  });

  const treesPlantedQuery = useQuery({
    queryKey: ['profile-trees-planted', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const approved = approvedSubmissionsQuery.data ?? [];
      return approved.filter((s) => s.missions?.category === 'planting').length;
    },
    enabled: !!userId,
  });

  const waterMissionsQuery = useQuery({
    queryKey: ['profile-water-missions', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const approved = approvedSubmissionsQuery.data ?? [];
      return approved.filter((s) => s.missions?.category === 'water').length;
    },
    enabled: !!userId,
  });

  const wasteMissionsQuery = useQuery({
    queryKey: ['profile-waste-missions', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const approved = approvedSubmissionsQuery.data ?? [];
      return approved.filter((s) => s.missions?.category === 'waste').length;
    },
    enabled: !!userId,
  });

  const categoriesQuery = useQuery({
    queryKey: ['profile-categories', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const approved = approvedSubmissionsQuery.data ?? [];
      const categories = new Set(approved.map((s) => s.missions?.category).filter(Boolean));
      return categories.size;
    },
    enabled: !!userId,
  });

  const weeklyPointsQuery = useQuery({
    queryKey: ['profile-weekly-points', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const weekly = await supabaseQueries.dailyPoints.getWeeklyPoints(userId);
      return weekly.reduce((sum, d) => sum + (d.points_earned || 0), 0);
    },
    enabled: !!userId,
  });

  const monthlyMissionsQuery = useQuery({
    queryKey: ['profile-monthly-missions', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const limit = startOfMonth.toISOString();
      const approved = approvedSubmissionsQuery.data ?? [];
      return approved.filter((s) => (s.submitted_at || '') >= limit).length;
    },
    enabled: !!userId,
  });

  const realUserCountQuery = useQuery({
    queryKey: ['profile-real-user-count'],
    queryFn: async () => {
      const profiles = await supabaseQueries.profiles.getAll();
      return profiles.length;
    },
    enabled: !!userId,
  });

  const rankQuery = useQuery({
    queryKey: ['profile-rank', userId, profile?.eco_points],
    queryFn: async () => {
      if (!userId || !profile) return 999;
      return supabaseQueries.leaderboard.getRank(userId);
    },
    enabled: !!userId && !!profile,
  });

  const submissionsQuery = async (offset: number, limit: number, filter: 'all' | 'week' | 'month') => {
    let gte: string | undefined;
    if (filter === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      gte = d.toISOString();
    } else if (filter === 'month') {
      const d = new Date();
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      gte = d.toISOString();
    }

    if (!userId) return { data: [], count: 0 };

    let submissions = await supabaseQueries.missionSubmissions.getUserSubmissions(userId);

    if (gte) {
      submissions = submissions.filter((s) => (s.submitted_at || '') >= gte);
    }

    submissions = submissions.sort(
      (a, b) => new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime()
    );

    const paginated = submissions.slice(offset, offset + limit);
    return { data: paginated, count: submissions.length };
  };

  const updateProfile = useMutation({
    mutationFn: async (updates: { full_name?: string; school_name?: string; city?: string }) => {
      if (!userId) throw new Error('Not authenticated');
      await supabaseQueries.profiles.update(userId, {
        ...updates,
        updated_at: new Date().toISOString(),
      });
    },
    onSuccess: async () => {
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ['profile-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      toast({ title: 'Profile updated! 🌿' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const updateAvatar = useMutation({
    mutationFn: async (avatar_emoji: string) => {
      if (!userId) throw new Error('Not authenticated');
      await supabaseQueries.profiles.update(userId, {
        avatar_emoji,
        updated_at: new Date().toISOString(),
      });
    },
    onSuccess: async () => {
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      toast({ title: 'Avatar updated! ✨' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  return {
    missionsCompleted: missionsCompletedQuery.data ?? 0,
    treesPlanted: treesPlantedQuery.data ?? 0,
    waterMissions: waterMissionsQuery.data ?? 0,
    wasteMissions: wasteMissionsQuery.data ?? 0,
    categoriesCount: categoriesQuery.data ?? 0,
    weeklyPoints: weeklyPointsQuery.data ?? 0,
    monthlyMissions: monthlyMissionsQuery.data ?? 0,
    realUserCount: realUserCountQuery.data ?? 0,
    rank: rankQuery.data ?? 999,
    submissionsQuery,
    updateProfile,
    updateAvatar,
    isLoading: missionsCompletedQuery.isLoading,
  };
}
