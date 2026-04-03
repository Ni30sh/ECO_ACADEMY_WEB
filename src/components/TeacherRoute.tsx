import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

export default function TeacherRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading, resolveDashboardPath } = useAuth();
  const hasTeacherAccess = role === 'teacher' || role === 'admin';

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-warm flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">🌿</div>
          <p className="font-heading font-bold text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/role-selection" replace />;
  if (!hasTeacherAccess) return <Navigate to={resolveDashboardPath(role)} replace />;
  return <>{children}</>;
}
