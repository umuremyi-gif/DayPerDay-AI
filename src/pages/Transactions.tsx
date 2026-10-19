import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, Pencil, Save, Download, Wallet, ArrowUpDown,
  TrendingUp, TrendingDown, PiggyBank, Building2, Smartphone, Banknote,
} from 'lucide-react';
import { supabase, Transaction, Account } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency, formatDate, todayISO, toCSV, downloadCSV } from '@/lib/utils';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';

const txTypes = [
  { value: 'income', label: 'Income', icon: TrendingUp, color: 'text-success-500' },
  { value: 'expense', label: 'Expense', icon: TrendingDown, color: 'text-error-500' },
  { value: 'transfer', label: 'Transfer', icon: ArrowUpDown, color: 'text-slate-500' },
  { value: 'savings_contribution', label: 'Savings Deposit', icon: PiggyBank, color: 'text-primary-500' },
  { value: 'savings_withdrawal', label: 'Savings Withdrawal', icon: PiggyBank, color: 'text-warning-500' },
];

const categories = ['Salary', 'Business Revenue', 'Food', 'Transport', 'Rent', 'Utilities', 'Health', 'Education', 'Entertainment', 'Investment', 'Savings', 'Other'];
const paymentMethods = ['Cash', 'Bank Transfer', 'Mobile Money', 'Credit Card', 'Debit Card', 'Check', 'Other'];
const accountTypes = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'bank', label: 'Bank', icon: Building2 },
  { value: 'mobile_money', label: 'Mobile Money', icon: Smartphone },
  { value: 'savings', label: 'Savings', icon: PiggyBank },
];

export default function Transactions() {
  const { profile, preferences } = useAuth();
  const { showToast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTxModal, setShowTxModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const loadData = useCallback(async () => {
    if (!profile) return;
    const [txRes, accRes] = await Promise.all([
      supabase.from('transactions').select('*').eq('user_id', profile.id).order('transaction_date', { ascending: false }),
      supabase.from('accounts').select('*').eq('user_id', profile.id).order('created_at'),
    ]);
    setTransactions(txRes.data as Transaction[] || []);
    setAccounts(accRes.data as Account[] || []);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function saveTx(txData: Partial<Transaction>, id?: string) {
    if (!profile) return;
    if (id) {
      const { data } = await supabase.from('transactions').update(txData).eq('id', id).select().single();
      setTransactions((prev) => prev.map((t) => (t.id === id ? data as Transaction : t)));
      showToast('Transaction updated', 'success');
    } else {
      const { data } = await supabase.from('transactions').insert({ ...txData, user_id: profile.id }).select().single();
      setTransactions((prev) => [data as Transaction, ...prev]);
      showToast('Transaction added', 'success');

      // Update account balance
      if (data && (data as Transaction).account_id) {
        await updateAccountBalance((data as Transaction).account_id!);
      }
    }
    setShowTxModal(false);
    setEditingTx(null);
    await loadData();
  }

  async function updateAccountBalance(accountId: string) {
    const { data: txs } = await supabase
      .from('transactions')
      .select('transaction_type, amount, account_id, to_account_id')
      .eq('account_id', accountId)
      .or(`to_account_id.eq.${accountId}`);

    let balance = 0;
    for (const tx of txs || []) {
      if (tx.account_id === accountId) {
        if (tx.transaction_type === 'income' || tx.transaction_type === 'savings_withdrawal') balance += tx.amount;
        else if (tx.transaction_type === 'expense' || tx.transaction_type === 'savings_contribution') balance -= tx.amount;
        else if (tx.transaction_type === 'transfer') balance -= tx.amount;
      }
      if (tx.to_account_id === accountId && tx.transaction_type === 'transfer') {
        balance += tx.amount;
      }
    }

    await supabase.from('accounts').update({ balance }).eq('id', accountId);
  }

  async function deleteTx(id: string) {
    const tx = transactions.find((t) => t.id === id);
    await supabase.from('transactions').delete().eq('id', id);
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    if (tx?.account_id) await updateAccountBalance(tx.account_id);
    await loadData();
    showToast('Transaction deleted', 'info');
  }

  async function saveAccount(accData: Partial<Account>, id?: string) {
    if (!profile) return;
    if (id) {
      await supabase.from('accounts').update(accData).eq('id', id);
      showToast('Account updated', 'success');
    } else {
      await supabase.from('accounts').insert({ ...accData, user_id: profile.id });
      showToast('Account added', 'success');
    }
    setShowAccountModal(false);
    await loadData();
  }

  function handleExport() {
    const data = transactions.map((t) => ({
      Date: t.transaction_date,
      Type: t.transaction_type,
      Amount: t.amount,
      Category: t.category,
      Description: t.description,
      PaymentMethod: t.payment_method,
      Reference: t.reference || '',
      Notes: t.notes,
    }));
    const csv = toCSV(data, ['Date', 'Type', 'Amount', 'Category', 'Description', 'PaymentMethod', 'Reference', 'Notes']);
    downloadCSV(csv, `transactions-${todayISO()}.csv`);
    showToast('Transactions exported', 'success');
  }

  const filteredTx = filter === 'all' ? transactions : transactions.filter((t) => t.transaction_type === filter);

  // Calculate totals
  const totalIncome = transactions.filter((t) => t.transaction_type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = transactions.filter((t) => t.transaction_type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalSavings = transactions.filter((t) => t.transaction_type === 'savings_contribution').reduce((s, t) => s + t.amount, 0)
    - transactions.filter((t) => t.transaction_type === 'savings_withdrawal').reduce((s, t) => s + t.amount, 0);
  const netCashFlow = totalIncome - totalExpenses;

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="w-10 h-10 rounded-xl bg-success-50 dark:bg-success-950/20 flex items-center justify-center mb-3">
            <TrendingUp size={20} className="text-success-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalIncome, preferences?.currency)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Total Income</p>
        </div>
        <div className="card p-5">
          <div className="w-10 h-10 rounded-xl bg-error-50 dark:bg-error-950/20 flex items-center justify-center mb-3">
            <TrendingDown size={20} className="text-error-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalExpenses, preferences?.currency)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Total Expenses</p>
        </div>
        <div className="card p-5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${netCashFlow >= 0 ? 'bg-primary-50 dark:bg-primary-950/20' : 'bg-warning-50 dark:bg-warning-950/20'}`}>
            <Wallet size={20} className={netCashFlow >= 0 ? 'text-primary-500' : 'text-warning-500'} />
          </div>
          <p className={`text-2xl font-bold ${netCashFlow >= 0 ? 'text-success-600 dark:text-success-400' : 'text-error-600 dark:text-error-400'}`}>
            {netCashFlow >= 0 ? '+' : ''}{formatCurrency(netCashFlow, preferences?.currency)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Net Cash Flow</p>
        </div>
        <div className="card p-5">
          <div className="w-10 h-10 rounded-xl bg-secondary-50 dark:bg-secondary-950/20 flex items-center justify-center mb-3">
            <PiggyBank size={20} className="text-secondary-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalSavings, preferences?.currency)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Savings Balance</p>
        </div>
      </div>

      {/* Accounts */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 dark:text-white">Accounts</h3>
          <button onClick={() => setShowAccountModal(true)} className="btn-secondary text-sm">
            <Plus size={16} /> Add Account
          </button>
        </div>
        {accounts.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No accounts yet. Add one to track balances.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {accounts.map((acc) => {
              const typeInfo = accountTypes.find((t) => t.value === acc.account_type);
              const Icon = typeInfo?.icon || Banknote;
              return (
                <div key={acc.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-950/30 flex items-center justify-center">
                      <Icon size={16} className="text-primary-600 dark:text-primary-400" />
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{typeInfo?.label}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{acc.name}</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">{formatCurrency(acc.balance, acc.currency)}</p>
                  {acc.provider && <p className="text-xs text-slate-400 mt-0.5">{acc.provider}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transactions list */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="font-semibold text-slate-900 dark:text-white">Transaction History</h3>
          <div className="flex items-center gap-2">
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input py-2 text-sm w-auto">
              <option value="all">All Types</option>
              {txTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <button onClick={handleExport} className="btn-secondary text-sm">
              <Download size={16} /> Export
            </button>
            <button onClick={() => { setEditingTx(null); setShowTxModal(true); }} className="btn-primary text-sm">
              <Plus size={16} /> Add
            </button>
          </div>
        </div>

        {filteredTx.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No transactions yet"
            description="Record your first income or expense to start tracking your finances."
            action={<button onClick={() => setShowTxModal(true)} className="btn-primary text-sm"><Plus size={16} /> Add Transaction</button>}
          />
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">Description</th>
                  <th className="pb-3 font-medium">Category</th>
                  <th className="pb-3 font-medium text-right">Amount</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTx.map((tx) => {
                  const typeInfo = txTypes.find((t) => t.value === tx.transaction_type);
                  return (
                    <tr key={tx.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="py-3 text-slate-500 dark:text-slate-400 text-xs">{formatDate(tx.transaction_date)}</td>
                      <td className="py-3">
                        <span className={`badge text-[10px] ${
                          tx.transaction_type === 'income' ? 'bg-success-100 dark:bg-success-950/40 text-success-700 dark:text-success-400' :
                          tx.transaction_type === 'expense' ? 'bg-error-100 dark:bg-error-950/40 text-error-700 dark:text-error-400' :
                          tx.transaction_type === 'transfer' ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' :
                          'bg-primary-100 dark:bg-primary-950/40 text-primary-700 dark:text-primary-400'
                        }`}>
                          {typeInfo?.label || tx.transaction_type}
                        </span>
                      </td>
                      <td className="py-3 text-slate-700 dark:text-slate-200">{tx.description || tx.category}</td>
                      <td className="py-3 text-slate-500 dark:text-slate-400 text-xs">{tx.category}</td>
                      <td className={`py-3 text-right font-semibold ${
                        tx.transaction_type === 'income' || tx.transaction_type === 'savings_withdrawal' ? 'text-success-600 dark:text-success-400' :
                        tx.transaction_type === 'expense' || tx.transaction_type === 'savings_contribution' ? 'text-error-600 dark:text-error-400' :
                        'text-slate-600 dark:text-slate-300'
                      }`}>
                        {tx.transaction_type === 'income' || tx.transaction_type === 'savings_withdrawal' ? '+' :
                         tx.transaction_type === 'expense' || tx.transaction_type === 'savings_contribution' ? '-' : ''}
                        {formatCurrency(tx.amount, preferences?.currency)}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => { setEditingTx(tx); setShowTxModal(true); }}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-primary-500"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => deleteTx(tx.id)}
                            className="p-1.5 rounded-lg hover:bg-error-50 dark:hover:bg-error-950/30 text-slate-400 hover:text-error-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showTxModal && (
        <TransactionModal
          tx={editingTx}
          accounts={accounts}
          onClose={() => { setShowTxModal(false); setEditingTx(null); }}
          onSave={saveTx}
        />
      )}
      {showAccountModal && (
        <AccountModal onClose={() => setShowAccountModal(false)} onSave={saveAccount} />
      )}
    </div>
  );
}

function TransactionModal({
  tx, accounts, onClose, onSave,
}: {
  tx: Transaction | null;
  accounts: Account[];
  onClose: () => void;
  onSave: (data: Partial<Transaction>, id?: string) => void;
}) {
  const [form, setForm] = useState<Partial<Transaction>>(
    tx || {
      transaction_type: 'income',
      amount: 0,
      category: 'Other',
      description: '',
      payment_method: 'Cash',
      transaction_date: todayISO(),
      notes: '',
    }
  );

  return (
    <Modal isOpen={true} onClose={onClose} title={tx ? 'Edit Transaction' : 'Add Transaction'} size="md">
      <div className="space-y-4">
        <div>
          <label className="label">Transaction Type</label>
          <div className="grid grid-cols-2 gap-2">
            {txTypes.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, transaction_type: t.value as Transaction['transaction_type'] }))}
                className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-sm transition-all ${
                  form.transaction_type === t.value
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <t.icon size={16} className={t.color} />
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Amount</label>
            <input
              type="number"
              step="0.01"
              value={form.amount || 0}
              onChange={(e) => setForm((prev) => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
              className="input"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="label">Date</label>
            <input
              type="date"
              value={form.transaction_date as string}
              onChange={(e) => setForm((prev) => ({ ...prev, transaction_date: e.target.value }))}
              className="input"
            />
          </div>
        </div>
        <div>
          <label className="label">Description</label>
          <input
            value={form.description as string}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            className="input"
            placeholder="What was this transaction for?"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Category</label>
            <select value={form.category as string} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} className="input">
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Payment Method</label>
            <select value={form.payment_method as string} onChange={(e) => setForm((prev) => ({ ...prev, payment_method: e.target.value }))} className="input">
              {paymentMethods.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        {accounts.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Account</label>
              <select value={form.account_id as string || ''} onChange={(e) => setForm((prev) => ({ ...prev, account_id: e.target.value || null }))} className="input">
                <option value="">Select account</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            {form.transaction_type === 'transfer' && (
              <div>
                <label className="label">To Account</label>
                <select value={form.to_account_id as string || ''} onChange={(e) => setForm((prev) => ({ ...prev, to_account_id: e.target.value || null }))} className="input">
                  <option value="">Select account</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}
          </div>
        )}
        <div>
          <label className="label">Reference (optional)</label>
          <input
            value={form.reference as string || ''}
            onChange={(e) => setForm((prev) => ({ ...prev, reference: e.target.value }))}
            className="input"
            placeholder="Transaction reference number"
          />
        </div>
        <div>
          <label className="label">Notes (optional)</label>
          <textarea
            value={form.notes as string || ''}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            rows={2}
            className="input resize-none"
            placeholder="Additional notes..."
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={() => onSave(form, tx?.id)}
            disabled={!form.amount || form.amount <= 0}
            className="btn-primary"
          >
            <Save size={16} /> {tx ? 'Update' : 'Add'} Transaction
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AccountModal({ onClose, onSave }: { onClose: () => void; onSave: (data: Partial<Account>, id?: string) => void }) {
  const [form, setForm] = useState<Partial<Account>>({
    name: '',
    account_type: 'cash',
    balance: 0,
    currency: 'RWF',
    provider: '',
  });

  return (
    <Modal isOpen={true} onClose={onClose} title="Add Account" size="sm">
      <div className="space-y-4">
        <div>
          <label className="label">Account Name</label>
          <input value={form.name as string} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} className="input" placeholder="e.g. Main Bank Account" />
        </div>
        <div>
          <label className="label">Account Type</label>
          <div className="grid grid-cols-2 gap-2">
            {accountTypes.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, account_type: t.value as Account['account_type'] }))}
                className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-sm transition-all ${
                  form.account_type === t.value
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <t.icon size={16} className="text-primary-500" />
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Provider (optional)</label>
          <input value={form.provider as string || ''} onChange={(e) => setForm((prev) => ({ ...prev, provider: e.target.value }))} className="input" placeholder="e.g. Bank of Kigali, MTN" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Initial Balance</label>
            <input type="number" step="0.01" value={form.balance as number} onChange={(e) => setForm((prev) => ({ ...prev, balance: parseFloat(e.target.value) || 0 }))} className="input" />
          </div>
          <div>
            <label className="label">Currency</label>
            <select value={form.currency as string} onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))} className="input">
              {['RWF', 'USD', 'EUR', 'KES', 'UGX'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => onSave(form)} disabled={!form.name} className="btn-primary">
            <Save size={16} /> Add Account
          </button>
        </div>
      </div>
    </Modal>
  );
}
