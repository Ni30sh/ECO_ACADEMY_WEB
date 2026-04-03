import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, AppRole } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const roleConfig: Record<AppRole, { emoji: string; title: string; subtitle: string; gradient: string }> = {
  student: {
    emoji: '🌱',
    title: 'Student',
    subtitle: 'Continue your eco-journey',
    gradient: 'from-emerald-50 via-background to-background',
  },
  teacher: {
    emoji: '📚',
    title: 'Teacher',
    subtitle: 'Access your classroom dashboard',
    gradient: 'from-blue-50 via-background to-background',
  },
  admin: {
    emoji: '⚙️',
    title: 'Administrator',
    subtitle: 'System administration panel',
    gradient: 'from-violet-50 via-background to-background',
  },
};

const teacherSchoolOptions = [
  'MPGI',
  'KGI',
  'KIT',
  'AKTU',
  'Other',
] as const;

function RoleLoginPageInternal({ expectedRole }: { expectedRole: AppRole }) {
  const navigate = useNavigate();
  const { signIn, signOut, loading: authLoading, user, role, resolveDashboardPath } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!authLoading && user && role) {
    return <Navigate to={resolveDashboardPath(role)} replace />;
  }

  const config = roleConfig[expectedRole];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const cleanEmail = email.trim().toLowerCase();
    setLoading(true);
    const { error, role: resolvedRole } = await signIn(cleanEmail, password);
    if (error) {
      setLoading(false);
      const isInvalidCredentials = /invalid\s+login\s+credentials|invalid\s+email\s+or\s+password/i.test(error.message);
      const description =
        expectedRole === 'admin' && isInvalidCredentials
          ? 'Admin account not found or password is incorrect in Supabase Auth. Create/reset admin user, then retry.'
          : error.message;
      toast({ title: 'Login failed', description, variant: 'destructive' });
      return;
    }

    if (resolvedRole !== expectedRole) {
      await signOut();
      setLoading(false);
      toast({ title: 'Login failed', description: 'Unauthorized role access', variant: 'destructive' });
      navigate(`/role-selection?reason=unauthorized-role&expected=${expectedRole}`, { replace: true });
      return;
    }

    navigate(resolveDashboardPath(resolvedRole), { replace: true });
    setLoading(false);
    toast({ title: 'Login successful', description: `${config.title} account authenticated.` });
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br ${config.gradient}`}>
      <div className="min-h-screen flex flex-col lg:flex-row">
        <div className="hidden lg:flex flex-1 items-center justify-center p-12">
          <div className="text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', duration: 0.9 }} className="text-8xl mb-6">
              {config.emoji}
            </motion.div>
            <h2 className="font-display font-bold text-3xl text-foreground mb-3">{config.title} Login</h2>
            <p className="text-muted-foreground max-w-sm">{config.subtitle}</p>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-md">
            <Link to="/role-selection" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
              <ArrowLeft className="w-4 h-4" />
              Back to roles
            </Link>

            <div className="flex items-center gap-2 mb-8">
              <span className="text-2xl">🌿</span>
              <span className="font-display font-bold text-jungle-deep text-xl">EcoQuest</span>
            </div>

            <h1 className="font-display font-bold text-3xl text-jungle-deep mb-2">{config.title} Login</h1>
            <p className="text-muted-foreground mb-8">Enter your email and password</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className="rounded-xl" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="rounded-xl" required />
              </div>
              <Button type="submit" className="w-full rounded-xl font-heading font-bold shadow-card" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Log In
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-6">
              {expectedRole === 'teacher' ? (
                <>
                  New teacher?{' '}
                  <Link to="/signup-teacher" className="text-primary hover:underline font-semibold">
                    Create teacher account
                  </Link>
                </>
              ) : (
                <>
                  Need account access?{' '}
                  <Link to="/role-selection" className="text-primary hover:underline font-semibold">
                    Contact administrator
                  </Link>
                </>
              )}
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export function SignupTeacherPage() {
  const navigate = useNavigate();
  const { signUp, loading: authLoading, user, role, resolveDashboardPath } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<(typeof teacherSchoolOptions)[number]>('MPGI');
  const [customSchoolName, setCustomSchoolName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!authLoading && user && role) {
    return <Navigate to={resolveDashboardPath(role)} replace />;
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const cleanName = fullName.trim();
    const cleanSchool = selectedSchool === 'Other' ? customSchoolName.trim() : selectedSchool;
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanSchool || !cleanEmail || !password) {
      toast({ title: 'Missing fields', description: 'Please fill all required fields', variant: 'destructive' });
      return;
    }

    if (password.length < 6) {
      toast({ title: 'Weak password', description: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }

    if (password !== confirmPassword) {
      toast({ title: 'Password mismatch', description: 'Password and confirm password must match', variant: 'destructive' });
      return;
    }

    setLoading(true);

    const { error, needsEmailConfirmation } = await signUp(cleanEmail, password, cleanName, cleanSchool, 'teacher');

    if (error) {
      setLoading(false);
      toast({ title: 'Signup failed', description: error.message, variant: 'destructive' });
      return;
    }

    setLoading(false);

    if (needsEmailConfirmation) {
      toast({
        title: 'Confirm your email',
        description: 'We sent you a confirmation link. Verify email, then log in as teacher.',
      });
      navigate('/login-teacher', { replace: true });
      return;
    }

    toast({ title: 'Teacher account created', description: 'Welcome to EcoQuest teacher dashboard.' });
    navigate('/teacher-dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-background to-background">
      <div className="min-h-screen flex flex-col lg:flex-row">
        <div className="hidden lg:flex flex-1 items-center justify-center p-12">
          <div className="text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', duration: 0.9 }} className="text-8xl mb-6">
              📚
            </motion.div>
            <h2 className="font-display font-bold text-3xl text-foreground mb-3">Teacher Signup</h2>
            <p className="text-muted-foreground max-w-sm">Create your teacher account for your school and start managing submissions.</p>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-md">
            <Link to="/role-selection" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
              <ArrowLeft className="w-4 h-4" />
              Back to roles
            </Link>

            <div className="flex items-center gap-2 mb-8">
              <span className="text-2xl">🌿</span>
              <span className="font-display font-bold text-jungle-deep text-xl">EcoQuest</span>
            </div>

            <h1 className="font-display font-bold text-3xl text-jungle-deep mb-2">Teacher Signup</h1>
            <p className="text-muted-foreground mb-8">Create a teacher account for your school</p>

            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" className="rounded-xl" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schoolSelect">School / College</Label>
                <select
                  id="schoolSelect"
                  value={selectedSchool}
                  onChange={(e) => setSelectedSchool(e.target.value as (typeof teacherSchoolOptions)[number])}
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required
                >
                  {teacherSchoolOptions.map((school) => (
                    <option key={school} value={school}>
                      {school}
                    </option>
                  ))}
                </select>
              </div>

              {selectedSchool === 'Other' && (
                <div className="space-y-2">
                  <Label htmlFor="customSchoolName">Enter School / College Name</Label>
                  <Input
                    id="customSchoolName"
                    value={customSchoolName}
                    onChange={(e) => setCustomSchoolName(e.target.value)}
                    placeholder="Your school or college"
                    className="rounded-xl"
                    required
                  />
                </div>
              )}

              {selectedSchool !== 'Other' && (
                <p className="text-xs text-muted-foreground">
                  Selected: <span className="font-semibold text-foreground">{selectedSchool}</span>
                </p>
              )}

              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                If your institution is not listed, choose <span className="font-semibold text-foreground">Other</span> and type it manually.
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teacher@school.com" className="rounded-xl" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className="rounded-xl" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password" className="rounded-xl" required />
              </div>

              <Button type="submit" className="w-full rounded-xl font-heading font-bold shadow-card" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Create Teacher Account
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-6">
              Already have an account?{' '}
              <Link to="/login-teacher" className="text-primary hover:underline font-semibold">
                Log in here
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export function LoginTeacherPage() {
  return <RoleLoginPageInternal expectedRole="teacher" />;
}

export function LoginAdminPage() {
  return <RoleLoginPageInternal expectedRole="admin" />;
}
