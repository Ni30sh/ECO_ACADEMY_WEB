import { describe, expect, it } from 'vitest';
import { resolveDashboardPathFromRole } from '@/hooks/useAuth';

describe('resolveDashboardPathFromRole', () => {
  it('routes student to student dashboard', () => {
    expect(resolveDashboardPathFromRole('student')).toBe('/student-dashboard');
  });

  it('routes teacher to teacher dashboard', () => {
    expect(resolveDashboardPathFromRole('teacher')).toBe('/teacher-dashboard');
  });

  it('routes admin to admin dashboard', () => {
    expect(resolveDashboardPathFromRole('admin')).toBe('/admin-dashboard');
  });

  it('falls back to student dashboard for null/undefined role', () => {
    expect(resolveDashboardPathFromRole(undefined)).toBe('/student-dashboard');
    expect(resolveDashboardPathFromRole(null)).toBe('/student-dashboard');
  });
});
