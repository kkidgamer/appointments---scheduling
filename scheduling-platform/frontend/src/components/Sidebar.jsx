import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊', adminOnly: false },
  { href: '/calendar', label: 'Calendar', icon: '📅', adminOnly: false },
  { href: '/visits', label: 'Visits', icon: '📋', adminOnly: false },
  { href: '/clients', label: 'Clients', icon: '👥', adminOnly: false },
  { href: '/services', label: 'Services', icon: '💇', adminOnly: false },
  { href: '/series', label: 'Recurring', icon: '🔄', adminOnly: true },
  { href: '/users', label: 'Staff', icon: '🧑‍💼', adminOnly: true },
  { href: '/attention', label: 'Attention', icon: '🔔', adminOnly: true },
  { href: '/reports', label: 'Reports', icon: '📈', adminOnly: true },
  { href: '/audit', label: 'Audit Log', icon: '📝', adminOnly: true },
];

export default function Sidebar() {
  const location = useLocation();
  const { user, business, logout } = useAuth();

  const isAdmin = user?.role === 'owner' || user?.role === 'admin';

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-200 p-4">
        <h2 className="text-lg font-bold text-gray-900 truncate">{business?.name || 'Scheduling'}</h2>
        <p className="text-xs text-gray-500 mt-1">
          {user?.name} · <span className="capitalize">{user?.role}</span>
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            if (item.adminOnly && !isAdmin) return null;
            const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-gray-200 p-3">
        <button
          onClick={logout}
          className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
