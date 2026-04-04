# EcoQuest Academy

EcoQuest Academy is a role-based sustainability learning platform built with Vite, React, TypeScript, Tailwind CSS, shadcn/ui, and Supabase.

The web app in this repository focuses on teacher and administrator workflows:

- Teachers create missions, review student submissions, and award feedback or points.
- Administrators manage users, missions, submissions, analytics, and platform-level updates.
- Student activity is supported through the EcoQuest workflow and backend notifications, with review and approval handled by educators.

## Repository Links

- Teacher/Admin web app (this repository): https://github.com/Ni30sh/ECO_ACADEMY_WEB
- Student-side app: https://github.com/Ni30sh/ecoverse-student

## Features

- Role-based authentication and route protection
- Teacher dashboard with mission review and student management
- Admin dashboard with system analytics and moderation tools
- Supabase-backed authentication, data, and realtime updates
- Notification center for review and status updates
- Mission submission lifecycle with approve/reject flows
- Responsive UI built with Tailwind and shadcn/ui

## Tech Stack

- Vite
- React 18
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase
- TanStack React Query
- React Router
- Vitest

## Getting Started

### Prerequisites

- Node.js 18 or newer
- npm
- Supabase CLI if you want to run or push migrations locally

### Install

```sh
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
npm install
```

### Environment Variables

Create a `.env` file in the project root. A template is available in `.env.example`.

Required variables:

```sh
VITE_SUPABASE_PROJECT_ID="your_supabase_project_id"
VITE_SUPABASE_PUBLISHABLE_KEY="your_supabase_publishable_key"
VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
VITE_SUPABASE_ANON_KEY="your_supabase_anon_key"
OPENAI_API_KEY="your_openai_api_key"
 - for ai generated quiz
```

### Run Locally

```sh
npm run dev
```

Open the local Vite URL shown in the terminal.

## Available Scripts

- `npm run dev` - start the development server
- `npm run build` - create a production build
- `npm run build:dev` - build in development mode
- `npm run lint` - run ESLint
- `npm run preview` - preview the production build locally
- `npm run test` - run the Vitest suite once
- `npm run test:watch` - run tests in watch mode
- `npm run supabase:types:gen` - generate Supabase types from the remote project
- `npm run supabase:types:apply` - copy generated types into `src/integrations/supabase/types.ts`

## App Routes

Main routes in the app:

- `/` - landing page
- `/role-selection` - choose teacher or administrator login/signup
- `/signup-teacher` - teacher registration
- `/login-teacher` - teacher login
- `/login-admin` - administrator login
- `/teacher-dashboard` - teacher overview
- `/teacher/submissions` - submission review queue
- `/teacher/students` - student management
- `/teacher/missions` - mission management
- `/teacher/content` - learning content
- `/teacher/leaderboard` - leaderboard view
- `/admin-dashboard` - administrator dashboard

Student-only dashboard routes are not part of this web app. Student activity is still supported through the mission and submission data model, backend notifications, and educator review flows.

## Project Structure

- `src/pages` - page-level screens
- `src/components` - reusable UI components
- `src/hooks` - auth, dashboard, profile, teacher, and theme logic
- `src/integrations/supabase` - Supabase client and typed queries
- `src/lib` - shared utilities and types
- `supabase/migrations` - database schema and trigger migrations
- `supabase/functions` - edge functions

## Supabase Notes

- The app uses Supabase for authentication, role checks, database access, realtime notifications, and mission review updates.
- Keep generated schema types in sync whenever the Supabase schema changes.
- If a schema change is not reflected in the app, restart the dev server after applying the migration.

## Shared Data Contract (Teacher Side <-> Student Side)

Both apps use the same Supabase project and core tables. The teacher app writes moderation and content data, and the student app reads and reacts to it.

- `public.profiles`: identity, role, school scope, points and learner metadata
- `public.missions`: mission content created by teacher/admin users
- `public.mission_submissions`: student proof submissions and review status
- `public.notifications`: in-app alerts for review outcomes and platform events
- `public.daily_points`: score/points timeline used by leaderboard and progress UI
- `public.teacher_signin_events`: teacher sign-in audit log for monitoring and troubleshooting

If one app changes schema assumptions without a migration, the other app can break. Keep schema, policies, and generated types synchronized across both repositories.

## Student Workflow

This is the student journey supported by the EcoQuest data model and notification flow:

1. The student signs in with the correct student account.
2. The student opens the assigned mission list or mission detail view in the student experience.
3. The student completes the mission requirement, such as a photo, note, or location proof if the mission requires it.
4. The student submits the proof for review.
5. The submission enters a pending state.
6. A teacher or administrator reviews the submission.
7. If approved, the student receives EcoPoints and a success notification.
8. If rejected, the student receives feedback and can resubmit after making changes.
9. The student continues tracking progress through points, streaks, and progress updates.

## Teacher Workflow

1. Sign in through the teacher login flow.
2. Create missions and configure reward values.
3. Review pending student submissions.
4. Approve or reject submissions with optional feedback.
5. Award bonus points when needed.
6. Monitor the class leaderboard and mission activity.

## Teacher-Side To Student-Side Flow

This web app is the teacher and admin control surface, while the student app is available at:
https://github.com/Ni30sh/ecoverse-student

How they work together:

1. Teachers create or update missions in this web app.
2. The mission data is stored in Supabase and becomes visible in the student app mission list.
3. Students open the student app, complete tasks, and submit proof.
4. Submissions are written to the shared Supabase tables and enter pending review.
5. Teachers review those submissions in this web app and approve or reject.
6. Approval updates status, points, and notifications that the student app reads.
7. Rejection stores feedback, and students see that feedback in the student app before resubmitting.
8. Admin actions in this web app (role changes, policy actions, moderation) affect what students and teachers can access across both apps.

In short, Supabase is the shared backend contract between teacher/admin web workflows and the student mobile/web experience.

## Run Teacher And Student Repos Together

Use this flow when you want to test end-to-end behavior locally.

1. Start this teacher/admin web app with `npm run dev`.
2. In the student repository, set the same Supabase project values in `.env`.
3. Start the student app in its own terminal.
4. Sign in as teacher in this app and as student in the student app.
5. Create or edit a mission from teacher side.
6. Verify the mission appears in the student app.
7. Submit proof from student app.
8. Review and approve/reject from teacher side.
9. Verify status, feedback, notifications, and points are reflected in student app.

Tip: test with separate accounts (one teacher, one student) to avoid role confusion during QA.

## Admin Workflow

1. Sign in through the admin login flow.
2. Review platform-wide analytics and user activity.
3. Manage users and roles.
4. Monitor mission and submission activity.
5. Read notifications for review activity, role updates, and mission updates.

## Database and Migration Workflow

If you change the schema:

```sh
npx supabase db query --linked -f supabase/migrations/<migration-file>.sql
```

or use the Supabase CLI:

```sh
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

After applying migrations that affect frontend data models:

1. Regenerate types with `npm run supabase:types:gen`.
2. Apply generated types with `npm run supabase:types:apply`.
3. Restart both teacher and student dev servers.

## Teacher Sign-In Audit Logging

Teacher sign-ins can be stored in `public.teacher_signin_events` for audit/history.

- Migration file: `supabase/migrations/20260404120000_create_teacher_signin_events_table.sql`
- Stores: teacher id, sign-in time, provider, ip, user agent, optional device metadata
- RLS model:
  - Teacher can insert/select own sign-in events
  - Admin can manage all sign-in events

Recommended usage in app flow: after successful teacher login, insert one row into this table.

## Deployment

Build the app first:

```sh
npm run build
```

Then deploy the generated `dist` output to your hosting provider.

If you use Supabase migrations in production, apply them before shipping the new frontend so the app and database stay in sync.

## Troubleshooting

- If the app shows stale schema errors, restart the dev server after applying migrations.
- If a notification or review column error appears, verify the migration has been applied to the linked Supabase project.
- If authentication or role redirects fail, confirm the Supabase env values and that the user profile role exists in the database.
- If teacher login works but sign-in history is missing, check whether the app inserts into `public.teacher_signin_events` after auth success and verify RLS role claims.

## Contributing

1. Create a branch.
2. Make your changes.
3. Run `npm run lint`, `npm run test`, and `npm run build`.
4. Open a pull request.

## Deployment Domains

To connect a custom domain, open your hosting provider settings and add the domain there.
