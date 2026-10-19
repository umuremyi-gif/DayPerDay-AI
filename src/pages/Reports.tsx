import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, Download, Calendar, FileText, Loader2, Sparkles,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { supabase, Transaction, Report, Task } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency, formatDate, toCSV, downloadCSV } from '@/lib/utils';
import EmptyState from '@/components/ui/EmptyState';

type Period = 'daily' | 'weekly' | 'monthly' | 'custom';

export default function Reports() {
  const { profile, preferences } = useAuth();
  const { showToast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [period, setPeriod] = useState<Period>('monthly');
  const [customStart, setCustomStart] = useState(new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]);
  const [customEnd, setCustomEnd] = useState(new Date().toISOString().split('T')[0]);

  const loadData = useCallback(async () => {
    if (!profile) return;
    const [txRes, repRes, taskRes] = await Promise.all([
      supabase.from('transactions').select('*').eq('user_id', profile.id).order('transaction_date', { ascending: true }),
      supabase.from('reports').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }),
      supabase.from('tasks').select('*').eq('user_id', profile.id),
    ]);
    setTransactions(txRes.data as Transaction[] || []);
    setReports(repRes.data as Report[] || []);
    setTasks(taskRes.data as Task[] || []);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function getPeriodRange(): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date();
    switch (period) {
      case 'daily':
        return { start: new Date(), end: new Date() };
      case 'weekly':
        start.setDate(start.getDate() - 7);
        return { start, end };
      case 'monthly':
        start.setMonth(start.getMonth() - 1);
        return { start, end };
      case 'custom':
        return { start: new Date(customStart), end: new Date(customEnd) };
    }
  }

  const { start, end } = getPeriodRange();
  const periodTx = transactions.filter((t) => {
    const d = new Date(t.transaction_date);
    return d >= start && d <= end;
  });

  const income = periodTx.filter((t) => t.transaction_type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = periodTx.filter((t) => t.transaction_type === 'expense').reduce((s, t) => s + t.amount, 0);
  const netCashFlow = income - expenses;
  const savingsContrib = periodTx.filter((t) => t.transaction_type === 'savings_contribution').reduce((s, t) => s + t.amount, 0);
  const savingsWithdraw = periodTx.filter((t) => t.transaction_type === 'savings_withdrawal').reduce((s, t) => s + t.amount, 0);
  const savingsBalance = savingsContrib - savingsWithdraw;

  // Category breakdown
  const expenseByCategory: Record<string, number> = {};
  periodTx.filter((t) => t.transaction_type === 'expense').forEach((t) => {
    expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + t.amount;
  });
  const categoryData = Object.entries(expenseByCategory).map(([name, value]) => ({ name, value }));

  // Daily trend
  const dailyData: { date: string; income: number; expenses: number }[] = [];
  const days = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const dayTx = periodTx.filter((t) => t.transaction_date === dateStr);
    dailyData.push({
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      income: dayTx.filter((t) => t.transaction_type === 'income').reduce((s, t) => s + t.amount, 0),
      expenses: dayTx.filter((t) => t.transaction_type === 'expense').reduce((s, t) => s + t.amount, 0),
    });
  }

  // Task stats
  const periodTasks = tasks.filter((t) => {
    const d = new Date(t.created_at);
    return d >= start && d <= end;
  });
  const tasksCompleted = periodTasks.filter((t) => t.completed).length;

  function handleExport() {
    const data = periodTx.map((t) => ({
      Date: t.transaction_date,
      Type: t.transaction_type,
      Amount: t.amount,
      Category: t.category,
      Description: t.description,
      PaymentMethod: t.payment_method,
    }));
    const csv = toCSV(data, ['Date', 'Type', 'Amount', 'Category', 'Description', 'PaymentMethod']);
    downloadCSV(csv, `report-${period}-${new Date().toISOString().split('T')[0]}.csv`);
    showToast('Report exported', 'success');
  }

  async function generateReport() {
    if (!profile) return;
    setGenerating(true);

    const content = `Period: ${formatDate(start)} to ${formatDate(end)}\n\n` +
      `Income: ${formatCurrency(income, preferences?.currency)}\n` +
      `Expenses: ${formatCurrency(expenses, preferences?.currency)}\n` +
      `Net Cash Flow: ${formatCurrency(netCashFlow, preferences?.currency)}\n` +
      `Savings Balance: ${formatCurrency(savingsBalance, preferences?.currency)}\n` +
      `Tasks Completed: ${tasksCompleted}/${periodTasks.length}\n`;

    let aiAnalysis = '';

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/ai/financial-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: profile.id,
          period: { start: start.toISOString(), end: end.toISOString() },
          summary: { income, expenses, netCashFlow, savingsBalance, tasksCompleted, totalTasks: periodTasks.length },
          preferred_language: preferences?.preferred_language || 'automatic',
        }),
      });
      if (response.ok) {
        const result = await response.json();
        aiAnalysis = result.analysis || '';
      }
    } catch {
      // AI unavailable
    }

    await supabase.from('reports').insert({
      user_id: profile.id,
      report_type: period,
      title: `${period.charAt(0).toUpperCase() + period.slice(1)} Report - ${formatDate(start)}`,
      content,
      period_start: start.toISOString().split('T')[0],
      period_end: end.toISOString().split('T')[0],
      tasks_planned: periodTasks.length,
      tasks_completed: tasksCompleted,
      total_income: income,
      total_expenses: expenses,
      net_cash_flow: netCashFlow,
      savings_balance: savingsBalance,
      ai_analysis: aiAnalysis || null,
    });

    showToast('Report generated and saved!', 'success');
    setGenerating(false);
    await loadData();
  }

  const pieColors = ['#3385fc', '#22c55e', '#f97316', '#ef4444', '#14b8a6', '#eab308', '#8ec8ff', '#5eead4'];

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {(['daily', 'weekly', 'monthly', 'custom'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
                  period === p
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {period === 'custom' && (
              <>
                <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="input py-1.5 text-sm w-auto" />
                <span className="text-slate-400">to</span>
                <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="input py-1.5 text-sm w-auto" />
              </>
            )}
            <button onClick={handleExport} className="btn-secondary text-sm">
              <Download size={16} /> Export CSV
            </button>
            <button onClick={generateReport} disabled={generating} className="btn-primary text-sm">
              {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {generating ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Showing data from {formatDate(start)} to {formatDate(end)}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <p className="text-xs text-slate-400 mb-1">Income</p>
          <p className="text-xl font-bold text-success-600 dark:text-success-400">{formatCurrency(income, preferences?.currency)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-slate-400 mb-1">Expenses</p>
          <p className="text-xl font-bold text-error-600 dark:text-error-400">{formatCurrency(expenses, preferences?.currency)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-slate-400 mb-1">Net Cash Flow</p>
          <p className={`text-xl font-bold ${netCashFlow >= 0 ? 'text-success-600 dark:text-success-400' : 'text-error-600 dark:text-error-400'}`}>
            {formatCurrency(netCashFlow, preferences?.currency)}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-slate-400 mb-1">Savings</p>
          <p className="text-xl font-bold text-primary-600 dark:text-primary-400">{formatCurrency(savingsBalance, preferences?.currency)}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Income vs Expenses trend */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Income vs Expenses Trend</h3>
          {dailyData.every((d) => d.income === 0 && d.expenses === 0) ? (
            <EmptyState icon={TrendingUp} title="No data" description="No transactions in this period." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:opacity-20" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#fff' }}
                  formatter={(v) => formatCurrency(Number(v), preferences?.currency)}
                />
                <Legend />
                <Line type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2} name="Income" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} name="Expenses" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Expense by category */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Expenses by Category</h3>
          {categoryData.length === 0 ? (
            <EmptyState icon={FileText} title="No expenses" description="No expense transactions in this period." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={(e: any) => String(e?.name ?? '')}>
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#fff' }}
                  formatter={(v) => formatCurrency(Number(v), preferences?.currency)}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Task completion bar chart */}
      <div className="card p-6">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Task Completion</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[{ name: 'Completed', value: tasksCompleted }, { name: 'Pending', value: periodTasks.length - tasksCompleted }]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:opacity-20" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#fff' }} />
                <Bar dataKey="value" fill="#3385fc" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <p className="text-xs text-slate-400">Tasks Planned</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{periodTasks.length}</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <p className="text-xs text-slate-400">Tasks Completed</p>
              <p className="text-2xl font-bold text-success-600 dark:text-success-400">{tasksCompleted}</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <p className="text-xs text-slate-400">Completion Rate</p>
              <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                {periodTasks.length > 0 ? Math.round((tasksCompleted / periodTasks.length) * 100) : 0}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Saved reports */}
      <div className="card p-6">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Saved Reports</h3>
        {reports.length === 0 ? (
          <EmptyState icon={FileText} title="No saved reports" description="Generate a report above to save it for future reference." />
        ) : (
          <div className="space-y-3">
            {reports.slice(0, 10).map((report) => (
              <div key={report.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-primary-500" />
                    <span className="text-sm font-medium text-slate-900 dark:text-white">{report.title}</span>
                    <span className="badge text-[10px] bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 capitalize">{report.report_type}</span>
                  </div>
                  <span className="text-xs text-slate-400">{formatDate(report.created_at)}</span>
                </div>
                <div className="grid grid-cols-4 gap-3 mt-3">
                  <div>
                    <p className="text-xs text-slate-400">Income</p>
                    <p className="text-sm font-semibold text-success-600 dark:text-success-400">{formatCurrency(report.total_income || 0, preferences?.currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Expenses</p>
                    <p className="text-sm font-semibold text-error-600 dark:text-error-400">{formatCurrency(report.total_expenses || 0, preferences?.currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Net Flow</p>
                    <p className={`text-sm font-semibold ${(report.net_cash_flow || 0) >= 0 ? 'text-success-600 dark:text-success-400' : 'text-error-600 dark:text-error-400'}`}>
                      {formatCurrency(report.net_cash_flow || 0, preferences?.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Tasks</p>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{report.tasks_completed}/{report.tasks_planned}</p>
                  </div>
                </div>
                {report.ai_analysis && (
                  <div className="mt-3 p-3 rounded-lg bg-primary-50 dark:bg-primary-950/20 border border-primary-200 dark:border-primary-800">
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      <Sparkles size={12} className="inline mr-1 text-primary-500" />
                      {report.ai_analysis}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
