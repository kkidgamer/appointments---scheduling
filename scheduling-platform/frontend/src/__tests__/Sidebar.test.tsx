import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sidebar from '@/components/Sidebar';

// Mock the auth hook
vi.mock('@/lib/auth', () => ({
  useAuth: vi.fn(),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, className, ...props }: any) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
}));

import { useAuth } from '@/lib/auth';
import { usePathname } from 'next/navigation';

const mockUseAuth = vi.mocked(useAuth);
const mockUsePathname = vi.mocked(usePathname);

describe('Sidebar', () => {
  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue('/dashboard');
    mockUseAuth.mockReturnValue({
      user: { id: '1', name: 'John', email: 'john@test.com', role: 'admin', is_provider: false },
      business: { id: 'b1', name: 'Test Salon' },
      loading: false,
      login: vi.fn(),
      logout: mockLogout,
      refresh: vi.fn(),
    });
  });

  it('renders business name', () => {
    render(<Sidebar />);
    expect(screen.getByText('Test Salon')).toBeInTheDocument();
  });

  it('renders user name and role', () => {
    render(<Sidebar />);
    expect(screen.getByText(/John/)).toBeInTheDocument();
    expect(screen.getByText(/admin/i)).toBeInTheDocument();
  });

  it('shows all nav items for admin users', () => {
    render(<Sidebar />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Calendar')).toBeInTheDocument();
    expect(screen.getByText('Visits')).toBeInTheDocument();
    expect(screen.getByText('Clients')).toBeInTheDocument();
    expect(screen.getByText('Services')).toBeInTheDocument();
    expect(screen.getByText('Recurring')).toBeInTheDocument();
    expect(screen.getByText('Staff')).toBeInTheDocument();
    expect(screen.getByText('Attention')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Audit Log')).toBeInTheDocument();
  });

  it('hides admin-only items for staff users', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '2', name: 'Staff', email: 'staff@test.com', role: 'staff', is_provider: true },
      business: { id: 'b1', name: 'Test Salon' },
      loading: false,
      login: vi.fn(),
      logout: mockLogout,
      refresh: vi.fn(),
    });

    render(<Sidebar />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Recurring')).not.toBeInTheDocument();
    expect(screen.queryByText('Staff')).not.toBeInTheDocument();
    expect(screen.queryByText('Attention')).not.toBeInTheDocument();
    expect(screen.queryByText('Reports')).not.toBeInTheDocument();
    expect(screen.queryByText('Audit Log')).not.toBeInTheDocument();
  });

  it('highlights the active nav item', () => {
    mockUsePathname.mockReturnValue('/calendar');
    render(<Sidebar />);
    const calendarLink = screen.getByText('Calendar');
    expect(calendarLink.closest('a')).toHaveClass('bg-primary-50');
  });

  it('calls logout when sign out is clicked', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);
    await user.click(screen.getByText('Sign out'));
    expect(mockLogout).toHaveBeenCalled();
  });

  it('shows "Scheduling" when business name is not available', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', name: 'John', email: 'john@test.com', role: 'admin', is_provider: false },
      business: null,
      loading: false,
      login: vi.fn(),
      logout: mockLogout,
      refresh: vi.fn(),
    });
    render(<Sidebar />);
    expect(screen.getByText('Scheduling')).toBeInTheDocument();
  });
});
