# System Architecture Overview

## Component & Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                       FRONTEND (React)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Pages (src/pages/)                                            │
│  ├── MissionsPage                                              │
│  ├── DashboardPage                                             │
│  ├── ProfilePage                                               │
│  ├── LeaderboardPage                                           │
│  ├── teacher/StepReviewPage (NEW)                             │
│  └── ...                                                       │
│                                                                 │
│         │ Uses │                                                │
│         ▼                                                       │
│  ┌─────────────────┐                                            │
│  │ Components      │                                            │
│  ├─────────────────┤                                            │
│  │ MissionStepViewer (NEW) ──┐                                │
│  │ TeacherStepReview (NEW)   │                                │
│  │ ProofSubmissionSheet      │                                │
│  │ NavLink                   │                                │
│  │ ...                       │                                │
│  └─────────────────┘         │                                │
│         │ Uses │             │                                │
│         ▼                    │                                │
│  ┌──────────────────────────────────┐                          │
│  │ Hooks (React Query)              │                          │
│  ├──────────────────────────────────┤                          │
│  │ useAuth (authentication & user)  │                          │
│  │ useMissionProgress (NEW)         │                          │
│  │ useDashboardData                 │                          │
│  │ useLearnData                     │                          │
│  │ useLeaderboardData               │                          │
│  │ useProfileData                   │                          │
│  │ useTeacherData                   │                          │
│  └──────────────────────────────────┘                          │
│         │ Calls │                                               │
│         ▼                                                       │
│  ┌─────────────────────────────────────────┐                   │
│  │ Query Layer                             │                   │
│  ├─────────────────────────────────────────┤                   │
│  │ supabaseQueries (60+ methods)           │                   │
│  │  ├── profiles.getById(), addEcoPoints() │                   │
│  │  ├── missions.getAll(), getById()       │                   │
│  │  ├── missionSteps.getByMissionId()      │                   │
│  │  ├── missionSubmissions.create()        │                   │
│  │  ├── missionStepSubmissions.submitStep()│                   │
│  │  ├── missionStepSubmissions.verifyStep()│                   │
│  │  ├── lessons.getAll(), markComplete() │                   │
│  │  ├── badges.getByUser(), awardBadge()  │                   │
│  │  ├── leaderboard.getTop()               │                   │
│  │  └── ...                                │                   │
│  └──────────────────┬──────────────────────┘                   │
│                     │ Calls                                     │
│                     ▼                                           │
│  ┌─────────────────────────────────────────┐                   │
│  │ Supabase Client (JS SDK)                │                   │
│  └──────────────────┬──────────────────────┘                   │
│                     │                                          │
└─────────────────────┼──────────────────────────────────────────┘
                      │ HTTPS API
                      │
┌─────────────────────┼──────────────────────────────────────────┐
│                     ▼                                          │
│         BACKEND (Supabase / PostgreSQL)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Database (14 Tables)                                     │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                                                          │  │
│  │ Core Tables:                                            │  │
│  │ ├── schools                                             │  │
│  │ ├── profiles (extends auth.users)                       │  │
│  │ ├── missions                                            │  │
│  │ ├── mission_steps ◄──┐                                  │  │
│  │ ├── mission_submissions                                 │  │
│  │ └── mission_step_submissions ◄─┐ (NEW - tracks steps) │  │
│  │                                 │                      │  │
│  │ Curriculum Tables:              │                      │  │
│  │ ├── lessons                     │                      │  │
│  │ ├── lesson_completions          │                      │  │
│  │ └── quiz_attempts               │                      │  │
│  │                                 │                      │  │
│  │ Gamification Tables:            │                      │  │
│  │ ├── badges                      │                      │  │
│  │ ├── user_badges                 │                      │  │
│  │ ├── daily_points                │                      │  │
│  │ └── notifications               │                      │  │
│  │                                                          │  │
│  │ Relationships:                                          │  │
│  │ missions (1) ──┐                                        │  │
│  │       └──► (N) mission_steps                            │  │
│  │       └──► (N) mission_submissions                      │  │
│  │                    └──► (N) mission_step_submissions ─┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Authentication (Supabase Auth)                           │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ auth.users (email/password signup & login)              │  │
│  │ JWT tokens for API requests                             │  │
│  │ Row-Level Security (RLS) policies                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Storage (Optional - for photos)                         │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ mission-photos bucket (student checkpoint images)       │  │
│  │ lesson-content bucket (curriculum media)                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Real-time Subscriptions (Optional - future)             │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ mission_step_submissions changes                         │  │
│  │ notifications creations                                 │  │
│  │ leaderboard updates                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Step System Data Flow

```
                         STUDENT JOURNEY
                              │
                              ▼
                    ┌──────────────────┐
                    │ Start Mission    │
                    └────────┬─────────┘
                             │
          ┌──────────────────┴──────────────────┐
          ▼                                     ▼
   ┌──────────────────┐            ┌──────────────────┐
   │ mission_       │            │ mission_step_   │
   │ submissions    │            │ submissions [1] │
   │ [created]      │            │ [pending]       │
   │                │            │                │
   │ status: in_    │            │ checkpoint_data │
   │ progress       │            │ {photo_url}    │
   └────────┬────────┘            └────────┬────────┘
            │                              │
            │ Student completes step 1    │ Student waits
            │ with photo                  │ for review
            │                              │
            ▼                              ▼
            │                    ┌──────────────────┐
            │                    │ TEACHER REVIEWS  │
            │                    └────────┬─────────┘
            │                             │
            │             ┌───────────────┼──────────────┐
            │             ▼               ▼              ▼
            │      ┌──────────┐     ┌──────────┐   ┌──────────┐
            │      │ Approve  │ or  │ Reject   │   │ Request  │
            │      │          │     │          │   │ revision │
            │      └────┬─────┘     └────┬─────┘   └────┬─────┘
            │           │                │              │
            ▼           ▼                ▼              ▼
      ┌──────────────────────────────────────────────────┐
      │ mission_step_submissions                         │
      │ [status: verified / rejected / revision_needed]  │
      │ [verified_by: teacher_id]                        │
      │ [verified_at: timestamp]                         │
      │ [feedback: "Great photo!"]                       │
      └──────────────┬─────────────────────────────────┘
                     │
        ┌────────────┴──────────────┐
        │ Verified?                 │
        ▼                           ▼
   ┌─────────────┐            ┌──────────────┐
   │ mission_    │            │ Notify       │
   │ submissions │            │ student to   │
   │ [step 1 ✅] │            │ revise       │
   │ current_    │            └──────┬───────┘
   │ step: 2     │                   │
   └────┬────────┘         ┌─────────┴────────┐
        │                  ▼                  ▼
        │            Student revises &   Accept?
        │            resubmits            │
        │                                  ▼
        └──────────────────────────────────────┐
                                           │
              Are all steps verified?      ▼
              │                    ┌──────────────┐
              ├─ NO ────────────► │ Step 2        │
              │                   │ checkpoint... │
              └─ YES ──────────┐  └──────────────┘
                               │
                               ▼
                    ┌──────────────────┐
                    │ mission_         │
                    │ submissions      │
                    │ status: APPROVED │
                    │ completed_steps: │
                    │ [1,2,3,4,5,6]   │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ Eco Points       │
                    │ Awarded! +100    │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ Leaderboard      │
                    │ Updated          │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ Badges Checked   │
                    │ Any triggered?   │
                    └─────────────────┘
```

---

## File Size Reference

```
BACKEND INFRASTRUCTURE
├── supabase/migrations/
│   ├── 20260330_create_full_schema.sql       (~400 lines)
│   └── 20260330_seed_data.sql                (~150 lines)
│
QUERY LAYER & TYPES
├── src/integrations/supabase/
│   ├── types.ts                              (~800 lines)
│   ├── queries.ts                   (★ NEW)  (~400 lines)
│   └── client.ts                             (~50 lines)
│
UI COMPONENTS
├── src/components/
│   ├── MissionStepViewer.tsx        (★ NEW)  (~300 lines)
│   ├── TeacherStepReview.tsx        (★ NEW)  (~200 lines)
│   ├── ProofSubmissionSheet.tsx              (~150 lines)
│   ├── ProtectedRoute.tsx                    (~50 lines)
│   └── index.ts                              (~40 lines)
│
REACT HOOKS
├── src/hooks/
│   ├── useAuth.tsx                  (UPDATE) (~150 lines)
│   ├── useMissionProgress.ts        (★ NEW)  (~100 lines)
│   ├── useDashboardData.ts          (UPDATE) (~100 lines)
│   ├── useLearnData.ts              (UPDATE) (~80 lines)
│   ├── useLeaderboardData.ts        (UPDATE) (~70 lines)
│   ├── useProfileData.ts            (UPDATE) (~60 lines)
│   ├── useTeacherData.ts            (UPDATE) (~80 lines)
│   ├── use-toast.ts                          (~50 lines)
│   ├── use-mobile.tsx                        (~30 lines)
│   └── index.ts                              (~20 lines)
│
DOCUMENTATION
├── DELIVERY_SUMMARY.md              (★ NEW)  (~500 lines) ◄ START HERE
├── SUPABASE_MIGRATION_GUIDE.md      (★ NEW)  (~600 lines) ◄ MAIN GUIDE
├── SUPABASE_QUERY_REFERENCE.md      (★ NEW)  (~800 lines) ◄ REFERENCE
├── STEP_SYSTEM_IMPLEMENTATION.md    (★ NEW)  (~600 lines) ◄ EXAMPLES
├── MIGRATION_COMPLETE.md            (★ NEW)  (~400 lines)
├── QUICK_REFERENCE.md               (★ NEW)  (~600 lines)
│
UTILITIES
├── verify-setup.js                  (★ NEW)  (~200 lines)
└── package.json                              (dependencies OK)

TOTAL NEW/UPDATED FILES: 30+
TOTAL LINES OF CODE: 3,500+
TOTAL DOCUMENTATION: 2,400+ lines
```

---

## Import Examples

```typescript
// ✅ AFTER MIGRATION - Clean Imports

import { useAuth } from '@/hooks/useAuth';
import { useMissionProgress } from '@/hooks/useMissionProgress';
import { MissionStepViewer, TeacherStepReview } from '@/components';
import { supabaseQueries } from '@/integrations/supabase/queries';

// Get mission progress
const { progressPercentage, isComplete, steps } = useMissionProgress(missionId);

// Get all missions
const missions = await supabaseQueries.missions.getAll();

// Submit a step
await supabaseQueries.missionStepSubmissions.submitStep(
  submissionId, stepId, { photo_url: imageUrl }
);

// Render step viewer
<MissionStepViewer missionId="123" submissionId="456" />
```

---

## Query Organization (60+ Methods)

```
supabaseQueries
├── profiles
│   ├── getById(userId)
│   ├── update(userId, data)
│   ├── addEcoPoints(userId, points)
│   ├── updateStreak(userId)
│   └── ... (8 methods total)
│
├── missions
│   ├── getAll()
│   ├── getById(id)
│   ├── getByCategory(category)
│   ├── create(data)
│   └── ... (4 methods total)
│
├── missionSteps
│   ├── getByMissionId(missionId)
│   ├── getById(id)
│   ├── create(data)
│   └── ... (3 methods total)
│
├── missionSubmissions
│   ├── create(data)
│   ├── getById(id)
│   ├── getUserSubmissions(userId)
│   ├── getByStatus(status)
│   └── ... (5 methods total)
│
├── missionStepSubmissions ◄━━ NEW STEP TRACKING
│   ├── submitStep(submissionId, stepId, data)
│   ├── getByMissionSubmission(submissionId)
│   ├── verifyStep(stepId, teacherId, notes)
│   └── ... (4 methods total)
│
├── lessons
│   ├── getAll()
│   ├── getById(id)
│   ├── getByTopic(topic)
│   └── ... (4 methods total)
│
├── badges
│   ├── getAll()
│   ├── getByUser(userId)
│   ├── awardBadge(userId, badgeId)
│   └── ... (4 methods total)
│
├── leaderboard
│   ├── getTop(limit)
│   ├── getBySchool(schoolId, limit)
│   └── ... (2 methods total)
│
└── ... (notifications, daily_points, quizzes)
```

---

## Environment Setup

```
.env.local (CREATE THIS)
├── VITE_SUPABASE_URL          ← Your project URL
└── VITE_SUPABASE_ANON_KEY     ← Public anon key

.gitignore (ALREADY HAS)
├── .env.local
└── .env.*.local
```

---

## Next Steps Visualization

```
START HERE
   │
   ▼ Read DELIVERY_SUMMARY.md
   │
   ▼ Run verify-setup.js
   │
   ▼ Create Supabase Account
   │
   ▼ Follow 8 PHASES
   │
   ├── Phase 1: Create project    (15 min)  → SUPABASE_MIGRATION_GUIDE.md
   ├── Phase 2: Run migrations    (10 min)  → Execute SQL
   ├── Phase 3: Configure auth    (20 min)  → Email/password setup
   ├── Phase 4: Step explanation  (ref)     → STEP_SYSTEM_IMPLEMENTATION.md
   ├── Phase 5: Update hooks      (30 min)  → SUPABASE_QUERY_REFERENCE.md
   ├── Phase 6: Integrate components(20 min) → Code examples
   ├── Phase 7: Test              (30 min)  → Verification checklist
   └── Phase 8: Deploy            (varies)  → Production deployment
   │
   ▼ Done! 🎉

ESTIMATED TOTAL TIME: 3-4 hours over several days
```

---

This architecture provides:

- ✅ Clean separation of concerns
- ✅ Type-safe database operations
- ✅ Scalable query layer
- ✅ Reusable React components
- ✅ Real-time capable (future)
- ✅ Row-Level Security built-in
- ✅ Multi-user support
- ✅ Production-ready design
