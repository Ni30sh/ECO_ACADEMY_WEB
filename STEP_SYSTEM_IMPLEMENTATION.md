# Step System Implementation Examples

This file shows how to integrate the step system into your existing pages.

## 1. Update MissionsPage to Use Steps

### Before (localStorage)

```typescript
// OLD - missions without steps
function MissionDetailPanel({ mission, onClose }: { mission: Mission; onClose: () => void }) {
  return (
    <div>
      <h2>{mission.title}</h2>
      <p>{mission.description}</p>
      <Button onClick={() => submitMission(mission.id)}>Submit Proof</Button>
    </div>
  );
}
```

### After (Supabase + Steps)

```typescript
import MissionStepViewer from '@/components/MissionStepViewer';
import { supabaseQueries } from '@/integrations/supabase/queries';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';

function MissionDetailPanel({ mission, onClose }: { mission: Mission; onClose: () => void }) {
  const { user } = useAuth();
  const [submission, setSubmission] = useState<any>(null);

  // Get or create submission
  useEffect(() => {
    const fetchSubmission = async () => {
      if (!user || !mission.id) return;

      const submissions = await supabaseQueries.missionSubmissions.getUserSubmissions(user.id);
      const existing = submissions.find(s => s.mission_id === mission.id);

      if (existing) {
        setSubmission(existing);
      } else {
        // Create new submission
        const newSubmission = await supabaseQueries.missionSubmissions.create({
          user_id: user.id,
          mission_id: mission.id,
          status: 'in_progress'
        });
        setSubmission(newSubmission);
      }
    };

    fetchSubmission();
  }, [user, mission.id]);

  if (!submission) {
    return <div>Loading mission...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{mission.title}</h2>
        <p className="text-muted-foreground">{mission.description}</p>
      </div>

      {/* Check if mission has steps */}
      {mission.steps && mission.steps.length > 0 ? (
        // Use new step viewer
        <MissionStepViewer
          missionId={mission.id}
          submissionId={submission.id}
          missionTitle={mission.title}
        />
      ) : (
        // Simple mission without steps (legacy)
        <ProofSubmissionSheet mission={mission} submission={submission} />
      )}
    </div>
  );
}
```

---

## 2. Update DashboardPage Recent Activity

### Before (localStorage)

```typescript
const activity = submissions
  .filter((s) => ["approved", "pending"].includes(s.status))
  .sort(
    (a, b) =>
      new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime(),
  )
  .slice(0, 4);
```

### After (Supabase)

```typescript
const { useQuery } = require('@tanstack/react-query');
const { supabaseQueries } = require('@/integrations/supabase/queries');
const { useAuth } = require('@/hooks/useAuth');

function DashboardActivity() {
  const { user } = useAuth();

  const { data: submissions = [] } = useQuery({
    queryKey: ['activity', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const allSubmissions = await supabaseQueries.missionSubmissions.getUserSubmissions(user.id);
      return allSubmissions
        .filter(s => ['approved', 'pending', 'in_progress'].includes(s.status))
        .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
        .slice(0, 4);
    },
    enabled: !!user
  });

  return (
    <div className="space-y-3">
      {submissions.map(submission => {
        const mission = submission.missions;
        return (
          <div key={submission.id} className="p-4 bg-card rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{mission.title}</p>
                <p className="text-sm text-muted-foreground">
                  {submission.status === 'approved' && '✅ Approved'}
                  {submission.status === 'pending' && '⏳ Pending Review'}
                  {submission.status === 'in_progress' && '🔄 In Progress'}
                </p>
              </div>
              <span className="text-sm font-mono">+{mission.eco_points_reward} pts</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

---

## 3. Create Teacher Submissions Review Page

### New Page: `src/pages/teacher/TeacherStepReview.tsx`

```typescript
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabaseQueries } from '@/integrations/supabase/queries';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import TeacherStepReview from '@/components/TeacherStepReview';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TeacherSubmissionReview() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState<'pending' | 'verified' | 'rejected'>('pending');

  // Check if teacher
  if (profile?.role !== 'teacher') {
    return <div>Access denied. Teacher role required.</div>;
  }

  // Get all pending step submissions
  const { data: stepSubmissions = [], isLoading, refetch } = useQuery({
    queryKey: ['step-submissions', selectedTab],
    queryFn: async () => {
      // Get all mission submissions for this school/assigned to teacher
      const allSubmissions = await supabaseQueries.missionSubmissions.getByStatus(selectedTab);

      // Get step submissions
      const stepSubs = [];
      for (const submission of allSubmissions) {
        const steps = await supabaseQueries.missionStepSubmissions
          .getByMissionSubmission(submission.id);
        for (const step of steps) {
          stepSubs.push({
            ...step,
            missionSubmission: submission
          });
        }
      }

      return stepSubs;
    },
    enabled: !!user
  });

  const pendingCount = stepSubmissions.filter(s => s.status === 'pending').length;
  const verifiedCount = stepSubmissions.filter(s => s.status === 'verified').length;
  const rejectedCount = stepSubmissions.filter(s => s.status === 'rejected').length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/teacher-dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Step Reviews</h1>
        </div>
        <div className="text-sm text-muted-foreground">
          {pendingCount} pending • {verifiedCount} verified • {rejectedCount} rejected
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['pending', 'verified', 'rejected'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors
              ${selectedTab === tab
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }
            `}
          >
            {tab === 'pending' && `Pending (${pendingCount})`}
            {tab === 'verified' && `✅ Verified (${verifiedCount})`}
            {tab === 'rejected' && `❌ Rejected (${rejectedCount})`}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-8">Loading reviews...</div>
      ) : stepSubmissions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No {selectedTab} submissions
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {stepSubmissions.map(stepSubmission => (
            <TeacherStepReview
              key={stepSubmission.id}
              stepSubmissionId={stepSubmission.id}
              missionTitle={stepSubmission.missionSubmission.missions.title}
              studentName={stepSubmission.missionSubmission.profiles.full_name}
              stepTitle={stepSubmission.mission_steps.title}
              stepNumber={stepSubmission.mission_steps.step_number}
              checkpointData={stepSubmission.checkpoint_data}
              checkpointType={stepSubmission.mission_steps.checkpoint_type}
              onVerified={() => refetch()}
              onRejected={() => refetch()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

### Update `src/pages/teacher/TeacherOverview.tsx`

Add review button:

```typescript
<Link to="/teacher/reviews">
  <Button className="gap-2">
    📋 Step Reviews ({pendingCount})
  </Button>
</Link>
```

---

## 4. Update App Routes

### In `src/App.tsx`

```typescript
import TeacherStepReview from './pages/teacher/TeacherStepReview';

// Add to routes
<Route
  path="/teacher/reviews"
  element={
    <TeacherRoute>
      <TeacherLayout>
        <TeacherStepReview />
      </TeacherLayout>
    </TeacherRoute>
  }
/>
```

---

## 5. Mission Progress Tracking Hook

### New Hook: `src/hooks/useMissionProgress.ts`

```typescript
import { useQuery } from "@tanstack/react-query";
import { supabaseQueries } from "@/integrations/supabase/queries";
import { useAuth } from "./useAuth";

export function useMissionProgress(missionId: string) {
  const { user } = useAuth();

  const { data: submission } = useQuery({
    queryKey: ["mission-submission", user?.id, missionId],
    queryFn: async () => {
      if (!user) return null;
      const submissions =
        await supabaseQueries.missionSubmissions.getUserSubmissions(user.id);
      return submissions.find((s) => s.mission_id === missionId) || null;
    },
    enabled: !!user,
  });

  const { data: steps = [] } = useQuery({
    queryKey: ["mission-steps", missionId],
    queryFn: () => supabaseQueries.missionSteps.getByMissionId(missionId),
  });

  const { data: stepSubmissions = [] } = useQuery({
    queryKey: ["step-submissions", submission?.id],
    queryFn: () => {
      if (!submission) return [];
      return supabaseQueries.missionStepSubmissions.getByMissionSubmission(
        submission.id,
      );
    },
    enabled: !!submission,
  });

  // Calculate progress
  const completedSteps = stepSubmissions.filter(
    (ss) => ss.status === "verified",
  ).length;
  const totalSteps = steps.length;
  const progressPercentage =
    totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return {
    submission,
    steps,
    stepSubmissions,
    completedSteps,
    totalSteps,
    progressPercentage,
    isComplete: completedSteps === totalSteps && totalSteps > 0,
  };
}
```

---

## 6. Usage in a Component

### Example: `StudentMissionCard.tsx`

```typescript
import { useMissionProgress } from '@/hooks/useMissionProgress';
import { motion } from 'framer-motion';

export function StudentMissionCard({ mission }: { mission: any }) {
  const { progressPercentage, isComplete, steps } = useMissionProgress(mission.id);

  return (
    <motion.div
      whileHover={{ y: -6 }}
      className="p-4 rounded-lg bg-card border border-border space-y-3"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{mission.category}</p>
          <h3 className="font-bold text-foreground">{mission.title}</h3>
        </div>
        <span className="text-lg">{mission.icon_url}</span>
      </div>

      {/* Step progress if mission has steps */}
      {steps.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Steps: {Math.round(progressPercentage)}%
            </span>
            {isComplete && <span className="text-jungle-bright font-bold">✅ Complete</span>}
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-jungle-bright"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm font-mono text-jungle-bright">
          +{mission.eco_points_reward} pts
        </span>
        <Button size="sm" variant="outline">
          Continue
        </Button>
      </div>
    </motion.div>
  );
}
```

---

## 7. Database Hooks for Admin Mission Management

### New Hook: `src/hooks/useAdminMissions.ts`

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseQueries } from "@/integrations/supabase/queries";
import { useToast } from "./use-toast";

export function useAdminMissions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const missionsQuery = useQuery({
    queryKey: ["admin-missions"],
    queryFn: () => supabaseQueries.missions.getAll(),
  });

  const createMission = useMutation({
    mutationFn: async (missionData: any) => {
      const mission = await supabaseQueries.missions.create(missionData);

      // Create steps if provided
      if (missionData.steps && missionData.steps.length > 0) {
        for (let i = 0; i < missionData.steps.length; i++) {
          await supabaseQueries.missionSteps.create({
            mission_id: mission.id,
            step_number: i + 1,
            title: missionData.steps[i],
            description: missionData.steps[i],
            has_checkpoint: true,
            checkpoint_type: "photo",
          });
        }
      }

      return mission;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-missions"] });
      toast({ title: "Mission created!" });
    },
  });

  return {
    missions: missionsQuery.data || [],
    createMission,
    isLoading: missionsQuery.isLoading,
  };
}
```

---

## 8. Testing the Step System

### Testing Checklist

```typescript
// Test 1: Create mission and steps
async function testStepCreation() {
  // Create mission
  const mission = await supabaseQueries.missions.create({
    title: "Test Mission",
    category: "planting",
    difficulty: "easy",
    eco_points_reward: 50,
    icon_url: "🌱",
    is_active: true,
  });

  // Create steps
  await supabaseQueries.missionSteps.create({
    mission_id: mission.id,
    step_number: 1,
    title: "Step 1",
    has_checkpoint: true,
    checkpoint_type: "photo",
  });

  console.log("✅ Mission and steps created");
}

// Test 2: Student submits step
async function testStepSubmission() {
  const submission = await supabaseQueries.missionSubmissions.create({
    user_id: "user-123",
    mission_id: "mission-123",
    status: "in_progress",
  });

  const stepSubmission =
    await supabaseQueries.missionStepSubmissions.submitStep(
      submission.id,
      "step-123",
      { photo_url: "https://..." },
    );

  console.log("✅ Step submitted:", stepSubmission.status); // 'pending'
}

// Test 3: Teacher verifies step
async function testStepVerification() {
  await supabaseQueries.missionStepSubmissions.verifyStep(
    "step-submission-123",
    "teacher-123",
    "Great photo!",
  );

  console.log("✅ Step verified");
}
```

---

This provides a complete implementation guide for using the step system throughout your application!
