import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import RoleSelectionPage from '@/pages/RoleSelectionPage';
import { useAuth } from '@/hooks/useAuth';
import { TestRouter } from './TestRouter';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

type AuthValue = ReturnType<typeof useAuth>;

const makeAuthValue = (overrides: Partial<AuthValue> = {}): AuthValue => ({
  user: null,
  session: null,
  profile: null,
  role: null,
  loading: false,
  signUp: vi.fn(async () => ({ error: null, needsEmailConfirmation: false })),
  signIn: vi.fn(async () => ({ error: null, role: null })),
  signOut: vi.fn(async () => {}),
  refreshProfile: vi.fn(async () => {}),
  updateUserRole: vi.fn(async () => ({ error: null })),
  isTeacher: false,
  resolveDashboardPath: () => '/teacher-dashboard',
  ...overrides,
});

beforeEach(() => {
  mockedUseAuth.mockReset();
});

describe('RoleSelectionPage auth redirect', () => {
  it('redirects authenticated users to their dashboard', () => {
    mockedUseAuth.mockReturnValue(makeAuthValue({
      user: { id: 'u1' },
      role: 'teacher',
      loading: false,
      resolveDashboardPath: () => '/teacher-dashboard',
    }));

    render(
      <TestRouter initialEntries={['/role-selection']}>
        <Routes>
          <Route path="/role-selection" element={<RoleSelectionPage />} />
          <Route path="/teacher-dashboard" element={<div>teacher-dashboard</div>} />
        </Routes>
      </TestRouter>
    );

    expect(screen.getByText('teacher-dashboard')).toBeInTheDocument();
  });
});
