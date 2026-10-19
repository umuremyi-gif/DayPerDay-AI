import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { OnboardingProvider, useOnboarding } from '@/contexts/OnboardingContext';
import { RedAlertProvider } from '@/contexts/RedAlertContext';
import { ToastProvider } from '@/components/ui/Toast';
import LandingPage from '@/pages/LandingPage';
import { LoginPage, SignUpPage } from '@/pages/AuthPages';
import DashboardLayout from '@/components/DashboardLayout';
import Dashboard from '@/pages/Dashboard';
import DailyPlanner from '@/pages/DailyPlanner';
import EveningReview from '@/pages/EveningReview';
import Goals from '@/pages/Goals';
import Transactions from '@/pages/Transactions';
import Reports from '@/pages/Reports';
import AICoach from '@/pages/AICoach';
import Achievements from '@/pages/Achievements';
import Notifications from '@/pages/Notifications';
import SettingsPage from '@/pages/SettingsPage';
import OnboardingWizard from '@/components/OnboardingWizard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <LoadingSpinner size="lg" text="Loading..." fullScreen />;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <LoadingSpinner size="lg" text="Loading..." fullScreen />;
  if (session) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { needsOnboarding, onboardingLoading } = useOnboarding();
  if (onboardingLoading) {
    return <LoadingSpinner size="lg" text="Preparing your experience..." fullScreen />;
  }
  if (needsOnboarding) {
    return <OnboardingWizard />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
      <Route path="/signup" element={<PublicOnlyRoute><SignUpPage /></PublicOnlyRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><OnboardingGate><RedAlertProvider><DashboardLayout><Dashboard /></DashboardLayout></RedAlertProvider></OnboardingGate></ProtectedRoute>} />
      <Route path="/planner" element={<ProtectedRoute><OnboardingGate><RedAlertProvider><DashboardLayout><DailyPlanner /></DashboardLayout></RedAlertProvider></OnboardingGate></ProtectedRoute>} />
      <Route path="/review" element={<ProtectedRoute><OnboardingGate><RedAlertProvider><DashboardLayout><EveningReview /></DashboardLayout></RedAlertProvider></OnboardingGate></ProtectedRoute>} />
      <Route path="/goals" element={<ProtectedRoute><OnboardingGate><RedAlertProvider><DashboardLayout><Goals /></DashboardLayout></RedAlertProvider></OnboardingGate></ProtectedRoute>} />
      <Route path="/transactions" element={<ProtectedRoute><OnboardingGate><RedAlertProvider><DashboardLayout><Transactions /></DashboardLayout></RedAlertProvider></OnboardingGate></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><OnboardingGate><RedAlertProvider><DashboardLayout><Reports /></DashboardLayout></RedAlertProvider></OnboardingGate></ProtectedRoute>} />
      <Route path="/ai-coach" element={<ProtectedRoute><OnboardingGate><RedAlertProvider><DashboardLayout><AICoach /></DashboardLayout></RedAlertProvider></OnboardingGate></ProtectedRoute>} />
      <Route path="/achievements" element={<ProtectedRoute><OnboardingGate><RedAlertProvider><DashboardLayout><Achievements /></DashboardLayout></RedAlertProvider></OnboardingGate></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><OnboardingGate><RedAlertProvider><DashboardLayout><Notifications /></DashboardLayout></RedAlertProvider></OnboardingGate></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><OnboardingGate><RedAlertProvider><DashboardLayout><SettingsPage /></DashboardLayout></RedAlertProvider></OnboardingGate></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <OnboardingProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </OnboardingProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
