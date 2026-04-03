// UI Components - shadcn
export * from './ui/button';
export * from './ui/card';
export * from './ui/alert';
export * from './ui/badge';
export * from './ui/tabs';
export * from './ui/dialog';
export * from './ui/input';
export * from './ui/textarea';
export * from './ui/select';
export * from './ui/checkbox';
export * from './ui/toast';
export { Toaster } from '@/components/ui/toaster';

// Layout Components
export { default as TeacherLayout } from './layout/TeacherLayout';

// Authentication & Routing
export { default as ProtectedRoute } from './ProtectedRoute';
export { default as TeacherRoute } from './TeacherRoute';
export { default as RoleDashboardRoute } from './RoleDashboardRoute';

// Navigation
export { NavLink } from './NavLink';

// Mission Components
export { default as MissionStepViewer } from './MissionStepViewer';
export { default as TeacherStepReview } from './TeacherStepReview';
export { default as ProofSubmissionSheet } from './ProofSubmissionSheet';

// Game Components
export * as GameUI from './game/GameUI';
export { default as EcosystemViewer } from './game/EcosystemViewer';
