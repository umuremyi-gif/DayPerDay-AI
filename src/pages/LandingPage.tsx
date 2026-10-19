import { useNavigate } from 'react-router-dom';
import { Sun, Moon, Target, Wallet, TrendingUp, Trophy, Brain, Bell, ArrowRight, Check } from 'lucide-react';
import Logo from '@/components/ui/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function LandingPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const features = [
    { icon: Sun, title: 'Daily Planning', desc: 'Start each day at 06:00 with a structured plan. Add tasks, set priorities, and track completion in real time.' },
    { icon: Moon, title: 'Evening Review', desc: 'Reflect on what you accomplished, what fell short, and what to improve tomorrow — with AI-generated summaries.' },
    { icon: Target, title: '90-Day Goals', desc: 'Break ambitious goals into monthly milestones, weekly objectives, and daily actions with AI assistance.' },
    { icon: Wallet, title: 'Financial Tracking', desc: 'Record income, expenses, transfers, and savings. Get accurate reports — no invented numbers, ever.' },
    { icon: TrendingUp, title: 'Reports & Analytics', desc: 'Daily, weekly, monthly, and quarterly reports with charts showing your real progress over time.' },
    { icon: Brain, title: 'AI Coach', desc: 'Powered by local Ollama AI. Get personalized insights on productivity, finances, and goal progress.' },
    { icon: Trophy, title: 'Achievements', desc: 'Earn gold, silver, and bronze trophies for consistent planning, reviews, savings, and goal completion.' },
    { icon: Bell, title: 'Smart Reminders', desc: 'Configurable notifications for planning, reviews, and reports — aligned to your timezone.' },
  ];

  const plans = [
    'Plan your day every morning',
    'Review your progress each evening',
    'Track every transaction accurately',
    'Move closer to your 90-day goals',
    'Earn achievements along the way',
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Nav */}
      <nav className="sticky top-0 z-40 backdrop-blur-md bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Logo size="md" />
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            {session ? (
              <button onClick={() => navigate('/dashboard')} className="btn-primary text-sm">
                Go to Dashboard <ArrowRight size={16} />
              </button>
            ) : (
              <>
                <button onClick={() => navigate('/login')} className="btn-ghost text-sm">Sign In</button>
                <button onClick={() => navigate('/signup')} className="btn-primary text-sm">Get Started</button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-50/50 via-transparent to-transparent dark:from-primary-950/20" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary-500/10 dark:bg-primary-500/5 rounded-full blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-50 dark:bg-primary-950/50 border border-primary-200 dark:border-primary-800 rounded-full mb-6">
              <span className="w-2 h-2 bg-success-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-primary-700 dark:text-primary-300">AI-Powered Productivity & Finance</span>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 dark:text-white leading-tight tracking-tight">
              Organize your day.
              <br />
              <span className="bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">
                Transform your life.
              </span>
            </h1>
            <p className="mt-6 text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
              DayPerDay AI helps you plan daily, track finances, set 90-day goals, and improve with
              AI-powered insights. For individuals and businesses alike.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button onClick={() => navigate('/signup')} className="btn-primary text-base px-6 py-3 w-full sm:w-auto">
                Start Free Today <ArrowRight size={18} />
              </button>
              <button onClick={() => navigate('/login')} className="btn-secondary text-base px-6 py-3 w-full sm:w-auto">
                I have an account
              </button>
            </div>
          </div>

          {/* Dashboard preview */}
          <div className="mt-16 relative max-w-5xl mx-auto">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-500/20 to-secondary-500/20 blur-3xl rounded-3xl" />
            <div className="relative card p-6 rounded-3xl">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Today's Tasks", value: '8', icon: Sun, color: 'text-primary-500' },
                  { label: 'Completion', value: '75%', icon: Check, color: 'text-success-500' },
                  { label: 'Income (Month)', value: 'RWF 1.2M', icon: TrendingUp, color: 'text-secondary-500' },
                  { label: 'Goal Progress', value: '42%', icon: Target, color: 'text-accent-500' },
                ].map((stat, i) => (
                  <div key={i} className="card p-4">
                    <stat.icon size={20} className={stat.color} />
                    <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{stat.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 h-40 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-850 rounded-xl flex items-end gap-2 p-4">
                {[40, 65, 50, 80, 55, 90, 70].map((h, i) => (
                  <div key={i} className="flex-1 bg-gradient-to-t from-primary-500 to-primary-300 rounded-t-md" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-slate-50 dark:bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
              Everything you need to grow
            </h2>
            <p className="mt-4 text-slate-600 dark:text-slate-400">
              Eight powerful modules working together to help you become more productive and financially aware.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <div key={i} className="card card-hover p-6 rounded-2xl">
                <div className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-950/50 flex items-center justify-center mb-4">
                  <f.icon size={24} className="text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="card p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-slate-50 to-primary-50/30 dark:from-slate-900 dark:to-primary-950/20">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="font-display text-3xl font-bold text-slate-900 dark:text-white mb-4">
                  A simple daily rhythm
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  Success isn't about one big push — it's about consistent daily actions. DayPerDay AI
                  guides you through a proven cycle.
                </p>
                <ul className="space-y-3">
                  {plans.map((p, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-success-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check size={12} className="text-white" />
                      </div>
                      <span className="text-slate-700 dark:text-slate-300">{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-4">
                {[
                  { time: '06:00', title: 'Plan Your Day', desc: 'Create your task list with priorities and time slots', color: 'bg-primary-500' },
                  { time: 'Daytime', title: 'Execute & Track', desc: 'Complete tasks and record transactions as they happen', color: 'bg-secondary-500' },
                  { time: 'Evening', title: 'Review & Reflect', desc: 'Assess what worked, what didn\'t, and plan improvements', color: 'bg-accent-500' },
                ].map((s, i) => (
                  <div key={i} className="flex gap-4 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className={`w-12 h-12 ${s.color} rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}>
                      {s.time}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white text-sm">{s.title}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
            Ready to take control of your days?
          </h2>
          <p className="mt-4 text-slate-600 dark:text-slate-400">
            Join DayPerDay AI and start building better habits today. It's free to get started.
          </p>
          <button onClick={() => navigate('/signup')} className="mt-8 btn-primary text-base px-8 py-3.5">
            Create Your Account <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo size="sm" />
          <p className="text-sm text-slate-500 dark:text-slate-400">© 2026 DayPerDay AI. Built for growth.</p>
        </div>
      </footer>
    </div>
  );
}
