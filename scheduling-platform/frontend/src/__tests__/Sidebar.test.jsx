import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../lib/auth';
import Sidebar from '../components/Sidebar';

function renderWithProviders(ui, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>,
  );
}

describe('Sidebar', () => {
  it('renders the business name', () => {
    renderWithProviders(<Sidebar />);
    // AuthProvider will fail to call /api/auth/me, so user is null
    // But business name should default to 'Scheduling'
    expect(screen.getByText('Scheduling')).toBeInTheDocument();
  });
});
