import { useQuery } from '@tanstack/react-query';
import { supabaseQueries } from '@/integrations/supabase/queries';
import { useAuth } from './useAuth';

/**
 * Hook to track mission step progress for a student.
 * Shows current step, completed steps, and overall progress percentage.
 */
export function useMissionProgress(missionId: string) {
  const { user } = useAuth();

  // Get the user's mission submission
  const { data: submission } = useQuery({
    queryKey: ['mission-submission', user?.id, missionId],
    queryFn: async () => {
      if (!user) return null;
      const submissions = await supabaseQueries.missionSubmissions.getUserSubmissions(user.id);
      return submissions.find(s => s.mission_id === missionId) || null;
    },
    enabled: !!user
  });

  // Get all steps in the mission
  const { data: steps = [] } = useQuery({
    queryKey: ['mission-steps', missionId],
    queryFn: () => supabaseQueries.missionSteps.getByMissionId(missionId)
  });

  // Get all step submissions for this mission
  const { data: stepSubmissions = [] } = useQuery({
    queryKey: ['step-submissions', submission?.id],
    queryFn: () => {
      if (!submission) return [];
      return supabaseQueries.missionStepSubmissions.getByMissionSubmission(submission.id);
    },
    enabled: !!submission
  });

  // Calculate progress metrics
  const completedSteps = stepSubmissions.filter(ss => ss.status === 'verified').length;
  const totalSteps = steps.length;
  const progressPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
  const currentStep = Math.min(completedSteps + 1, Math.max(totalSteps, 1));

  return {
    submission,
    steps,
    stepSubmissions,
    completedSteps,
    totalSteps,
    progressPercentage,
    currentStep,
    isComplete: completedSteps === totalSteps && totalSteps > 0,
    isLoading: !submission && !!user
  };
}
