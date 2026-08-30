import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/login';
import DashboardPage from './pages/dashboard';
import CalendarPage from './pages/calendar';
import VisitsPage from './pages/visits';
import ClientsPage from './pages/clients';
import ServicesPage from './pages/services';
import SeriesPage from './pages/series';
import UsersPage from './pages/users';
import AttentionPage from './pages/attention';
import ReportsPage from './pages/reports';
import AuditPage from './pages/audit';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/calendar" element={<CalendarPage />} />
      <Route path="/visits" element={<VisitsPage />} />
      <Route path="/clients" element={<ClientsPage />} />
      <Route path="/services" element={<ServicesPage />} />
      <Route path="/series" element={<SeriesPage />} />
      <Route path="/users" element={<UsersPage />} />
      <Route path="/attention" element={<AttentionPage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/audit" element={<AuditPage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
