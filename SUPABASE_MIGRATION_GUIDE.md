# Supabase Migration Guide - EcoQuest Academy

## Overview

This guide walks you through migrating from localStorage to Supabase database for complete data persistence with proper authentication, RLS policies, and a new step-based mission system.

---

## Phase 1: Set Up Supabase Project

### 1.1 Create Supabase Account & Project

1. Go to https://supabase.com and sign up
2. Create a new project:
   - Organization: Your organization name
   - Project name: `ecoverse-academy` (or your preferred name)
   - Database password: Create a strong password
   - Region: Choose closest to your users
3. Wait for project initialization (2-3 minutes)

### 1.2 Get Your Credentials

In your Supabase dashboard:

1. Go to **Settings → API**
2. Copy these values and save them:
   - **Project URL**: `https://[project-id].supabase.co`
   - **Anon Public Key**: The public key (starts with `eyJ...`)
3. Go to **Settings → Auth → Configs**
4. Under Site URL, set to: `http://localhost:5173` (for dev) and your production URL

### 1.3 Update Environment Variables

Create `.env.local` in your project root:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://[your-project-id].supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ0eXA...your-public-key

# Optional: For Edge Functions
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJ0eXA...your-service-role-key (keep this secret!)
```

---

## Phase 2: Execute Database Migrations

### 2.1 Apply Schema

1. In Supabase Dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy the entire content from [supabase/migrations/20260330_create_full_schema.sql](../migrations/20260330_create_full_schema.sql)
4. Paste and click **Run**
5. Wait for completion (you'll see a success message)

### 2.2 Seed Initial Data

1. Click **New Query** again
2. Copy the content from [supabase/migrations/20260330_seed_data.sql](../migrations/20260330_seed_data.sql)
3. Paste and click **Run**

### 2.3 Verify Tables

Go to **SQL Editor → Table Editor** and verify:

- ✅ `profiles` table (10 rows from seed)
- ✅ `missions` table (10 missions with steps)
- ✅ `mission_steps` table (populated from missions)
- ✅ `mission_submissions` table (empty)
- ✅ `mission_step_submissions` table (empty)
- ✅ `lessons` table (7 lessons)
- ✅ `badges` table (12 badges)
- ✅ All other supporting tables

---

## Phase 3: Configure Supabase Auth

### 3.1 Enable Email/Password Auth

1. Go to **Authentication → Providers**
2. Click **Email** provider
3. Toggle **Enable Email provider** to ON
4. Configure:
   - **Confirm email required**: Toggle OFF (for development)
   - Keep other settings as default
5. Click **Save**

### 3.2 Create Auth Policies

1. Go to **SQL Editor → New Query**
2. Run this to enable auth-based row security:

```sql
-- Allow users to read their own profile
CREATE POLICY "Users can read own profile" ON public.profiles
FOR SELECT USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

-- Allow new user profile creation via trigger (see next section)
CREATE POLICY "Allow profile creation" ON public.profiles
FOR INSERT WITH CHECK (true);
```

### 3.3 Create Auth Trigger

This automatically creates a profile when a user signs up:

```sql
-- Create trigger function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    avatar_emoji,
    role,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.email,
    '🌱',
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## Phase 4: New Step System Implementation

### Overview

The new step system allows missions to be broken into sequential steps with checkpoints:

```
Mission
├── Step 1 (Checkpoint: Photo)
├── Step 2 (Checkpoint: Location)
├── Step 3 (Checkpoint: Text Input)
└── Step 4 (Checkpoint: None)
```

### 4.1 Mission Steps Structure

Each mission has multiple steps defined in the `mission_steps` table:

```typescript
interface MissionStep {
  id: UUID;
  mission_id: UUID;
  step_number: number; // 1, 2, 3, etc.
  title: string; // e.g., "Choose native species"
  description: string;
  instructions: string;
  has_checkpoint: boolean; // Whether this step needs verification
  checkpoint_type: "photo" | "location" | "text" | "checkbox" | null;
  checkpoint_requirement: string; // e.g., "Photo must show native tree"
}
```

### 4.2 Mission Step Submissions

Track each step's completion in `mission_step_submissions`:

```typescript
interface MissionStepSubmission {
  id: UUID;
  mission_submission_id: UUID; // Links to the user's mission submission
  step_id: UUID;
  status: "pending" | "verified" | "rejected";
  checkpoint_data: {
    // For photo checkpoint
    photo_url?: string;
    // For location checkpoint
    latitude?: number;
    longitude?: number;
    // For text checkpoint
    text_input?: string;
    // For checkbox checkpoint
    checked?: boolean;
  };
  submitted_at: Timestamp;
  verified_at?: Timestamp;
  verified_by?: UUID; // Teacher who verified
  verification_notes?: string;
}
```

### 4.3 Query Examples

```typescript
// Get all steps for a mission
const steps = await supabaseQueries.missionSteps.getByMissionId(missionId);

// Submit a step
await supabaseQueries.missionStepSubmissions.submitStep(submissionId, stepId, {
  photo_url: "https://...",
  checkpoint_type: "photo",
});

// Verify a step (Teacher approves)
await supabaseQueries.missionStepSubmissions.verifyStep(
  stepSubmissionId,
  teacherId,
  "Good photo, clear evidence of tree planting",
);

// Get all step submissions for a mission
const stepSubmissions =
  await supabaseQueries.missionStepSubmissions.getByMissionSubmission(
    submissionId,
  );
```

---

## Phase 5: Update React Hooks

### 5.1 Update useAuth Hook

Replace [src/hooks/useAuth.tsx](../hooks/useAuth.tsx):

```typescript
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { supabaseQueries } from '@/integrations/supabase/queries';

type AuthUser = {
  id: string;
  email: string;
};

interface AuthContextType {
  user: AuthUser | null;
  profile: any | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  updateProfile: (updates: any) => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email || '' });
        const userProfile = await supabaseQueries.profiles.getById(session.user.id);
        setProfile(userProfile);
      }

      setLoading(false);
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email || '' });
        const userProfile = await supabaseQueries.profiles.getById(session.user.id);
        setProfile(userProfile);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    });
    if (error) throw error;
    return data;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    setUser({ id: data.user.id, email: data.user.email || '' });
    const userProfile = await supabaseQueries.profiles.getById(data.user.id);
    setProfile(userProfile);

    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const updateProfile = async (updates: any) => {
    if (!user) throw new Error('Not authenticated');
    const updated = await supabaseQueries.profiles.update(user.id, updates);
    setProfile(updated);
    return updated;
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
```

### 5.2 Update useDashboardData Hook

Replace [src/hooks/useDashboardData.ts](../hooks/useDashboardData.ts):

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseQueries } from "@/integrations/supabase/queries";
import { useAuth } from "./useAuth";

export function useDashboardData() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const rankQuery = useQuery({
    queryKey: ["rank", user?.id],
    queryFn: async () => {
      if (!user) return 999;
      return await supabaseQueries.leaderboard.getRank(user.id);
    },
    enabled: !!user,
  });

  const leaderboardQuery = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => supabaseQueries.leaderboard.getTopUsers(5),
    enabled: !!user,
  });

  const missionsQuery = useQuery({
    queryKey: ["dashboard-missions"],
    queryFn: () => supabaseQueries.missions.getAll().then((m) => m.slice(0, 3)),
    enabled: !!user,
  });

  const submissionsQuery = useQuery({
    queryKey: ["submissions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      return await supabaseQueries.missionSubmissions.getUserSubmissions(
        user.id,
      );
    },
    enabled: !!user,
  });

  const weeklyQuery = useQuery({
    queryKey: ["weekly-points", user?.id],
    queryFn: async () => {
      if (!user) return [];
      return await supabaseQueries.dailyPoints.getWeeklyPoints(user.id);
    },
    enabled: !!user,
  });

  const submitProof = useMutation({
    mutationFn: async ({ submissionId, photoUrl, notes, coords }: any) => {
      return await supabaseQueries.missionSubmissions.submitProof(
        submissionId,
        photoUrl,
        notes,
        coords,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
  });

  return {
    rank: rankQuery.data,
    leaderboard: leaderboardQuery.data,
    missions: missionsQuery.data,
    submissions: submissionsQuery.data,
    weeklyPoints: weeklyQuery.data,
    submitProof,
    isLoading: rankQuery.isLoading || leaderboardQuery.isLoading,
  };
}
```

### 5.3 Create useMissionSteps Hook (NEW)

Create [src/hooks/useMissionSteps.ts](../hooks/useMissionSteps.ts):

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseQueries } from "@/integrations/supabase/queries";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";

export function useMissionSteps(missionId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get all steps for a mission
  const stepsQuery = useQuery({
    queryKey: ["mission-steps", missionId],
    queryFn: () => supabaseQueries.missionSteps.getByMissionId(missionId!),
    enabled: !!missionId,
  });

  // Get step submissions for a user submission
  const stepSubmissionsQuery = useQuery({
    queryKey: ["step-submissions", missionId],
    queryFn: async () => {
      if (!missionId) return [];
      const submissions =
        await supabaseQueries.missionSubmissions.getUserSubmissions(user!.id);
      const submission = submissions.find((s) => s.mission_id === missionId);
      if (!submission) return [];
      return await supabaseQueries.missionStepSubmissions.getByMissionSubmission(
        submission.id,
      );
    },
    enabled: !!user && !!missionId,
  });

  const submitStep = useMutation({
    mutationFn: async ({
      missionSubmissionId,
      stepId,
      checkpointData,
      stepNumber,
    }: any) => {
      return await supabaseQueries.missionStepSubmissions.submitStep(
        missionSubmissionId,
        stepId,
        checkpointData,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["step-submissions"] });
      toast({ title: "Step submitted! Awaiting verification..." });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const verifyStep = useMutation({
    mutationFn: async ({ stepSubmissionId, notes }: any) => {
      return await supabaseQueries.missionStepSubmissions.verifyStep(
        stepSubmissionId,
        user!.id,
        notes,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["step-submissions"] });
      toast({ title: "Step verified! ✅" });
    },
  });

  return {
    steps: stepsQuery.data || [],
    stepSubmissions: stepSubmissionsQuery.data || [],
    submitStep,
    verifyStep,
    isLoading: stepsQuery.isLoading || stepSubmissionsQuery.isLoading,
  };
}
```

---

## Phase 6: Remove localStorage Usage

### 6.1 Files to Update/Remove

1. **Remove entirely**: `src/lib/localStore.ts` (no longer needed)
2. **Update**: Any component importing from localStore
3. **Update**: `src/pages/AuthPages.tsx` (remove localStorage auth fallback)

### 6.2 Find and Replace

Use this search in your project to find remaining localStore usage:

```bash
grep -r "localStore\|localStorage" src/ --include="*.tsx" --include="*.ts"
```

Replace all occurrences with Supabase queries:

- `localStore.getAll('missions')` → `supabaseQueries.missions.getAll()`
- `localStore.insert('missions', data)` → `supabaseQueries.missions.create(data)`
- `localStore.query('mission_submissions', ...)` → `supabaseQueries.missionSubmissions.getUserSubmissions(userId)`

---

## Phase 7: Testing

### 7.1 Test Auth Flow

```bash
npm run dev
```

1. Visit http://localhost:5173
2. Click **Sign Up**
3. Create account with:
   - Email: `test@example.com`
   - Password: `TestPassword123!`
   - Full Name: `Test User`
4. Verify profile created in Supabase
5. Login works as expected

### 7.2 Test Missions

1. In dashboard, try to accept a mission
2. Check `mission_submissions` table in Supabase
3. Verify status updates work

### 7.3 Test Step System

1. In a mission, complete step 1 with photo
2. Check `mission_step_submissions` table
3. Verify step is in "pending" status
4. (As teacher) Go to submissions page and verify the step
5. Check that status changed to "verified"

### 7.4 Test Real-time Updates

1. Open Supabase dashboard realtime editor
2. Submit a step in the app
3. Watch real-time updates in Supabase console

---

## Phase 8: Production Deployment

### 8.1 Environment Variables (.env.production)

Set these in your deployment platform:

```env
VITE_SUPABASE_URL=https://[project-id].supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-public-key
```

### 8.2 Database Backups

In Supabase dashboard, go to **Settings → Backups**:

- Enable daily backups
- Set retention to 30 days (or per your requirement)

### 8.3 RLS Reality Checks

Test RLS restrictiveness:

1. Create a test user
2. Try to read other users' submissions (should fail)
3. Try to modify other users' profile (should fail)
4. Try to teacher actions as student (should fail)

---

## Step System Workflow

### Student Perspective

```
1. Student starts mission
   ↓
2. Views step 1 instructions
   ↓
3. Completes step 1 & submits checkpoint (e.g., photo)
   ↓
4. Step status = "pending" (awaiting teacher review)
   ↓
5. Teacher reviews step 1
   ├─ If Approved: Status = "verified", unlock step 2
   └─ If Rejected: Status = "rejected", student retries
   ↓
6. Repeat for steps 2, 3, 4...
   ↓
7. All steps verified → Mission status = "approved"
   ↓
8. Student receives eco_points reward
```

### Teacher Perspective

```
1. Teacher opens Submissions page
2. Sees missions awaiting review (status = "pending")
3. For each step submission:
   - View checkpoint data (photo, location, text, etc.)
   - Verify quality/compliance
   - Click "Verify" (status = "verified")
   - Or Click "Reject" with feedback (status = "rejected")
4. Once all steps verified, mission auto-approves
5. Student notified of approval
```

---

## Troubleshooting

### Issue: "connect EACCEStablishment failed"

**Solution**: Check Supabase URL and key in `.env.local`

### Issue: RLS policies block all queries

Run this debug query in Supabase:

```sql
SELECT * FROM auth.jwt() LIMIT 1;
```

Should return your auth token. If empty, RLS is blocking.

### Issue: Step submissions not saving

Check Network tab in browser DevTools:

- Look for failing POST requests
- Check Supabase logs for error details

### Issue: Photos not uploading

Enable Supabase Storage first:

1. Go to **Storage** in Supabase
2. Create bucket: `mission-photos`
3. Make public: Click bucket → Policies → Add policy for public read

---

## Next Steps

1. ✅ Complete Phase 1-7 above
2. Update other hooks similarly (useLearnData, useProfileData, etc.)
3. Deploy to production
4. Monitor Supabase metrics dashboard
5. Set up email notifications (Supabase Emails)
6. Create admin dashboard for managing missions

---

## Support & Resources

- **Supabase Docs**: https://supabase.com/docs
- **React Query Docs**: https://tanstack.com/query/latest
- **Step System Examples**: See `/src/components/MissionStepViewer.tsx` (coming soon)
