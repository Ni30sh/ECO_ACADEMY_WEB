import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import ProtectedRoute from '@/components/ProtectedRoute';
import RoleDashboardRoute from '@/components/RoleDashboardRoute';
import TeacherRoute from '@/components/TeacherRoute';
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
  resolveDashboardPath: () => '/admin-dashboard',
  ...overrides,
});

beforeEach(() => {
  mockedUseAuth.mockReset();
});

describe('route guards', () => {
  it('ProtectedRoute sends unauthenticated users to role selection', () => {
    mockedUseAuth.mockReturnValue(makeAuthValue({ user: null, loading: false }));

    render(
      <TestRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={<ProtectedRoute><div>protected</div></ProtectedRoute>} />
          <Route path="/role-selection" element={<div>role-selection</div>} />
        </Routes>
      </TestRouter>
    );

    expect(screen.getByText('role-selection')).toBeInTheDocument();
  });

  it('RoleDashboardRoute redirects student role mismatch to resolved dashboard', () => {
    mockedUseAuth.mockReturnValue(makeAuthValue({
      user: { id: 'u1', email: 'u1@example.com' },
      role: 'student',
      loading: false,
      resolveDashboardPath: () => '/student-dashboard',
    }));

    render(
      <TestRouter initialEntries={['/teacher-dashboard']}>
        <Routes>
          <Route path="/teacher-dashboard" element={<RoleDashboardRoute expectedRole="teacher"><div>teacher</div></RoleDashboardRoute>} />
          <Route path="/student-dashboard" element={<div>student-dashboard</div>} />
        </Routes>
      </TestRouter>
    );

    expect(screen.getByText('student-dashboard')).toBeInTheDocument();
  });

  it('TeacherRoute allows admin as elevated access', () => {
    mockedUseAuth.mockReturnValue(makeAuthValue({
      user: { id: 'u2', email: 'u2@example.com' },
      role: 'admin',
      loading: false,
      resolveDashboardPath: () => '/admin-dashboard',
    }));

    render(
      <TestRouter initialEntries={['/teacher/submissions']}>
        <Routes>
          <Route path="/teacher/submissions" element={<TeacherRoute><div>teacher-area</div></TeacherRoute>} />
          <Route path="/admin-dashboard" element={<div>admin-dashboard</div>} />
        </Routes>
      </TestRouter>
    );

    expect(screen.getByText('teacher-area')).toBeInTheDocument();
  });

  it('TeacherRoute redirects student to own dashboard', () => {
    mockedUseAuth.mockReturnValue(makeAuthValue({
      user: { id: 'u3', email: 'u3@example.com' },
      role: 'student',
      loading: false,
      resolveDashboardPath: () => '/student-dashboard',
    }));

    render(
      <TestRouter initialEntries={['/teacher/submissions']}>
        <Routes>
          <Route path="/teacher/submissions" element={<TeacherRoute><div>teacher-area</div></TeacherRoute>} />
          <Route path="/student-dashboard" element={<div>student-dashboard</div>} />
        </Routes>
      </TestRouter>
    );

    expect(screen.getByText('student-dashboard')).toBeInTheDocument();
  });
});
