import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, CheckCircle2, Circle, GripVertical, Clock,
  Flag, Calendar, Pencil, X, Save,
} from 'lucide-react';
import { supabase, DailyPlan, Task } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRedAlert } from '@/contexts/RedAlertContext';
import { useToast } from '@/components/ui/Toast';
import { todayISO, getCompletionRate } from '@/lib/utils';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';

const categories = ['Work', 'Personal', 'Health', 'Finance', 'Learning', 'Business', 'Family', 'Other'];
const priorities = ['low', 'medium', 'high'] as const;

export default function DailyPlanner() {
  const { profile } = useAuth();
  const { refreshAlert } = useRedAlert();
  const { showToast } = useToast();
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [planNotes, setPlanNotes] = useState('');

  const loadData = useCallback(async () => {
    if (!profile) return;
    const today = todayISO();

    let { data: existingPlan } = await supabase
      .from('daily_plans')
      .select('*')
      .eq('user_id', profile.id)
      .eq('plan_date', today)
      .maybeSingle();

    if (!existingPlan) {
      const { data: newPlan } = await supabase
        .from('daily_plans')
        .insert({ user_id: profile.id, plan_date: today })
        .select()
        .single();
      existingPlan = newPlan as DailyPlan;
      await refreshAlert();
    }

    setPlan(existingPlan as DailyPlan);
    setPlanNotes(existingPlan?.notes || '');

    if (existingPlan) {
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('plan_id', existingPlan.id)
        .order('sort_order');
      setTasks(tasksData as Task[] || []);

      // Create initial 6 empty task rows if no tasks
      if (!tasksData || tasksData.length === 0) {
        const initialTasks: Partial<Task>[] = [];
        for (let i = 0; i < 6; i++) {
          initialTasks.push({
            plan_id: existingPlan.id,
            user_id: profile.id,
            title: '',
            sort_order: i,
            category: 'general',
          });
        }
        const { data: created } = await supabase
          .from('tasks')
          .insert(initialTasks)
          .select()
          .order('sort_order');
        setTasks(created as Task[] || []);
      }
    }

    setLoading(false);
  }, [profile, refreshAlert]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function toggleTaskComplete(task: Task) {
    const completed = !task.completed;
    const { data } = await supabase
      .from('tasks')
      .update({ completed, completed_at: completed ? new Date().toISOString() : null })
      .eq('id', task.id)
      .select()
      .single();
    if (data) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? data as Task : t)));
      if (completed) showToast('Task completed!', 'success');
    }
  }

  async function updateTask(id: string, updates: Partial<Task>) {
    const { data } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (data) {
      setTasks((prev) => prev.map((t) => (t.id === id ? data as Task : t)));
    }
  }

  async function deleteTask(id: string) {
    await supabase.from('tasks').delete().eq('id', id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    showToast('Task deleted', 'info');
  }

  async function addTask() {
    if (!plan) return;
    const sortOrder = tasks.length;
    const { data } = await supabase
      .from('tasks')
      .insert({ plan_id: plan.id, user_id: profile?.id, title: '', sort_order: sortOrder })
      .select()
      .single();
    if (data) {
      setTasks((prev) => [...prev, data as Task]);
    }
  }

  async function savePlanNotes() {
    if (!plan) return;
    await supabase.from('daily_plans').update({ notes: planNotes }).eq('id', plan.id);
    showToast('Notes saved', 'success');
  }

  const completedCount = tasks.filter((t) => t.completed).length;
  const completionRate = getCompletionRate(completedCount, tasks.length);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header with progress */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Kora list y'uburyo umunsi wawe ugenda — Plan how your day goes
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{completionRate}%</p>
              <p className="text-xs text-slate-400">{completedCount}/{tasks.length} done</p>
            </div>
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="6" className="text-slate-200 dark:text-slate-700" />
                <circle
                  cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="6"
                  className="text-primary-500 transition-all duration-500"
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * (1 - completionRate / 100)}`}
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>
        <div className="mt-4 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full transition-all duration-500" style={{ width: `${completionRate}%` }} />
        </div>
      </div>

      {/* Tasks list */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 dark:text-white">Tasks</h3>
          <button onClick={addTask} className="btn-primary text-sm">
            <Plus size={16} /> Add Task
          </button>
        </div>

        {tasks.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No tasks yet"
            description="Start by adding your first task for today."
            action={<button onClick={addTask} className="btn-primary text-sm"><Plus size={16} /> Add Task</button>}
          />
        ) : (
          <div className="space-y-2">
            {tasks.map((task, index) => (
              <TaskRow
                key={task.id}
                task={task}
                index={index}
                onToggle={() => toggleTaskComplete(task)}
                onEdit={() => { setEditingTask(task); setShowTaskModal(true); }}
                onDelete={() => deleteTask(task.id)}
                onQuickEdit={(title) => updateTask(task.id, { title })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="card p-6">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Daily Notes</h3>
        <textarea
          value={planNotes}
          onChange={(e) => setPlanNotes(e.target.value)}
          onBlur={savePlanNotes}
          rows={3}
          className="input resize-none"
          placeholder="Add any notes about your day..."
        />
      </div>

      {/* Task edit modal */}
      {showTaskModal && editingTask && (
        <TaskEditModal
          task={editingTask}
          onClose={() => { setShowTaskModal(false); setEditingTask(null); }}
          onSave={(updates) => {
            updateTask(editingTask.id, updates);
            setShowTaskModal(false);
            setEditingTask(null);
            showToast('Task saved', 'success');
          }}
        />
      )}
    </div>
  );
}

function TaskRow({
  task, onToggle, onEdit, onDelete, onQuickEdit,
}: {
  task: Task;
  index: number;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onQuickEdit: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);

  const priorityColors = {
    high: 'bg-error-100 dark:bg-error-950/40 text-error-700 dark:text-error-400 border-error-200 dark:border-error-800',
    medium: 'bg-warning-100 dark:bg-warning-950/40 text-warning-700 dark:text-warning-400 border-warning-200 dark:border-warning-800',
    low: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600',
  };

  return (
    <div className={`group flex items-center gap-3 p-3 rounded-xl border transition-all ${
      task.completed
        ? 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800'
        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-primary-300 dark:hover:border-primary-700'
    }`}>
      <button onClick={onToggle} className="flex-shrink-0">
        {task.completed ? (
          <CheckCircle2 size={22} className="text-success-500" />
        ) : (
          <Circle size={22} className="text-slate-300 dark:text-slate-600 hover:text-primary-500 transition-colors" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => { setEditing(false); if (title !== task.title) onQuickEdit(title); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { setEditing(false); if (title !== task.title) onQuickEdit(title); } }}
            className="input py-1 text-sm"
          />
        ) : (
          <div
            onClick={() => setEditing(true)}
            className={`text-sm cursor-text ${task.completed ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}
          >
            {task.title || <span className="text-slate-400 italic">Click to add task title...</span>}
          </div>
        )}
        <div className="flex items-center gap-2 mt-1">
          {task.start_time && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Clock size={11} /> {task.start_time}{task.end_time ? ` - ${task.end_time}` : ''}
            </span>
          )}
          {task.category && task.category !== 'general' && (
            <span className="text-xs text-slate-400">{task.category}</span>
          )}
        </div>
      </div>

      <span className={`badge text-[10px] border ${priorityColors[task.priority]}`}>
        <Flag size={9} /> {task.priority}
      </span>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-primary-500">
          <Pencil size={15} />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-error-50 dark:hover:bg-error-950/30 text-slate-400 hover:text-error-500">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

function TaskEditModal({
  task, onClose, onSave,
}: {
  task: Task;
  onClose: () => void;
  onSave: (updates: Partial<Task>) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [priority, setPriority] = useState<Task['priority']>(task.priority);
  const [startTime, setStartTime] = useState(task.start_time || '');
  const [endTime, setEndTime] = useState(task.end_time || '');
  const [duration, setDuration] = useState(task.estimated_duration_minutes);
  const [category, setCategory] = useState(task.category);
  const [deadline, setDeadline] = useState(task.deadline || '');
  const [notes, setNotes] = useState(task.notes);

  return (
    <Modal isOpen={true} onClose={onClose} title="Edit Task" size="lg">
      <div className="space-y-4">
        <div>
          <label className="label">Task Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="What do you need to do?" />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="input resize-none" placeholder="Add details..." />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as Task['priority'])} className="input">
              {priorities.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Start Time</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">End Time</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Estimated Duration (min)</label>
            <input type="number" value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 0)} className="input" />
          </div>
          <div>
            <label className="label">Deadline</label>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="input" />
          </div>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input resize-none" placeholder="Additional notes..." />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={() => onSave({
              title, description, priority, category,
              start_time: startTime || null,
              end_time: endTime || null,
              estimated_duration_minutes: duration,
              deadline: deadline || null,
              notes,
            })}
            className="btn-primary"
          >
            <Save size={16} /> Save Task
          </button>
        </div>
      </div>
    </Modal>
  );
}
