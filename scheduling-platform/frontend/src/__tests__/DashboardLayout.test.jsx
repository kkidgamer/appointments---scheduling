import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../lib/auth';
import DashboardLayout from '../components/DashboardLayout';

describe('DashboardLayout', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <AuthProvider>
          <DashboardLayout><div>Child content</div></DashboardLayout>
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(container).toBeTruthy();
  });
});
