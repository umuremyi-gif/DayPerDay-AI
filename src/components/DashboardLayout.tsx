import { useState, ReactNode } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, CalendarDays, Moon, Target, Wallet, TrendingUp,
  Brain, Trophy, Bell, Settings, LogOut, Menu, X, Sun, Building2,
  AlertCircle, Plus,
} from 'lucide-react';
import Logo from '@/components/ui/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useRedAlert } from '@/contexts/RedAlertContext';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/planner', icon: CalendarDays, label: 'Daily Planner' },
  { to: '/review', icon: Moon, label: 'Evening Review' },
  { to: '/goals', icon: Target, label: 'Goals' },
  { to: '/transactions', icon: Wallet, label: 'Income & Expenses' },
  { to: '/reports', icon: TrendingUp, label: 'Reports' },
  { to: '/ai-coach', icon: Brain, label: 'AI Coach' },
  { to: '/achievements', icon: Trophy, label: 'Achievements' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { alertActive, alertError } = useRedAlert();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const currentPage = navItems.find((item) => location.pathname.startsWith(item.to));
  const onPlanner = location.pathname === '/planner';

  const showAlert = alertActive && !onPlanner;

  return (
    <div className={`min-h-screen transition-colors duration-500 ${
      showAlert ? 'bg-red-50 dark:bg-red-950/40' : 'bg-slate-50 dark:bg-slate-950'
    }`}>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-72 border-r transition-colors duration-500 transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${
          showAlert
            ? 'bg-red-100 dark:bg-red-900/60 border-red-200 dark:border-red-800'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
        }`}
      >
        <div className={`flex items-center justify-between p-5 border-b transition-colors duration-500 ${
          showAlert ? 'border-red-200 dark:border-red-800' : 'border-slate-200 dark:border-slate-800'
        }`}>
          <Logo size="sm" />
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100%-12rem)]">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
              }
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User card at bottom */}
        <div className={`absolute bottom-0 left-0 right-0 p-4 border-t transition-colors duration-500 ${
          showAlert ? 'border-red-200 dark:border-red-800' : 'border-slate-200 dark:border-slate-800'
        }`}>
          <div className="flex items-center gap-3 p-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-semibold text-sm">
              {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                {profile?.full_name || 'User'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {profile?.account_type === 'business' ? (
                  <span className="flex items-center gap-1">
                    <Building2 size={10} /> {profile?.business_name || 'Business'}
                  </span>
                ) : (
                  'Personal'
                )}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="p-2 rounded-lg hover:bg-error-50 dark:hover:bg-error-950/30 text-slate-400 hover:text-error-600 transition-colors"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top bar */}
        <header className={`sticky top-0 z-30 backdrop-blur-md border-b h-16 flex items-center justify-between px-4 sm:px-6 transition-colors duration-500 ${
          showAlert
            ? 'bg-red-100/80 dark:bg-red-950/60 border-red-200 dark:border-red-800'
            : 'bg-white/80 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800'
        }`}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu size={20} />
            </button>
            <h1 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              {currentPage?.label || 'Dashboard'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        {/* Red alert banner */}
        {showAlert && (
          <div className="sticky top-16 z-20 bg-red-600 text-white px-4 sm:px-6 py-3 flex items-center justify-between gap-4 animate-slide-up shadow-lg">
            <div className="flex items-center gap-3 min-w-0">
              <AlertCircle size={20} className="flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">
                  {alertError
                    ? "We couldn't check today's plan — please create one to stay on track."
                    : "You haven't created today's plan yet. Every successful day starts with a plan!"}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/planner')}
              className="flex items-center gap-1.5 bg-white text-red-700 font-semibold text-sm px-4 py-2 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
            >
              <Plus size={16} /> Create Today's Plan
            </button>
          </div>
        )}

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">{children}</main>
      </div>
    </div>
  );
}
