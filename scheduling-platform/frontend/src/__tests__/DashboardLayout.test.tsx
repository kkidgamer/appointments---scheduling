import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardLayout from '@/components/DashboardLayout';

// Mock the auth hook
vi.mock('@/lib/auth', () => ({
  useAuth: vi.fn(),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Mock Sidebar
vi.mock('@/components/Sidebar', () => ({
  default: () => <nav data-testid="sidebar">Sidebar</nav>,
}));

import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';

const mockUseAuth = vi.mocked(useAuth);
const mockUseRouter = vi.mocked(useRouter);

describe('DashboardLayout', () => {
  const mockReplace = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRouter.mockReturnValue({ replace: mockReplace, push: vi.fn(), back: vi.fn(), refresh: vi.fn() } as any);
  });

  it('shows loading state', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      business: null,
      loading: true,
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('redirects to login when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      business: null,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );

    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('renders children when authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', name: 'John', email: 'john@test.com', role: 'admin', is_provider: false },
      business: { id: 'b1', name: 'Test Salon' },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    render(
      <DashboardLayout>
        <div>Dashboard Content</div>
      </DashboardLayout>
    );

    expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
  });

  it('renders sidebar when authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', name: 'John', email: 'john@test.com', role: 'admin', is_provider: false },
      business: { id: 'b1', name: 'Test Salon' },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );

    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  it('does not redirect while loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      business: null,
      loading: true,
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
