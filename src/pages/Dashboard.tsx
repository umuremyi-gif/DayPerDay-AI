import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays, CheckCircle2, Clock, TrendingUp, Wallet, Target,
  Trophy, ArrowRight, Sun, Moon, AlertCircle,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import { supabase, Task, Transaction, Goal, UserAchievement, Achievement } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, getGreeting, getCompletionRate, todayISO, formatDate } from '@/lib/utils';

export default function Dashboard() {
  const { profile, preferences } = useAuth();
  const navigate = useNavigate();
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [activeGoals, setActiveGoals] = useState<Goal[]>([]);
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [allAchievements, setAllAchievements] = useState<Achievement[]>([]);
  const [weekData, setWeekData] = useState<{ day: string; completed: number; planned: number }[]>([]);
  const [incomeExpenseData, setIncomeExpenseData] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!profile) return;
    const today = todayISO();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);

    const [tasksRes, txRes, goalsRes, uaRes, achRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('user_id', profile.id).order('sort_order'),
      supabase.from('transactions').select('*').eq('user_id', profile.id).order('transaction_date', { ascending: false }).limit(10),
      supabase.from('goals').select('*').eq('user_id', profile.id).eq('status', 'active').order('created_at', { ascending: false }),
      supabase.from('user_achievements').select('*').eq('user_id', profile.id),
      supabase.from('achievements').select('*'),
    ]);

    // Filter today's tasks
    const todayPlanTasks = (tasksRes.data as Task[] || []).filter((t) => {
      const taskDate = new Date(t.created_at).toISOString().split('T')[0];
      return taskDate === today;
    });
    setTodayTasks(todayPlanTasks);
    setRecentTransactions(txRes.data as Transaction[] || []);
    setActiveGoals(goalsRes.data as Goal[] || []);
    setAchievements(uaRes.data as UserAchievement[] || []);
    setAllAchievements(achRes.data as Achievement[] || []);

    // Build week data
    const weekArr: { day: string; completed: number; planned: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayTasks = (tasksRes.data as Task[] || []).filter((t) => {
        const taskDate = new Date(t.created_at).toISOString().split('T')[0];
        return taskDate === dateStr;
      });
      weekArr.push({
        day: d.toLocaleDateString('en-US', { weekday: 'short' }),
        planned: dayTasks.length,
        completed: dayTasks.filter((t) => t.completed).length,
      });
    }
    setWeekData(weekArr);

    // Income vs expense for this month
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthTx = (txRes.data as Transaction[] || []).filter(
      (t) => new Date(t.transaction_date) >= monthStart
    );
    const income = monthTx.filter((t) => t.transaction_type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenses = monthTx.filter((t) => t.transaction_type === 'expense').reduce((s, t) => s + t.amount, 0);
    setIncomeExpenseData([
      { name: 'Income', value: income },
      { name: 'Expenses', value: expenses },
    ]);

    setLoading(false);
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" /></div>;
  }

  const completedTasks = todayTasks.filter((t) => t.completed).length;
  const completionRate = getCompletionRate(completedTasks, todayTasks.length);
  const monthIncome = incomeExpenseData[0]?.value || 0;
  const monthExpenses = incomeExpenseData[1]?.value || 0;
  const netCashFlow = monthIncome - monthExpenses;

  const pieColors = ['#22c55e', '#ef4444'];

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            {getGreeting()}, {profile?.full_name?.split(' ')[0] || 'there'}!
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {formatDate(new Date(), { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button onClick={() => navigate('/planner')} className="btn-primary text-sm">
          <CalendarDays size={16} /> Plan Today
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<CheckCircle2 size={20} className="text-success-500" />}
          label="Today's Progress"
          value={`${completionRate}%`}
          sub={`${completedTasks}/${todayTasks.length} tasks done`}
          color="bg-success-50 dark:bg-success-950/20"
        />
        <StatCard
          icon={<Wallet size={20} className="text-primary-500" />}
          label="Income (Month)"
          value={formatCurrency(monthIncome, preferences?.currency)}
          sub="This month"
          color="bg-primary-50 dark:bg-primary-950/20"
        />
        <StatCard
          icon={<TrendingUp size={20} className="text-error-500" />}
          label="Expenses (Month)"
          value={formatCurrency(monthExpenses, preferences?.currency)}
          sub={netCashFlow >= 0 ? `+${formatCurrency(netCashFlow, preferences?.currency)} net` : `${formatCurrency(netCashFlow, preferences?.currency)} net`}
          color="bg-error-50 dark:bg-error-950/20"
        />
        <StatCard
          icon={<Target size={20} className="text-accent-500" />}
          label="Active Goals"
          value={`${activeGoals.length}`}
          sub={activeGoals[0]?.title || 'No goals set'}
          color="bg-accent-50 dark:bg-accent-950/20"
        />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Weekly task chart */}
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">Weekly Productivity</h3>
            <span className="badge bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400">
              Last 7 days
            </span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={weekData}>
              <defs>
                <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3385fc" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3385fc" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorPlanned" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:opacity-20" />
              <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '12px',
                  color: '#fff',
                }}
              />
              <Area type="monotone" dataKey="planned" stroke="#94a3b8" fill="url(#colorPlanned)" name="Planned" />
              <Area type="monotone" dataKey="completed" stroke="#3385fc" fill="url(#colorCompleted)" name="Completed" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Income vs Expense pie */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Income vs Expenses</h3>
          {monthIncome === 0 && monthExpenses === 0 ? (
            <div className="flex flex-col items-center justify-center h-[240px] text-center">
              <AlertCircle size={32} className="text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm text-slate-400">No transactions this month</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={incomeExpenseData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                  {incomeExpenseData.map((_, i) => (
                    <Cell key={i} fill={pieColors[i]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    color: '#fff',
                  }}
                  formatter={(v) => formatCurrency(Number(v), preferences?.currency)}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="flex justify-center gap-4 mt-2">
            <span className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <span className="w-3 h-3 rounded-full bg-success-500" /> Income
            </span>
            <span className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <span className="w-3 h-3 rounded-full bg-error-500" /> Expenses
            </span>
          </div>
        </div>
      </div>

      {/* Today's tasks + Goals */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Today's tasks */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">Today's Tasks</h3>
            <button onClick={() => navigate('/planner')} className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
              View all <ArrowRight size={14} />
            </button>
          </div>
          {todayTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Sun size={32} className="text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm text-slate-400 mb-3">No tasks planned for today yet</p>
              <button onClick={() => navigate('/planner')} className="btn-primary text-sm">
                Start Planning
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {todayTasks.slice(0, 5).map((task) => (
                <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                    task.completed
                      ? 'bg-success-500 border-success-500'
                      : 'border-slate-300 dark:border-slate-600'
                  }`}>
                    {task.completed && <CheckCircle2 size={12} className="text-white" />}
                  </div>
                  <span className={`text-sm flex-1 ${task.completed ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>
                    {task.title}
                  </span>
                  <span className={`badge text-[10px] ${
                    task.priority === 'high' ? 'bg-error-100 dark:bg-error-950/40 text-error-700 dark:text-error-400' :
                    task.priority === 'medium' ? 'bg-warning-100 dark:bg-warning-950/40 text-warning-700 dark:text-warning-400' :
                    'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    {task.priority}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Goals progress */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">90-Day Goals</h3>
            <button onClick={() => navigate('/goals')} className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
              View all <ArrowRight size={14} />
            </button>
          </div>
          {activeGoals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Target size={32} className="text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm text-slate-400 mb-3">No active goals yet</p>
              <button onClick={() => navigate('/goals')} className="btn-primary text-sm">
                Set a Goal
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {activeGoals.slice(0, 3).map((goal) => {
                const total = Math.max(1, Math.ceil((new Date(goal.end_date).getTime() - new Date(goal.start_date).getTime()) / (1000 * 60 * 60 * 24)));
                const elapsed = Math.max(0, Math.ceil((new Date().getTime() - new Date(goal.start_date).getTime()) / (1000 * 60 * 60 * 24)));
                const progress = Math.min(100, Math.round((elapsed / total) * 100));
                return (
                  <div key={goal.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{goal.title}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{progress}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Day {Math.min(elapsed, total)} of {total}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Achievements preview + Recent transactions */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">Recent Achievements</h3>
            <button onClick={() => navigate('/achievements')} className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
              View all <ArrowRight size={14} />
            </button>
          </div>
          <div className="flex gap-3 flex-wrap">
            {achievements.length === 0 ? (
              <p className="text-sm text-slate-400 py-4">No achievements earned yet. Keep going!</p>
            ) : (
              achievements.slice(0, 4).map((ua) => {
                const ach = allAchievements.find((a) => a.id === ua.achievement_id);
                if (!ach) return null;
                const tierColors = {
                  gold: 'from-yellow-400 to-yellow-600',
                  silver: 'from-gray-300 to-gray-500',
                  bronze: 'from-orange-400 to-orange-600',
                };
                return (
                  <div key={ua.id} className={`flex items-center gap-2 p-3 rounded-xl bg-gradient-to-br ${tierColors[ach.tier]} bg-opacity-10`}>
                    <Trophy size={18} className="text-white" />
                    <div>
                      <p className="text-xs font-semibold text-white">{ach.name}</p>
                      <p className="text-[10px] text-white/80 capitalize">{ach.tier}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">Recent Transactions</h3>
            <button onClick={() => navigate('/transactions')} className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
              View all <ArrowRight size={14} />
            </button>
          </div>
          {recentTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Wallet size={32} className="text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm text-slate-400 mb-3">No transactions recorded yet</p>
              <button onClick={() => navigate('/transactions')} className="btn-primary text-sm">
                Add Transaction
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentTransactions.slice(0, 5).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      tx.transaction_type === 'income' ? 'bg-success-100 dark:bg-success-950/40' :
                      tx.transaction_type === 'expense' ? 'bg-error-100 dark:bg-error-950/40' :
                      'bg-slate-100 dark:bg-slate-700'
                    }`}>
                      {tx.transaction_type === 'income' ? <TrendingUp size={16} className="text-success-600" /> :
                       tx.transaction_type === 'expense' ? <Wallet size={16} className="text-error-600" /> :
                       <Clock size={16} className="text-slate-500" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{tx.description || tx.category}</p>
                      <p className="text-xs text-slate-400">{formatDate(tx.transaction_date)}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${
                    tx.transaction_type === 'income' ? 'text-success-600 dark:text-success-400' :
                    tx.transaction_type === 'expense' ? 'text-error-600 dark:text-error-400' :
                    'text-slate-500'
                  }`}>
                    {tx.transaction_type === 'income' ? '+' : tx.transaction_type === 'expense' ? '-' : ''}{formatCurrency(tx.amount, preferences?.currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub: string; color: string }) {
  return (
    <div className="card p-5">
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</p>
      <p className="text-xs text-slate-400 mt-0.5 truncate">{sub}</p>
    </div>
  );
}
