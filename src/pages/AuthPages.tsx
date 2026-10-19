import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sun, Moon, Mail, Lock, User, Building2, ArrowLeft, Loader2 } from 'lucide-react';
import Logo from '@/components/ui/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/components/ui/Toast';

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      showToast(error, 'error');
    } else {
      showToast('Welcome back!', 'success');
      navigate('/dashboard');
    }
  }

  return (
    <AuthShell theme={theme} toggleTheme={toggleTheme}>
      <div className="text-center mb-8">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Sign in to continue your journey</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <div className="relative">
            <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input pl-11"
              placeholder="you@example.com"
            />
          </div>
        </div>
        <div>
          <label className="label">Password</label>
          <div className="relative">
            <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input pl-11"
              placeholder="••••••••"
            />
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? <Loader2 size={18} className="animate-spin" /> : 'Sign In'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Don't have an account?{' '}
        <Link to="/signup" className="text-primary-600 dark:text-primary-400 font-medium hover:underline">
          Sign up
        </Link>
      </p>
    </AuthShell>
  );
}

export function SignUpPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState<'personal' | 'business'>('personal');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }
    setLoading(true);
    const { error } = await signUp(email, password, fullName, accountType);
    setLoading(false);
    if (error) {
      showToast(error, 'error');
    } else {
      showToast('Account created! Welcome to DayPerDay AI.', 'success');
      navigate('/dashboard');
    }
  }

  return (
    <AuthShell theme={theme} toggleTheme={toggleTheme}>
      <div className="text-center mb-8">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Create your account</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Start organizing your days today</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Full Name</label>
          <div className="relative">
            <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input pl-11"
              placeholder="John Doe"
            />
          </div>
        </div>
        <div>
          <label className="label">Email</label>
          <div className="relative">
            <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input pl-11"
              placeholder="you@example.com"
            />
          </div>
        </div>
        <div>
          <label className="label">Password</label>
          <div className="relative">
            <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input pl-11"
              placeholder="At least 6 characters"
            />
          </div>
        </div>
        <div>
          <label className="label">Account Type</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAccountType('personal')}
              className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                accountType === 'personal'
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <User size={18} className={accountType === 'personal' ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400'} />
              <span className="text-sm font-medium">Personal</span>
            </button>
            <button
              type="button"
              onClick={() => setAccountType('business')}
              className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                accountType === 'business'
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <Building2 size={18} className={accountType === 'business' ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400'} />
              <span className="text-sm font-medium">Business</span>
            </button>
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? <Loader2 size={18} className="animate-spin" /> : 'Create Account'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Already have an account?{' '}
        <Link to="/login" className="text-primary-600 dark:text-primary-400 font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}

function AuthShell({
  children,
  theme,
  toggleTheme,
}: {
  children: React.ReactNode;
  theme: string;
  toggleTheme: () => void;
}) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-primary-50/20 to-secondary-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="absolute top-0 left-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-secondary-500/10 rounded-full blur-3xl" />
      <div className="relative w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate('/')} className="btn-ghost text-sm">
            <ArrowLeft size={16} /> Home
          </button>
          <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
        <div className="card p-8 rounded-2xl">
          <div className="flex justify-center mb-6">
            <Logo size="lg" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
