import { useState, useEffect, useCallback } from 'react';
import { Bell, Check, Trash2, Info, AlertCircle, Trophy, FileText, Calendar } from 'lucide-react';
import { supabase, Notification } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/lib/utils';
import EmptyState from '@/components/ui/EmptyState';

export default function Notifications() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const loadData = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });
    setNotifications(data as Notification[] || []);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function markAsRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  }

  async function markAllRead() {
    if (!profile) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id).eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    showToast('All notifications marked as read', 'success');
  }

  async function deleteNotification(id: string) {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  const filtered = filter === 'all' ? notifications : notifications.filter((n) => !n.is_read);
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const typeIcons = {
    reminder: Calendar,
    achievement: Trophy,
    report: FileText,
    info: Info,
    ai: AlertCircle,
  };

  const typeColors = {
    reminder: 'text-primary-500 bg-primary-50 dark:bg-primary-950/20',
    achievement: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-950/20',
    report: 'text-secondary-500 bg-secondary-50 dark:bg-secondary-950/20',
    info: 'text-slate-500 bg-slate-100 dark:bg-slate-800',
    ai: 'text-accent-500 bg-accent-50 dark:bg-accent-950/20',
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-950/20 flex items-center justify-center">
              <Bell size={20} className="text-primary-500" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">Notifications</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {unreadCount} unread of {notifications.length} total
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilter(filter === 'all' ? 'unread' : 'all')}
              className="btn-secondary text-sm"
            >
              {filter === 'all' ? 'Show Unread' : 'Show All'}
            </button>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="btn-ghost text-sm">
                <Check size={16} /> Mark all read
              </button>
            )}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-6">
          <EmptyState
            icon={Bell}
            title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            description={filter === 'unread' ? 'You\'re all caught up!' : 'Notifications about your plans, reviews, and achievements will appear here.'}
          />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((notif) => {
            const Icon = typeIcons[notif.notification_type] || Info;
            const colorClass = typeColors[notif.notification_type] || typeColors.info;
            return (
              <div
                key={notif.id}
                className={`card p-4 flex items-start gap-3 ${notif.is_read ? 'opacity-70' : ''}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{notif.title}</h4>
                    {!notif.is_read && <span className="w-2 h-2 rounded-full bg-primary-500" />}
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{notif.message}</p>
                  <p className="text-xs text-slate-400 mt-1">{formatDate(notif.created_at)}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!notif.is_read && (
                    <button
                      onClick={() => markAsRead(notif.id)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-success-500"
                      title="Mark as read"
                    >
                      <Check size={15} />
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotification(notif.id)}
                    className="p-1.5 rounded-lg hover:bg-error-50 dark:hover:bg-error-950/30 text-slate-400 hover:text-error-500"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
