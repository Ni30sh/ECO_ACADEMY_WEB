import { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, AppRole } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export default function RoleDashboardRoute({
  expectedRole,
  children,
}: {
  expectedRole: AppRole;
  children: React.ReactNode;
}) {
  const { user, role, loading, resolveDashboardPath } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const mismatchToastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user || !role || loading) return;
    const isElevatedAllowed = expectedRole === 'teacher' && role === 'admin';
    if (role === expectedRole || isElevatedAllowed) return;

    const key = `${location.pathname}:${role}:${expectedRole}`;
    if (mismatchToastKeyRef.current === key) return;
    mismatchToastKeyRef.current = key;

    const expectedLabel = expectedRole === 'teacher' ? 'Teacher' : expectedRole === 'admin' ? 'Administrator' : 'Student';
    const actualLabel = role === 'teacher' ? 'Teacher' : role === 'admin' ? 'Administrator' : 'Student';

    toast({
      title: 'Unauthorized role access',
      description: `${actualLabel} account cannot open ${expectedLabel} dashboard. Redirected to your dashboard.`,
      variant: 'destructive',
    });
  }, [user, role, loading, expectedRole, location.pathname, toast]);

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
  if (!role) return <Navigate to="/role-selection" replace />;
  if (role !== expectedRole && !(expectedRole === 'teacher' && role === 'admin')) {
    return <Navigate to={resolveDashboardPath(role)} replace />;
  }

  return <>{children}</>;
}
