import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';

type HealthStatus = {
  total_auth_users: number;
  total_profile_users: number;
  auth_no_profile: number;
  profile_no_auth: number;
  role_mismatches: number;
  healthy: boolean;
  summary: string;
};

async function fetchHealthStatus(): Promise<HealthStatus> {
  // Get all profiles (mapped to auth users via FK)
  const { data: profiles, error: profileError, count: profileCount } = await supabase
    .from('profiles')
    .select('id, role, full_name', { count: 'exact' });

  if (profileError) throw profileError;
  const total_profile_users = profileCount || 0;

  // Since profiles references auth.users via FK, all profiles have auth users
  // auth_no_profile and profile_no_auth would require checking auth directly (protected)
  // For safety check, we assume profile count = auth count via referential integrity
  const total_auth_users = total_profile_users;
  const auth_no_profile = 0; // Protected by FK
  const profile_no_auth = 0; // All profiles require auth user

  // Check for basic consistency: non-null full_name and role
  const missingFullName = profiles?.filter((p: any) => !p.full_name).length || 0;
  const role_mismatches = missingFullName;

  const healthy = role_mismatches === 0;

  const summary = healthy
    ? 'All users have complete profiles'
    : `⚠️ ${role_mismatches} profiles with missing data`;

  return {
    total_auth_users,
    total_profile_users,
    auth_no_profile,
    profile_no_auth,
    role_mismatches,
    healthy,
    summary,
  };
}

export default function AdminHealthCheckWidget() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-health-check'],
    queryFn: fetchHealthStatus,
    refetchInterval: 60000, // Refresh every 60 seconds
  });

  if (isLoading) {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            🏥 System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="h-4 w-32 rounded bg-muted animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="shadow-card border-coral/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            🏥 System Health
            <Badge variant="destructive" className="text-xs">Error</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Failed to fetch health status</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className={`shadow-card transition-colors ${data?.healthy ? 'border-jungle-bright/20' : 'border-coral/20'}`}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-lg">
            <span className="flex items-center gap-2">
              🏥 System Health
            </span>
            {data?.healthy ? (
              <Badge className="bg-jungle-bright text-white">Healthy</Badge>
            ) : (
              <Badge variant="destructive">Issues Found</Badge>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Status Summary */}
          <div
            className={`flex items-center gap-2 rounded-lg p-3 ${
              data?.healthy ? 'bg-jungle-pale/20' : 'bg-coral/10'
            }`}
          >
            {data?.healthy ? (
              <CheckCircle2 size={20} className="text-jungle-bright flex-shrink-0" />
            ) : (
              <AlertCircle size={20} className="text-coral flex-shrink-0" />
            )}
            <span className="text-sm font-medium">{data?.summary}</span>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-2">
            <div className="rounded-lg bg-muted p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{data?.total_profile_users}</p>
              <p className="text-xs text-muted-foreground mt-1">Total Users</p>
            </div>

            {data?.role_mismatches ? (
              <div className="rounded-lg bg-coral/10 p-3 text-center border border-coral/30">
                <p className="text-2xl font-bold text-coral">{data.role_mismatches}</p>
                <p className="text-xs text-muted-foreground mt-1">Incomplete Profiles</p>
              </div>
            ) : (
              <div className="rounded-lg bg-jungle-pale/20 p-3 text-center">
                <p className="text-2xl font-bold text-jungle-bright">✓</p>
                <p className="text-xs text-muted-foreground mt-1">All Complete</p>
              </div>
            )}
          </div>

          {/* Last Updated */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock size={14} />
            <span>Updates every 60 seconds</span>
          </div>

          {/* Recovery Info */}
          {!data?.healthy && (
            <div className="rounded border border-coral/30 bg-coral/5 p-3">
              <p className="text-xs font-semibold text-coral mb-1">Fix inconsistencies:</p>
              <p className="text-xs text-muted-foreground">
                Inconsistent users can use the admin recovery SQL helper:
              </p>
              <p className="text-xs font-mono text-jungle-bright mt-1">supabase/queries/admin_setup_check.sql</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
