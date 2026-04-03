# Supabase Query Quick Reference

> **Note**: Replace all `localStore` calls with Supabase queries using this reference.

## Installation & Setup

```typescript
// Import in any component/hook
import { supabaseQueries } from "@/integrations/supabase/queries";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
```

### Admin Login Recovery (Auth + Role)

If admin login shows `Invalid login credentials`, first create/reset the user in **Supabase Authentication**.
Then run this in SQL editor to ensure profile role is admin:

```sql
-- Replace with your admin email
-- This updates role only if the auth user exists.
UPDATE profiles p
SET role = 'admin'
FROM auth.users u
WHERE p.id = u.id
  AND lower(u.email) = lower('admin1@gmail.com');

-- Verify
SELECT u.email, p.id, p.role
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE lower(u.email) = lower('admin1@gmail.com');
```

Expected result: one row with `role = 'admin'`.

One-file helper:

- Run `supabase/queries/admin_setup_check.sql` in Supabase SQL Editor.
- It includes diagnosis, safe profile upsert + role fix, and final verification in three sections.

---

## 1. PROFILES (Users)

### Get Current User Profile

```typescript
const { user } = useAuth();

// Get user's profile
const profile = await supabaseQueries.profiles.getById(user.id);
```

### Update Profile (Eco Points, Streak, etc.)

```typescript
// Add eco points
await supabaseQueries.profiles.addEcoPoints(userId, 100);

// Result: Eco points increased by 100, auto-updates `updated_at`

// Update custom fields
await supabaseQueries.profiles.update(userId, {
  streak_days: 7,
  avatar_emoji: "🌳",
  interests: ["climate_change", "water"],
});

// Update streak
await supabaseQueries.profiles.updateStreak(userId, 15);
```

### Get All Users by Role

```typescript
const students = await supabaseQueries.profiles.getByRole("student");
const teachers = await supabaseQueries.profiles.getByRole("teacher");
```

---

## 2. MISSIONS

### Get All Active Missions

```typescript
const missions = await supabaseQueries.missions.getAll();

// Result: [{ id, title, description, category, difficulty, ... }, ...]
```

### Get Mission by ID

```typescript
const mission = await supabaseQueries.missions.getById(missionId);

// Access steps if needed
const steps = await supabaseQueries.missionSteps.getByMissionId(missionId);
```

### Get Missions by Category

```typescript
const plantingMissions =
  await supabaseQueries.missions.getByCategory("planting");
const waterMissions = await supabaseQueries.missions.getByCategory("water");
```

### Create New Mission (Admin Only)

```typescript
const newMission = await supabaseQueries.missions.create({
  title: 'Clean Beach",
  description: 'Pick up litter at a local beach',
  category: 'biodiversity',
  difficulty: 'easy',
  eco_points_reward: 50,
  xp_reward: 25,
  requires_photo: true,
  requires_location: false,
  requires_teacher_approval: false,
  icon_url: '🏖️',
  steps: [
    'Find a beach location',
    'Gather trash and recyclables',
    'Properly dispose of collected waste',
    'Take a before/after photo'
  ],
  is_active: true
});
```

---

## 3. MISSION STEPS (Step System)

### Get All Steps for a Mission

```typescript
const steps = await supabaseQueries.missionSteps.getByMissionId(missionId);

// Result: [
//   {
//     id, mission_id, step_number, title, description,
//     has_checkpoint, checkpoint_type, checkpoint_requirement
//   },
//   ...
// ]

// Iterate through steps
steps.forEach((step, i) => {
  console.log(`Step ${i + 1}: ${step.title}`);
  if (step.has_checkpoint) {
    console.log(`  Requires: ${step.checkpoint_type} proof`);
  }
});
```

### Get Single Step

```typescript
const step = await supabaseQueries.missionSteps.getById(stepId);
```

### Create Steps for a Mission (Admin)

```typescript
// Usually done in bulk when creating mission
const steps = [
  {
    mission_id: missionId,
    step_number: 1,
    title: "Choose Location",
    description: "Select a beach in your area",
    instructions: "Use Google Maps to find a nearby beach...",
    has_checkpoint: false,
  },
  {
    mission_id: missionId,
    step_number: 2,
    title: "Collect Trash",
    description: "Spend 30 minutes picking up litter",
    instructions: "Use gloves and bags provided...",
    has_checkpoint: true,
    checkpoint_type: "photo",
    checkpoint_requirement: "Photo showing collected trash",
  },
  {
    mission_id: missionId,
    step_number: 3,
    title: "Submit Evidence",
    description: "Take final photo with beach location",
    instructions: "Pose with the cleaned area...",
    has_checkpoint: true,
    checkpoint_type: "location",
    checkpoint_requirement: "Geolocation data of beach",
  },
];

for (const step of steps) {
  await supabaseQueries.missionSteps.create(step);
}
```

---

## 4. MISSION SUBMISSIONS

### Start/Accept a Mission

```typescript
const submission = await supabaseQueries.missionSubmissions.create({
  user_id: userId,
  mission_id: missionId,
  status: "in_progress",
  current_step: 0,
});

// submission.id is needed for submitting steps
```

### Get User's Mission Submissions

```typescript
const submissions =
  await supabaseQueries.missionSubmissions.getUserSubmissions(userId);

// Filter by status
const pending = submissions.filter((s) => s.status === "pending");
const approved = submissions.filter((s) => s.status === "approved");
const inProgress = submissions.filter((s) => s.status === "in_progress");
```

### Submit Mission Proof (Old Way - Still Works)

```typescript
// For simple missions without steps
await supabaseQueries.missionSubmissions.submitProof(
  submissionId,
  photoUrl, // URL to uploaded photo
  notes, // Optional comments
  { lat: 37.7749, lng: -122.4194 }, // Optional coordinates
);

// Result: Status changes to 'pending', awaiting teacher review
```

### Teacher Approves/Rejects Mission

```typescript
// Approve
await supabaseQueries.missionSubmissions.approveSubmission(
  submissionId,
  teacherId,
  "Great work! Well done.", // feedback
);

// Reject
await supabaseQueries.missionSubmissions.rejectSubmission(
  submissionId,
  teacherId,
  "Please include more clear evidence of tree planting.",
);
```

---

## 5. MISSION STEP SUBMISSIONS (New Step System)

### Submit a Step

```typescript
// User completes step and provides checkpoint evidence
const stepSubmission = await supabaseQueries.missionStepSubmissions.submitStep(
  missionSubmissionId,
  stepId,
  {
    // Checkpoint data varies by type
    photo_url: "https://storage.supabase.co/...", // if checkpoint_type='photo'
    latitude: 37.7749, // if checkpoint_type='location'
    longitude: -122.4194,
    text_input: "Saw 5 butterfly species", // if checkpoint_type='text'
  },
);

// Result: { status: 'pending', submitted_at: now, ... }
```

### Get All Step Submissions for a Mission

```typescript
const stepSubmissions =
  await supabaseQueries.missionStepSubmissions.getByMissionSubmission(
    missionSubmissionId,
  );

// Check progress
stepSubmissions.forEach((ss: any) => {
  console.log(`Step ${ss.mission_steps.step_number}: ${ss.status}`);
});
```

### Teacher Verifies a Step

```typescript
await supabaseQueries.missionStepSubmissions.verifyStep(
  stepSubmissionId,
  teacherId,
  "Perfect! Clear evidence of tree planting.", // optional notes
);

// Result: Status='verified', student can proceed to next step
```

### Teacher Rejects a Step

```typescript
await supabaseQueries.missionStepSubmissions.rejectStep(
  stepSubmissionId,
  teacherId,
  "The tree is not clearly visible. Please retake photo with better lighting.",
);

// Result: Status='rejected', student notified, can resubmit
```

---

## 6. LESSONS

### Get All Lessons

```typescript
const allLessons = await supabaseQueries.lessons.getAll();
```

### Get Lessons by Topic

```typescript
const climateChangeLesson =
  await supabaseQueries.lessons.getByTopic("climate_change");

// Topics: 'climate_change', 'pollution', 'waste', 'energy', 'water', 'biodiversity'
```

### Get Single Lesson

```typescript
const lesson = await supabaseQueries.lessons.getById(lessonId);

// Access quiz questions
if (lesson.content_type === "quiz") {
  const questions = lesson.content_json.questions;
  questions.forEach((q: any) => {
    console.log(q.question);
    console.log(q.options);
  });
}
```

---

## 7. LESSON COMPLETIONS & QUIZ ATTEMPTS

### Mark Lesson as Complete

```typescript
await supabaseQueries.lessonCompletions.markComplete(userId, lessonId);

// Auto-awards eco_points from lesson
```

### Check User Completed Lessons

```typescript
const completedLessonIds =
  await supabaseQueries.lessonCompletions.getUserCompletions(userId);

// Use to calculate progress
const totalLessons = allLessons.length;
const completionRate = (completedLessonIds.length / totalLessons) * 100;
```

### Record Quiz Attempt

```typescript
const attempt = await supabaseQueries.quizAttempts.create({
  user_id: userId,
  lesson_id: lessonId,
  score: 8,
  total_questions: 10,
  answers_json: [
    { question_index: 0, selected_answer: 1 },
    { question_index: 1, selected_answer: 2 },
    // ...
  ],
});

// Score is (8/10) = 80%
```

### Get Quiz History

```typescript
const attempts = await supabaseQueries.quizAttempts.getUserAttempts(
  userId,
  lessonId,
);

// Get best score
const bestScore = Array.isArray(attempts)
  ? Math.max(...attempts.map((a: any) => a.score))
  : 0;
```

---

## 8. BADGES

### Get All Available Badges

```typescript
const badges = await supabaseQueries.badges.getAll();

// Check triggers
badges.forEach((badge: any) => {
  console.log(`${badge.name}: ${badge.trigger_type}`);
  // e.g., "First Steps: missions_completed"
});
```

### Get User's Earned Badges

```typescript
const userBadges = await supabaseQueries.badges.getUserBadges(userId);

// Returns: [{ id, name, icon, ... }, ...]
```

### Award Badge to User (Automatic or Manual)

```typescript
// Manually award badge (trigger achievement)
await supabaseQueries.badges.awardBadge(userId, badgeId);

// Creates entry in user_badges table
// Should only call when trigger condition is met:
// - 1 mission completed → award 'First Steps'
// - 7-day streak → award 'On Fire'
// - 5 water missions → award 'Water Guardian'
```

---

## 9. NOTIFICATIONS

### Get User's Notifications

```typescript
const notifications =
  await supabaseQueries.notifications.getUserNotifications(userId);

// notifications sorted by most recent first
notifications.forEach((notif: any) => {
  console.log(`[${notif.type}] ${notif.title}: ${notif.body}`);
});
```

### Create Notification

```typescript
await supabaseQueries.notifications.create({
  user_id: userId,
  title: "Mission Approved! 🌿",
  body: 'Your "Plant a Tree" mission was approved. +100 EcoPoints!',
  type: "mission",
  related_mission_id: missionId,
});

// Types: 'mission', 'badge', 'streak', 'reward', 'challenge'
```

### Mark as Read

```typescript
// Mark single notification
await supabaseQueries.notifications.markAsRead(notificationId);

// Mark all as read
await supabaseQueries.notifications.markAllAsRead(userId);
```

---

## 10. LEADERBOARD

### Get Top 10 Users

```typescript
const topUsers = await supabaseQueries.leaderboard.getTopUsers(10);

// Result: [
//   { id, full_name, avatar_emoji, eco_points, school_name, rank: 1 },
//   ...
// ]
```

### Get User's Rank

```typescript
const userRank = await supabaseQueries.leaderboard.getRank(userId);

console.log(`You are ranked #${userRank} globally!`);
```

---

## 11. DAILY POINTS TRACKING

### Record Points for Today

```typescript
const today = new Date().toISOString().split("T")[0];
await supabaseQueries.dailyPoints.recordPoints(userId, 125, today);

// 125 points earned today
```

### Get Weekly Points (Last 7 Days)

```typescript
const weeklyData = await supabaseQueries.dailyPoints.getWeeklyPoints(userId);

// Result: [
//   { date: '2026-03-24', points_earned: 50 },
//   { date: '2026-03-25', points_earned: 125 },
//   ...
// ]

// Use for charts
const total = weeklyData.reduce((sum, d) => sum + d.points_earned, 0);
const avgPerDay = total / weeklyData.length;
```

---

## Complete Example: React Hook with Queries

```typescript
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabaseQueries } from "@/integrations/supabase/queries";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export function useMissionFlow() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Get available missions
  const missionsQuery = useQuery({
    queryKey: ["missions"],
    queryFn: () => supabaseQueries.missions.getAll(),
  });

  // Get user's submissions
  const submissionsQuery = useQuery({
    queryKey: ["submissions", user?.id],
    queryFn: () =>
      supabaseQueries.missionSubmissions.getUserSubmissions(user!.id),
    enabled: !!user,
  });

  // Accept mission mutation
  const acceptMission = useMutation({
    mutationFn: (missionId: string) =>
      supabaseQueries.missionSubmissions.create({
        user_id: user!.id,
        mission_id: missionId,
        status: "in_progress",
      }),
    onSuccess: () => {
      submissionsQuery.refetch();
      toast({ title: "Mission started! 🌿" });
    },
  });

  // Submit step mutation
  const submitStep = useMutation({
    mutationFn: ({ missionSubmissionId, stepId, checkpointData }: any) =>
      supabaseQueries.missionStepSubmissions.submitStep(
        missionSubmissionId,
        stepId,
        checkpointData,
      ),
    onSuccess: () => {
      submissionsQuery.refetch();
      toast({ title: "Step submitted for review!" });
    },
  });

  return {
    missions: missionsQuery.data || [],
    submissions: submissionsQuery.data || [],
    acceptMission,
    submitStep,
  };
}
```

---

## Error Handling Pattern

```typescript
try {
  const result = await supabaseQueries.missions.getByCategory("energy");
  // use result
} catch (error) {
  if (error instanceof Error) {
    console.error("Query failed:", error.message);
    // Handle specific errors:
    if (error.message.includes("PGRST")) {
      // Supabase PostgreSQL error
    } else if (error.message.includes("RLS violation")) {
      // Row Level Security policy blocked access
      toast({
        title: "Access Denied",
        description: "You do not have permission to access this data",
        variant: "destructive",
      });
    }
  }
}
```

---

## Performance Tips

1. **Use React Query properly**:

   ```typescript
   // Good - queries are cached and refetched intelligently
   const { data, isLoading } = useQuery({
     queryKey: ["missions"],
     queryFn: () => supabaseQueries.missions.getAll(),
   });

   // Bad - creates infinite loops
   // useEffect(() => {
   //   supabaseQueries.missions.getAll().then(...);
   // })
   ```

2. **Batch related queries**:

   ```typescript
   // Load mission + steps together
   const mission = await supabaseQueries.missions.getById(missionId);
   const steps = await supabaseQueries.missionSteps.getByMissionId(missionId);
   ```

3. **Invalidate queries after mutations**:
   ```typescript
   const mutation = useMutation({
     mutationFn: ...,
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['missions'] });
     }
   });
   ```

---

## Common Patterns

### Get Mission with all Data

```typescript
async function getMissionComplete(missionId: string) {
  const mission = await supabaseQueries.missions.getById(missionId);
  const steps = await supabaseQueries.missionSteps.getByMissionId(missionId);

  return { ...mission, steps };
}
```

### Complete a Mission (Student Flow)

```typescript
async function completeMission(missionId: string, userId: string) {
  // 1. Get/create submission
  let submission = submissions.find((s) => s.mission_id === missionId);
  if (!submission) {
    submission = await supabaseQueries.missionSubmissions.create({
      user_id: userId,
      mission_id: missionId,
      status: "in_progress",
    });
  }

  // 2. Get mission steps
  const steps = await supabaseQueries.missionSteps.getByMissionId(missionId);

  // 3. For each step, collect & submit evidence
  for (const step of steps) {
    // User provides checkpoint data
    await supabaseQueries.missionStepSubmissions.submitStep(
      submission.id,
      step.id,
      userProvidedCheckpoint,
    );
  }

  // 4. Mission auto-completes once all steps verified
}
```
