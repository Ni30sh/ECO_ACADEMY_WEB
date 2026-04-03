import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseQueries } from '@/integrations/supabase/queries';
import { useAuth } from './useAuth';

interface SubmitStepInput {
  missionSubmissionId: string;
  stepId: string;
  checkpointData: any;
  stepNumber?: number;
}

export function useMissionSteps(missionId: string, missionSubmissionId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: userSubmission } = useQuery({
    queryKey: ['mission-submission-by-mission', user?.id, missionId],
    queryFn: async () => {
      if (!user) return null;
      const submissions = await supabaseQueries.missionSubmissions.getUserSubmissions(user.id);
      return submissions.find((s) => s.mission_id === missionId) || null;
    },
    enabled: !!user && !missionSubmissionId,
  });

  const effectiveSubmissionId = missionSubmissionId || userSubmission?.id;

  const stepsQuery = useQuery({
    queryKey: ['mission-steps', missionId],
    queryFn: () => supabaseQueries.missionSteps.getByMissionId(missionId),
    enabled: !!missionId,
  });

  const stepSubmissionsQuery = useQuery({
    queryKey: ['mission-step-submissions', effectiveSubmissionId],
    queryFn: () => supabaseQueries.missionStepSubmissions.getByMissionSubmission(effectiveSubmissionId as string),
    enabled: !!effectiveSubmissionId,
  });

  const submitStep = useMutation({
    mutationFn: async ({ missionSubmissionId, stepId, checkpointData }: SubmitStepInput) => {
      return supabaseQueries.missionStepSubmissions.submitStep(
        missionSubmissionId,
        stepId,
        checkpointData,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mission-step-submissions', effectiveSubmissionId] });
      queryClient.invalidateQueries({ queryKey: ['mission-submission', user?.id, missionId] });
    },
  });

  return {
    steps: stepsQuery.data || [],
    stepSubmissions: stepSubmissionsQuery.data || [],
    submitStep,
    isLoading: stepsQuery.isLoading || stepSubmissionsQuery.isLoading,
  };
}
