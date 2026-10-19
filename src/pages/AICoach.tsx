import { useState, useRef, useEffect, useCallback } from 'react';
import { Brain, Send, Loader2, Sparkles, AlertCircle, Cpu, CheckCircle2, Globe } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { supabase, ChatMessage, LANGUAGE_LABELS } from '@/lib/supabase';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  detectedLanguage?: string;
  responseLanguage?: string;
  translationUsed?: boolean;
  translationError?: string | null;
};

export default function AICoach() {
  const { profile, preferences } = useAuth();
  const { showToast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const preferredLanguage = preferences?.preferred_language || 'automatic';

  const loadHistory = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: true })
      .limit(50);
    if (data && data.length > 0) {
      setMessages(
        (data as ChatMessage[]).map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.created_at,
          detectedLanguage: m.detected_language || undefined,
          responseLanguage: m.response_language || undefined,
          translationUsed: m.translation_used,
          translationError: m.translation_error,
        }))
      );
    }
  }, [profile]);

  useEffect(() => {
    checkOllamaStatus();
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function checkOllamaStatus() {
    setOllamaStatus('checking');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/ai/status`);
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

  async function saveMessage(msg: Message, extra?: Partial<ChatMessage>) {
    if (!profile) return;
    await supabase.from('chat_messages').insert({
      user_id: profile.id,
      role: msg.role,
      content: msg.content,
      detected_language: msg.detectedLanguage || null,
      detection_confidence: 0,
      response_language: msg.responseLanguage || null,
      translation_used: msg.translationUsed || false,
      translation_error: msg.translationError || null,
      source: 'ollama',
      ...extra,
    });
  }

  async function sendMessage() {
    if (!input.trim() || loading || !profile) return;
    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // Build conversation history for the API (last 10 messages)
    const history = [...messages, userMessage].slice(-10).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/ai/coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: profile.id,
          message: userMessage.content,
          context: {
            account_type: profile.account_type,
            profile: {
              full_name: profile.full_name,
              country: profile.country,
              district: profile.district,
              education_level: profile.education_level,
              skills_talents: profile.skills_talents,
              areas_to_improve: profile.areas_to_improve,
            },
          },
          preferred_language: preferredLanguage,
          conversation_history: history,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.response || 'I could not generate a response.',
          timestamp: new Date().toISOString(),
          detectedLanguage: data.detected_language,
          responseLanguage: data.response_language,
          translationUsed: data.translation_used,
          translationError: data.translation_error,
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // Save both messages to the database
        await saveMessage(userMessage, {
          detected_language: data.detected_language,
          english_translation: data.english_message || null,
        });
        await saveMessage(assistantMessage);
      } else {
        const errorMsg: Message = {
          role: 'assistant',
          content: 'The AI service is currently unavailable. Please make sure the Python backend and Ollama are running.',
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        showToast('AI service unavailable', 'error');
      }
    } catch {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: 'Could not connect to the AI service. The Python backend may not be running.',
        timestamp: new Date().toISOString(),
      }]);
    }

    setLoading(false);
  }

  const suggestions = [
    'Analyze my productivity this week',
    'How can I improve my savings?',
    'What habits should I change?',
    'Review my goal progress',
  ];

  return (
    <div className="space-y-6">
      {/* Status card */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
              <Brain size={24} className="text-white" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">AI Coach</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Model: {preferences?.ollama_model || 'qwen2.5:3b'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {ollamaStatus === 'checking' && (
              <span className="badge bg-slate-100 dark:bg-slate-800 text-slate-500">
                <Loader2 size={12} className="animate-spin" /> Checking...
              </span>
            )}
            {ollamaStatus === 'online' && (
              <span className="badge bg-success-100 dark:bg-success-950/40 text-success-700 dark:text-success-400">
                <CheckCircle2 size={12} /> Online
              </span>
            )}
            {ollamaStatus === 'offline' && (
              <span className="badge bg-error-100 dark:bg-error-950/40 text-error-700 dark:text-error-400">
                <AlertCircle size={12} /> Offline
              </span>
            )}
            <span className="badge bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-400 flex items-center gap-1">
              <Globe size={12} /> {LANGUAGE_LABELS[preferredLanguage] || 'Automatic'}
            </span>
            <button onClick={checkOllamaStatus} className="btn-ghost text-sm">
              <Cpu size={16} /> Check
            </button>
          </div>
        </div>
        {ollamaStatus === 'offline' && (
          <div className="mt-4 p-4 rounded-xl bg-warning-50 dark:bg-warning-950/20 border border-warning-200 dark:border-warning-800">
            <p className="text-sm text-warning-700 dark:text-warning-400 font-medium mb-2">AI Service is Offline</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              To use the AI Coach, start the Python backend and Ollama:
            </p>
            <ol className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400 list-decimal list-inside">
              <li>Install Ollama: <code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800">ollama pull qwen2.5:3b</code></li>
              <li>Start backend: <code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800">cd backend && python -m uvicorn main:app --reload --port 8000</code></li>
              <li>Ensure Ollama is running: <code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800">ollama serve</code></li>
            </ol>
          </div>
        )}
      </div>

      {/* Chat area */}
      <div className="card flex flex-col h-[500px]">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-950/30 flex items-center justify-center mb-4">
                <Sparkles size={28} className="text-primary-500" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Ask your AI Coach anything</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6">
                Get personalized insights on your productivity, finances, goals, and daily habits. Write in any language — the AI responds in your language.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="text-left p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-300 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                msg.role === 'user'
                  ? 'bg-primary-600'
                  : 'bg-gradient-to-br from-primary-500 to-secondary-500'
              }`}>
                {msg.role === 'user' ? (
                  <span className="text-xs font-semibold text-white">{profile?.full_name?.charAt(0) || 'U'}</span>
                ) : (
                  <Brain size={16} className="text-white" />
                )}
              </div>
              <div className={`max-w-[75%] p-3.5 rounded-2xl ${
                msg.role === 'user'
                  ? 'bg-primary-600 text-white rounded-tr-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-sm'
              }`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                {/* Language indicator for assistant messages */}
                {msg.role === 'assistant' && msg.responseLanguage && msg.responseLanguage !== 'en' && (
                  <div className="mt-1.5 flex items-center gap-1 text-[10px] opacity-60">
                    <Globe size={9} /> {LANGUAGE_LABELS[msg.responseLanguage] || msg.responseLanguage}
                    {msg.translationError && <span className="text-warning-400">(translation failed)</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center flex-shrink-0">
                <Brain size={16} className="text-white" />
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 p-3.5 rounded-2xl rounded-tl-sm">
                <Loader2 size={18} className="animate-spin text-primary-500" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Ask your AI coach in any language..."
              className="input flex-1"
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="btn-primary px-3"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
