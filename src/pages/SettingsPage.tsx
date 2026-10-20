import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon, User, Building2, Moon, Sun, Bell, Clock,
  Cpu, Save, Globe, DollarSign, Brain, CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react';
import { supabase, Profile, UserPreferences } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/components/ui/Toast';

const timezones = [
  'Africa/Kigali', 'Africa/Nairobi', 'Africa/Kampala', 'Africa/Dar_es_Salaam',
  'Africa/Lagos', 'Africa/Johannesburg', 'Europe/London', 'Europe/Paris',
  'America/New_York', 'America/Los_Angeles', 'Asia/Dubai', 'Asia/Tokyo',
  'UTC',
];

const currencies = ['RWF', 'USD', 'EUR', 'KES', 'UGX'];

export default function SettingsPage() {
  const { profile, preferences, refreshProfile, refreshPreferences } = useAuth();
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();
  const [profileForm, setProfileForm] = useState<Partial<Profile>>({});
  const [prefForm, setPrefForm] = useState<Partial<UserPreferences>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<'idle' | 'checking' | 'online' | 'offline'>('idle');

  useEffect(() => {
    if (profile) {
      setProfileForm({
        full_name: profile.full_name,
        account_type: profile.account_type,
        business_name: profile.business_name,
        timezone: profile.timezone,
      });
    }
  }, [profile]);

  useEffect(() => {
    if (preferences) {
      setPrefForm({
        planning_time: preferences.planning_time,
        review_time: preferences.review_time,
        currency: preferences.currency,
        notifications_enabled: preferences.notifications_enabled,
        browser_notifications_enabled: preferences.browser_notifications_enabled,
        ollama_endpoint: preferences.ollama_endpoint,
        ollama_model: preferences.ollama_model,
        preferred_language: preferences.preferred_language || 'automatic',
      });
    }
  }, [preferences]);

  async function saveProfile() {
    if (!profile) return;
    setSavingProfile(true);
    const { error } = await supabase.from('profiles').update({
      full_name: profileForm.full_name,
      account_type: profileForm.account_type,
      business_name: profileForm.business_name,
      timezone: profileForm.timezone,
    }).eq('id', profile.id);
    setSavingProfile(false);
    if (error) {
      showToast('Failed to save profile', 'error');
    } else {
      showToast('Profile saved', 'success');
      await refreshProfile();
    }
  }

  async function savePrefs() {
    if (!profile) return;
    setSavingPrefs(true);
    const { error } = await supabase.from('user_preferences').update({
      planning_time: prefForm.planning_time,
      review_time: prefForm.review_time,
      currency: prefForm.currency,
      notifications_enabled: prefForm.notifications_enabled,
      browser_notifications_enabled: prefForm.browser_notifications_enabled,
      ollama_endpoint: prefForm.ollama_endpoint,
      ollama_model: prefForm.ollama_model,
      preferred_language: prefForm.preferred_language,
    }).eq('id', profile.id);
    setSavingPrefs(false);
    if (error) {
      showToast('Failed to save preferences', 'error');
    } else {
      showToast('Preferences saved', 'success');
      await refreshPreferences();
    }
  }

  async function checkOllama() {
    setOllamaStatus('checking');
    try {
      const endpoint = prefForm.ollama_endpoint || 'http://localhost:11434';
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/ai/status`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        setOllamaStatus(data.available ? 'online' : 'offline');
      } else {
        setOllamaStatus('offline');
      }
    } catch {
      setOllamaStatus('offline');
    }
  }

  async function requestBrowserNotifications() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setPrefForm((prev) => ({ ...prev, browser_notifications_enabled: true }));
        new Notification('DayPerDay AI', { body: 'Notifications are now enabled!' });
        showToast('Browser notifications enabled', 'success');
      } else {
        showToast('Notification permission denied', 'error');
      }
    } else {
      showToast('Browser notifications not supported', 'error');
    }
  }

  return (
    <div className="space-y-6">
      {/* Profile section */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-950/20 flex items-center justify-center">
            <User size={20} className="text-primary-500" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Profile</h3>
            <p className="text-xs text-slate-400">Your personal information</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Full Name</label>
            <input
              value={profileForm.full_name || ''}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, full_name: e.target.value }))}
              className="input"
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input value={profile?.email || ''} disabled className="input opacity-60" />
          </div>
          <div>
            <label className="label">Account Type</label>
            <select
              value={profileForm.account_type || 'personal'}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, account_type: e.target.value as 'personal' | 'business' }))}
              className="input"
            >
              <option value="personal">Personal</option>
              <option value="business">Business</option>
            </select>
          </div>
          {profileForm.account_type === 'business' && (
            <div>
              <label className="label">Business Name</label>
              <input
                value={profileForm.business_name || ''}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, business_name: e.target.value }))}
                className="input"
                placeholder="Your business name"
              />
            </div>
          )}
          <div>
            <label className="label">Timezone</label>
            <select
              value={profileForm.timezone || 'Africa/Kigali'}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, timezone: e.target.value }))}
              className="input"
            >
              {timezones.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button onClick={saveProfile} disabled={savingProfile} className="btn-primary text-sm">
            {savingProfile ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Profile
          </button>
        </div>
      </div>

      {/* Appearance */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-secondary-50 dark:bg-secondary-950/20 flex items-center justify-center">
            {theme === 'dark' ? <Moon size={20} className="text-secondary-500" /> : <Sun size={20} className="text-secondary-500" />}
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Appearance</h3>
            <p className="text-xs text-slate-400">Customize how the app looks</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setTheme('light')}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
              theme === 'light' ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/20' : 'border-slate-200 dark:border-slate-700'
            }`}
          >
            <Sun size={20} className={theme === 'light' ? 'text-primary-500' : 'text-slate-400'} />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Light Mode</span>
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
              theme === 'dark' ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/20' : 'border-slate-200 dark:border-slate-700'
            }`}
          >
            <Moon size={20} className={theme === 'dark' ? 'text-primary-500' : 'text-slate-400'} />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Dark Mode</span>
          </button>
        </div>
      </div>

      {/* Preferences */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-accent-50 dark:bg-accent-950/20 flex items-center justify-center">
            <Clock size={20} className="text-accent-500" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Schedule & Preferences</h3>
            <p className="text-xs text-slate-400">Reminders and display settings</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Planning Reminder Time</label>
            <input
              type="time"
              value={prefForm.planning_time || '06:00'}
              onChange={(e) => setPrefForm((prev) => ({ ...prev, planning_time: e.target.value }))}
              className="input"
            />
            <p className="text-xs text-slate-400 mt-1">Daily planning reminder at this time</p>
          </div>
          <div>
            <label className="label">Review Reminder Time</label>
            <input
              type="time"
              value={prefForm.review_time || '20:00'}
              onChange={(e) => setPrefForm((prev) => ({ ...prev, review_time: e.target.value }))}
              className="input"
            />
            <p className="text-xs text-slate-400 mt-1">Evening review reminder at this time</p>
          </div>
          <div>
            <label className="label">Currency</label>
            <select
              value={prefForm.currency || 'RWF'}
              onChange={(e) => setPrefForm((prev) => ({ ...prev, currency: e.target.value }))}
              className="input"
            >
              {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">AI Response Language</label>
            <select
              value={prefForm.preferred_language || 'automatic'}
              onChange={(e) => setPrefForm((prev) => ({ ...prev, preferred_language: e.target.value as 'automatic' | 'en' | 'rw' | 'fr' | 'sw' }))}
              className="input"
            >
              <option value="automatic">Automatic (match my message)</option>
              <option value="en">English</option>
              <option value="rw">Kinyarwanda</option>
              <option value="fr">French</option>
              <option value="sw">Kiswahili</option>
            </select>
            <p className="text-xs text-slate-400 mt-1">
              In Automatic mode, the AI responds in the language you write in.
              Choose a fixed language to always get responses in that language.
            </p>
          </div>
          <div>
            <label className="label">In-App Notifications</label>
            <button
              onClick={() => setPrefForm((prev) => ({ ...prev, notifications_enabled: !prev.notifications_enabled }))}
              className={`relative w-full h-10 rounded-xl transition-all ${prefForm.notifications_enabled ? 'bg-primary-500' : 'bg-slate-200 dark:bg-slate-700'}`}
            >
              <span className={`absolute top-1 ${prefForm.notifications_enabled ? 'left-12' : 'left-1'} w-8 h-8 bg-white rounded-lg shadow transition-all flex items-center justify-center`}>
                <Bell size={14} className={prefForm.notifications_enabled ? 'text-primary-500' : 'text-slate-400'} />
              </span>
              <span className={`absolute top-1/2 -translate-y-1/2 text-sm font-medium ${prefForm.notifications_enabled ? 'left-2 text-white' : 'right-2 text-slate-500'}`}>
                {prefForm.notifications_enabled ? 'On' : 'Off'}
              </span>
            </button>
          </div>
        </div>

        {/* Browser notifications */}
        <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Browser Notifications</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Get reminders even when the app is open in another tab. Note: browser notifications may not work when the browser is closed unless push notifications are configured.
              </p>
            </div>
            <button onClick={requestBrowserNotifications} className="btn-secondary text-sm flex-shrink-0">
              <Bell size={14} /> Enable
            </button>
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button onClick={savePrefs} disabled={savingPrefs} className="btn-primary text-sm">
            {savingPrefs ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Preferences
          </button>
        </div>
      </div>

      {/* AI / Ollama settings */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-950/20 flex items-center justify-center">
            <Brain size={20} className="text-primary-500" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">AI Configuration</h3>
            <p className="text-xs text-slate-400">Dr. Green local AI settings</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Dr. Green AI Endpoint</label>
            <input
              value={prefForm.ollama_endpoint || 'http://localhost:11434'}
              onChange={(e) => setPrefForm((prev) => ({ ...prev, ollama_endpoint: e.target.value }))}
              className="input"
              placeholder="http://localhost:11434"
            />
          </div>
          <div>
            <label className="label">Dr. Green AI Model</label>
            <input
              value={prefForm.ollama_model || 'Dr. Green AI: Version 1'}
              onChange={(e) => setPrefForm((prev) => ({ ...prev, ollama_model: e.target.value }))}
              className="input"
              placeholder="Dr. Green AI"
            />
          </div>
        </div>

        {/* Status check */}
        <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu size={16} className="text-slate-400" />
              <span className="text-sm text-slate-600 dark:text-slate-300">Connection Status</span>
            </div>
            <div className="flex items-center gap-2">
              {ollamaStatus === 'checking' && <span className="badge bg-slate-100 dark:bg-slate-700 text-slate-500"><Loader2 size={12} className="animate-spin" /> Checking...</span>}
              {ollamaStatus === 'online' && <span className="badge bg-success-100 dark:bg-success-950/40 text-success-700 dark:text-success-400"><CheckCircle2 size={12} /> Connected</span>}
              {ollamaStatus === 'offline' && <span className="badge bg-error-100 dark:bg-error-950/40 text-error-700 dark:text-error-400"><AlertCircle size={12} /> Offline</span>}
              <button onClick={checkOllama} className="btn-secondary text-sm">
                Test Connection
              </button>
            </div>
          </div>
          {ollamaStatus === 'offline' && (
            <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              <p className="font-medium mb-1">Setup instructions:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Install Dr. Green AI from <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline">drgreenai.com</a></li>
                <li>Run: <code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700">Green pull Dr. Green AI</code></li>
                <li>Start: <code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700">Green serve</code></li>
                <li>Start Python backend (see README)</li>
              </ol>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-4">
          <button onClick={savePrefs} disabled={savingPrefs} className="btn-primary text-sm">
            {savingPrefs ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save AI Settings
          </button>
        </div>
      </div>
    </div>
  );
}
