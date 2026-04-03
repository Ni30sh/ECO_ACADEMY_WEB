# Quick Reference Guide

## 📋 File Location Index

### Step System Components

```
src/components/
├── MissionStepViewer.tsx       ← Student sees all steps with timeline
├── TeacherStepReview.tsx       ← Teacher approves/rejects steps
└── index.ts                    ← Export all components
```

### Query Layer (Database)

```
src/integrations/supabase/
├── types.ts                    ← TypeScript definitions for all tables
├── queries.ts                  ← 60+ query methods (see REFERENCE)
└── client.ts                   ← Supabase client setup
```

### Hooks (Data Fetching)

```
src/hooks/
├── useAuth.tsx                 ← Authentication (needs update to Supabase)
├── useMissionProgress.ts       ← NEW: Mission step tracking
├── useDashboardData.ts         ← Dashboard stats (needs Supabase update)
├── useLearnData.ts             ← Lessons/quizzes (needs Supabase update)
├── useLeaderboardData.ts       ← Top students (needs Supabase update)
├── useProfileData.ts           ← User profile (needs Supabase update)
├── useTeacherData.ts           ← Teacher tools (needs Supabase update)
└── index.ts                    ← Export all hooks
```

### Pages That Need Updates

```
src/pages/
├── MissionsPage.tsx            ← Add MissionStepViewer to detail view
├── DashboardPage.tsx           ← Use new activity hooks
├── ProfilePage.tsx             ← Use Supabase profile data
├── LeaderboardPage.tsx         ← Use Supabase leaderboard
├── LessonReader.tsx            ← Use Supabase lessons
├── QuizExperience.tsx          ← Use Supabase quiz data
└── teacher/
    ├── TeacherDashboard.tsx    ← Link to new review page
    └── StepReviewPage.tsx      ← NEW: Teacher step verification
```

### Database Migrations

```
supabase/migrations/
├── 20260330_create_full_schema.sql  ← 14 tables, RLS policies
└── 20260330_seed_data.sql           ← 10 missions with steps
```

### Documentation Files (Root)

```
/
├── SUPABASE_MIGRATION_GUIDE.md       ← 8-phase implementation guide
├── SUPABASE_QUERY_REFERENCE.md       ← 60+ query examples
├── MIGRATION_COMPLETE.md             ← What's done, what's next
└── STEP_SYSTEM_IMPLEMENTATION.md     ← Page integration examples
```

---

## 🚀 Fastest Implementation Path

### Day 1: Setup (1 hour)

```typescript
// 1. Create .env.local
VITE_SUPABASE_URL=https://[ID].supabase.co
VITE_SUPABASE_ANON_KEY=[KEY]

// 2. Run migrations in Supabase dashboard
// Copy/paste from: supabase/migrations/20260330_create_full_schema.sql
// Copy/paste from: supabase/migrations/20260330_seed_data.sql

// 3. Test connection
npm run dev  // Should start without errors

// 4. Test in browser: Check localStorage vs Supabase (optional console test)
```

### Day 2: Authentication (1 hour)

```typescript
// Update useAuth.tsx with Supabase Auth
// Copy template from: SUPABASE_MIGRATION_GUIDE.md → Phase 5.1
// Test signup/login at /auth page
```

### Day 3: Data Hooks (2 hours)

```typescript
// Update each hook to use queries instead of localStorage
// Copy examples from: SUPABASE_QUERY_REFERENCE.md → Section 8

// Files to update:
-src / hooks / useDashboardData.ts -
  src / hooks / useLearnData.ts -
  src / hooks / useLeaderboardData.ts -
  src / hooks / useProfileData.ts -
  src / hooks / useTeacherData.ts;
```

### Day 4: Components & Testing (2 hours)

```typescript
// 1. Add MissionStepViewer to MissionsPage
// 2. Add TeacherStepReview to new review page
// 3. Remove localStorage calls
// 4. Test full flow: signup → mission → step submission → teacher review
```

### Day 5: Deploy (30 min)

```bash
# Add environment variables to deployment platform (Vercel, Netlify, etc.)
# Deploy!
```

---

## 🔄 Migration Checklist By File

### ✅ Already Created

- [x] src/integrations/supabase/types.ts (TYPE DEFINITIONS)
- [x] src/integrations/supabase/queries.ts (QUERY LAYER)
- [x] src/components/MissionStepViewer.tsx (UI)
- [x] src/components/TeacherStepReview.tsx (UI)
- [x] src/hooks/useMissionProgress.ts (HOOK)
- [x] supabase/migrations/20260330_create_full_schema.sql (DB)
- [x] supabase/migrations/20260330_seed_data.sql (DB)

### 🟡 Needs User Implementation

- [ ] src/hooks/useAuth.tsx (AWAITING: User to apply template)
- [ ] src/hooks/useDashboardData.ts (AWAITING: User to migrate to queries)
- [ ] src/hooks/useLearnData.ts (AWAITING: User to migrate to queries)
- [ ] src/hooks/useLeaderboardData.ts (AWAITING: User to migrate to queries)
- [ ] src/hooks/useProfileData.ts (AWAITING: User to migrate to queries)
- [ ] src/hooks/useTeacherData.ts (AWAITING: User to migrate to queries)
- [ ] src/pages/MissionsPage.tsx (COMMENT: Add MissionStepViewer)
- [ ] src/pages/DashboardPage.tsx (COMMENT: Remove localStorage calls)
- [ ] src/pages/ProfilePage.tsx (COMMENT: Use Supabase profile)
- [ ] src/pages/LeaderboardPage.tsx (COMMENT: Use Supabase leaderboard)
- [ ] src/pages/teacher/[new] StepReviewPage.tsx (COMMENT: Add teacher review)
- [ ] .env.local (CRITICAL: Add Supabase credentials)

### 📝 Documentation Reference

**Read These In Order**:

1. → SUPABASE_MIGRATION_GUIDE.md (understand 8 phases)
2. → STEP_SYSTEM_IMPLEMENTATION.md (see examples)
3. → SUPABASE_QUERY_REFERENCE.md (copy/paste queries)
4. → MIGRATION_COMPLETE.md (track progress)

---

## 💡 Common Patterns

### Pattern 1: Fetch User Data

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabaseQueries } from '@/integrations/supabase/queries';
import { useAuth } from '@/hooks/useAuth';

function MyComponent() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => supabaseQueries.profiles.getById(user!.id),
    enabled: !!user
  });

  return <div>{profile?.full_name}</div>;
}
```

### Pattern 2: Create or Update

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseQueries } from '@/integrations/supabase/queries';

function MyComponent() {
  const queryClient = useQueryClient();

  const createMission = useMutation({
    mutationFn: (data) => supabaseQueries.missions.create(data),
    onSuccess: () => {
      // Refetch missions after creating
      queryClient.invalidateQueries({ queryKey: ['missions'] });
    }
  });

  return (
    <button onClick={() => createMission.mutate({ title: 'New Mission' })}>
      Create
    </button>
  );
}
```

### Pattern 3: Listen to Real-Time Changes (Advanced)

```typescript
// Optional: Subscribe to real-time updates
useEffect(() => {
  const channel = supabase
    .channel("public:mission_submissions")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "mission_submissions" },
      (payload) => {
        console.log("Mission updated:", payload);
        // Refetch or update UI
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

---

## 🐛 Debugging Tips

### Check That Database Is Connected

```typescript
// In browser console:
import { supabaseQueries } from "@/integrations/supabase/queries";
const missions = await supabaseQueries.missions.getAll();
console.log("Missions:", missions);
```

### Verify User Is Authenticated

```typescript
// In browser console:
import { useAuth } from "@/hooks/useAuth";
// Note: Cannot call hooks in console - use this in component instead
```

### Check Supabase Dashboard

- Go to https://app.supabase.com
- Select your project
- Click "Table Editor"
- Verify all 14 tables exist
- Check data in each table

### View Query Results

```typescript
// Add to any component to see live query data:
const {
  data: missions,
  isLoading,
  error,
} = useQuery({
  queryKey: ["missions"],
  queryFn: () => supabaseQueries.missions.getAll(),
});

console.log("Missions:", missions);
console.log("Loading:", isLoading);
console.log("Error:", error);
```

---

## 📞 Need Help?

1. **"How do I query X?"** → See SUPABASE_QUERY_REFERENCE.md
2. **"How do I implement X?"** → See STEP_SYSTEM_IMPLEMENTATION.md
3. **"What's the next step?"** → See SUPABASE_MIGRATION_GUIDE.md → Phase X
4. **"Did I miss anything?"** → See MIGRATION_COMPLETE.md → Checklist
5. **"Where is X code?"** → See this file (Quick Reference Guide)

---

## ⚡ Performance Checks

After migration, verify:

- [ ] Page load time < 2s (first meaningful paint)
- [ ] No redundant queries (check React Query Devtools)
- [ ] No localStorage calls in console (search for "localStorage")
- [ ] RLS policies working (try accessing another user's data - should fail)
- [ ] Images loading (Supabase Storage configured? Optional)

---

## 📊 Expected File Sizes After Migration

```
src/integrations/supabase/
  - types.ts           ~800 lines
  - queries.ts         ~400 lines
  - client.ts          ~50 lines

src/components/
  - MissionStepViewer.tsx         ~300 lines
  - TeacherStepReview.tsx         ~200 lines
  - [other files unchanged]

src/hooks/
  - useAuth.tsx        ~150 lines (UPDATE)
  - useMissionProgress.ts ~100 lines (NEW)
  - [other hooks ~50-100 lines each] (UPDATE)

supabase/migrations/
  - 20260330_create_full_schema.sql ~400 lines
  - 20260330_seed_data.sql          ~150 lines
```

---

## ✨ After Migration, You Can:

1. ✅ Add students from multiple schools
2. ✅ Track student progress step-by-step
3. ✅ Have teachers approve individual steps
4. ✅ Award eco-points automatically
5. ✅ Display real-time leaderboards
6. ✅ Send notifications for step updates
7. ✅ Build analytics on mission completion
8. ✅ Scale to hundreds/thousands of students
