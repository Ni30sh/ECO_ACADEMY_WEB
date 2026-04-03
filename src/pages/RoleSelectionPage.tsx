import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const roleCards = [
	{
		role: 'teacher',
		title: 'Teacher',
		icon: Users,
		description: 'Create missions, review submissions, and inspire your class.',
		href: '/signup-teacher',
		loginHref: '/login-teacher',
		signupHref: '/signup-teacher',
		className: 'border-blue-500/50 bg-gradient-to-b from-blue-100/95 via-sky-100/80 to-indigo-100/70 hover:from-blue-100 hover:via-sky-200/80 hover:to-indigo-200/70 dark:border-blue-400/45 dark:from-blue-900/45 dark:via-sky-950/35 dark:to-indigo-950/45 dark:hover:from-blue-900/55 dark:hover:via-blue-900/45 dark:hover:to-indigo-900/55',
		accent: 'text-blue-800 dark:text-blue-300',
	},
	{
		role: 'admin',
		title: 'Administrator',
		icon: ShieldCheck,
		description: 'Manage schools, teachers, missions, and system analytics.',
		href: '/login-admin',
		loginHref: '/login-admin',
		className: 'border-violet-500/50 bg-gradient-to-b from-violet-100/95 via-fuchsia-100/80 to-purple-100/70 hover:from-violet-100 hover:via-fuchsia-200/80 hover:to-purple-200/70 dark:border-violet-400/45 dark:from-violet-900/45 dark:via-fuchsia-950/35 dark:to-purple-950/45 dark:hover:from-violet-900/55 dark:hover:via-violet-900/45 dark:hover:to-purple-900/55',
		accent: 'text-violet-800 dark:text-violet-300',
	},
] as const;

export default function RoleSelectionPage() {
	const { user, role, loading, resolveDashboardPath } = useAuth();
	const location = useLocation();
	const navigate = useNavigate();
	const { toast } = useToast();

	useEffect(() => {
		const params = new URLSearchParams(location.search);
		const reason = params.get('reason');
		if (reason !== 'unauthorized-role') return;

		const expectedRole = params.get('expected');
		const expectedRoleLabel =
			expectedRole === 'teacher' ? 'Teacher' : expectedRole === 'admin' ? 'Administrator' : 'Student';

		toast({
			title: 'Login blocked',
			description: `You attempted ${expectedRoleLabel} login with a different account role. Choose the correct role to continue.`,
			variant: 'destructive',
		});

		navigate('/role-selection', { replace: true });
	}, [location.search, navigate, toast]);

	if (!loading && user && role) {
		return <Navigate to={resolveDashboardPath(role)} replace />;
	}

	return (
		<div className="min-h-screen bg-gradient-warm px-6 py-10 lg:py-16">
			<div className="mx-auto w-full max-w-5xl">
				<div className="text-center">
					<h1 className="font-display font-bold text-jungle-deep text-5xl leading-tight dark:text-slate-100">
						<Link to="/" className="inline-block">
							🌍 EcoQuest
						</Link>
					</h1>
					<p className="mt-4 text-2xl text-foreground/90">Choose your educator role</p>
					<p className="mt-2 text-foreground/75 dark:text-slate-300">This workspace is for teachers and administrators only</p>
				</div>

				<div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
					{roleCards.map((card, index) => {
						const Icon = card.icon;
						return (
							<motion.div
								key={card.role}
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.35, delay: index * 0.08 }}
								className={`rounded-3xl border p-7 shadow-card transition-colors ${card.className}`}
							>
								<Icon className={`h-11 w-11 ${card.accent}`} />
								<h2 className="mt-6 font-display text-3xl font-bold text-foreground dark:text-slate-100">{card.title}</h2>
								<p className="mt-4 min-h-20 text-base leading-7 text-foreground/75 dark:text-slate-300">{card.description}</p>

								<div className="mt-7 border-t border-foreground/25 pt-5">
									<Link
										to={card.href}
										className="flex items-center justify-between font-heading text-lg font-bold text-foreground/90 dark:text-slate-100"
									>
										<span>{card.role === 'teacher' ? 'Sign Up' : 'Log In'}</span>
										<ArrowRight className="h-6 w-6" />
									</Link>
									{card.role === 'teacher' && card.loginHref ? (
										<Link
											to={card.loginHref}
											className="mt-3 inline-flex font-heading text-sm font-bold text-foreground/70 hover:underline dark:text-slate-300"
										>
											Already have account? Log in
										</Link>
									) : null}
									{card.role === 'teacher' && card.signupHref ? (
										<Link
											to={card.signupHref}
											className="mt-3 inline-flex font-heading text-sm font-bold text-emerald-700 hover:underline dark:text-emerald-300"
										>
											Teacher signup page
										</Link>
									) : null}
								</div>
							</motion.div>
						);
					})}
				</div>

				<div className="mt-10 text-center text-lg">
					<p className="mt-2 text-foreground/80 dark:text-slate-300">
							Need a teacher account?{' '}
							<Link to="/signup-teacher" className="font-heading font-bold text-emerald-700 hover:underline dark:text-emerald-300">
								Create one here
							</Link>
					</p>
				</div>
			</div>
		</div>
	);
}
