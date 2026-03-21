/**
 * src/app/components/ai/AIChat.tsx
 * ──────────────────────────────────
 * WEEG Decision Advisor — v2.0
 *
 * Transforms the chat from Q&A into a real decision-making conversation:
 *   - Decision cards (pros/cons, recommendation, owner, deadline)
 *   - Suggested follow-up questions after each AI answer
 *   - Topic badges (credit / stock / churn / forecast / revenue)
 *   - Urgency indicators (critical / high / medium / low)
 *   - Conversation topics filter
 *   - Export conversation to text
 *   - Typing indicator with contextual loading message
 */

import {
  Sparkles, Send, Trash2, ChevronRight, AlertTriangle,
  TrendingUp, Package, Users, DollarSign, BarChart3,
  ThumbsUp, ThumbsDown, Copy, Download, Brain, Zap,
  CheckCircle, Clock, User, RefreshCw,
} from 'lucide-react';
import {
  useState, useEffect, useRef, useCallback, KeyboardEvent,
} from 'react';
import { api } from '../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type Role    = 'user' | 'ai';
type Topic   = 'credit' | 'stock' | 'churn' | 'forecast' | 'revenue' | 'general';
type Urgency = 'critical' | 'high' | 'medium' | 'low';

interface DecisionOption {
  label: string;
  pros:  string;
  cons:  string;
}
interface DecisionCard {
  question:       string;
  recommendation: string;
  rationale:      string;
  options:        DecisionOption[];
  owner:          string;
  deadline:       string;
}

export interface ChatMessage {
  id:                  string;
  role:                Role;
  content:             string;
  time:                string;
  loading?:            boolean;
  error?:              boolean;
  fallback?:           boolean;
  decision_needed?:    boolean;
  decision_card?:      DecisionCard | null;
  suggested_followups?: string[];
  urgency?:            Urgency;
  topic?:              Topic;
}

// ── Constants ─────────────────────────────────────────────────────────────────

function now() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function uid() { return Math.random().toString(36).slice(2); }

const INITIAL_MESSAGE: ChatMessage = {
  id:      'init',
  role:    'ai',
  content: "Hello! I'm your WEEG Decision Advisor. I have real-time access to your receivables, churn risk, stock alerts, anomalies, seasonal data, and revenue forecast.\n\nAsk me any business question — I'll give you a clear recommendation with exact numbers, and suggest what to ask next.",
  time:    now(),
  suggested_followups: [
    "What are my most critical business risks right now?",
    "Which customers should I contact today and why?",
    "Do I need to make any urgent stock decisions?",
  ],
  topic:   'general',
  urgency: 'low',
};

const TOPIC_QUESTIONS: Record<string, { label: string; icon: string; questions: string[] }> = {
  credit: {
    label: "Receivables & Credit",
    icon:  "💳",
    questions: [
      "Who are my top overdue accounts and how much do they owe?",
      "Should I suspend credit for any customer?",
      "What is my current DSO and how can I improve it?",
      "How much cash can I realistically collect this month?",
    ],
  },
  churn: {
    label: "Customer Retention",
    icon:  "👥",
    questions: [
      "Which customers are most likely to churn and why?",
      "What should I say when I call a high-risk customer?",
      "How much revenue am I at risk of losing to churn?",
      "Which churned customers should I try to win back?",
    ],
  },
  stock: {
    label: "Stock & Procurement",
    icon:  "📦",
    questions: [
      "Which products need an emergency reorder right now?",
      "How much should I order and when?",
      "Which products are tying up capital with low rotation?",
      "Am I prepared for the upcoming peak season?",
    ],
  },
  forecast: {
    label: "Revenue Forecast",
    icon:  "📈",
    questions: [
      "What is my revenue outlook for the next 3 months?",
      "What is the main risk to my forecast?",
      "How does my forecast compare to last year?",
      "What should I do to hit my best-case scenario?",
    ],
  },
  revenue: {
    label: "Sales & Revenue",
    icon:  "💰",
    questions: [
      "Which products and customers drive most of my margin?",
      "Where am I leaving money on the table?",
      "What is my revenue trend this year?",
      "Which branch is underperforming and why?",
    ],
  },
};

const URGENCY_STYLE: Record<Urgency, { bg: string; text: string; dot: string }> = {
  critical: { bg: 'bg-red-50 dark:bg-red-950/40',    text: 'text-red-700 dark:text-red-300',    dot: 'bg-red-500' },
  high:     { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  medium:   { bg: 'bg-blue-50 dark:bg-blue-950/40',   text: 'text-blue-700 dark:text-blue-300',   dot: 'bg-blue-400' },
  low:      { bg: 'bg-slate-50 dark:bg-slate-800',     text: 'text-slate-600 dark:text-slate-300', dot: 'bg-slate-400' },
};

const TOPIC_COLORS: Record<Topic, string> = {
  credit:   'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  stock:    'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
  churn:    'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  forecast: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  revenue:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  general:  'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const LOADING_PHRASES = [
  "Analyzing your business data…",
  "Checking receivables and churn signals…",
  "Reviewing stock levels and forecasts…",
  "Preparing your recommendation…",
  "Cross-referencing KPIs…",
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function TypingIndicator({ phrase }: { phrase: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
        <Sparkles className="h-3.5 w-3.5 text-white" />
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl rounded-tl-none bg-muted/60">
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <span key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-400"
                style={{ animation: `bounce 1.2s infinite ${i * 0.2}s` }} />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{phrase}</span>
        </div>
      </div>
    </div>
  );
}

function DecisionCardView({ card, onSelectOption }: { card: DecisionCard; onSelectOption: (q: string) => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <div className="mt-3 rounded-xl border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-indigo-600 dark:bg-indigo-800">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-indigo-100" />
          <span className="text-xs font-bold text-indigo-100 uppercase tracking-wider">Decision Required</span>
        </div>
        <p className="text-sm font-semibold text-white mt-1">{card.question}</p>
      </div>

      {/* Recommendation */}
      <div className="px-4 py-3 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800">
        <div className="flex items-start gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-0.5">Recommendation</p>
            <p className="text-sm text-emerald-800 dark:text-emerald-200 font-medium">{card.recommendation}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 italic">{card.rationale}</p>
          </div>
        </div>
      </div>

      {/* Options */}
      {card.options?.length > 0 && (
        <div className="px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Options</p>
          {card.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => {
                setSelected(i);
                onSelectOption(`Tell me more about option: "${opt.label}" — specifically the ${i === 0 ? 'implementation steps' : 'risks and mitigation'}`);
              }}
              className={`w-full text-left rounded-lg border p-3 transition-all text-sm
                ${selected === i
                  ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 dark:border-indigo-600'
                  : 'border-border hover:border-indigo-300 hover:bg-muted/30'
                }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  {String.fromCharCode(65 + i)}.
                </span>
                <span className="font-semibold">{opt.label}</span>
                {selected === i && <CheckCircle className="h-3.5 w-3.5 text-indigo-500 ml-auto" />}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-start gap-1">
                  <ThumbsUp className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-xs text-emerald-700 dark:text-emerald-300">{opt.pros}</span>
                </div>
                <div className="flex items-start gap-1">
                  <ThumbsDown className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
                  <span className="text-xs text-red-600 dark:text-red-400">{opt.cons}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Owner & deadline */}
      <div className="px-4 py-2.5 border-t flex items-center gap-4 text-xs text-muted-foreground bg-muted/20">
        {card.owner && (
          <span className="flex items-center gap-1.5">
            <User className="h-3 w-3" />
            <span className="font-medium">{card.owner}</span>
          </span>
        )}
        {card.deadline && (
          <span className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            <span>{card.deadline}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function MessageBubble({
  message, onFollowup,
}: { message: ChatMessage; onFollowup: (q: string) => void }) {
  const isUser = message.role === 'user';
  const urgency = message.urgency || 'low';
  const ust = URGENCY_STYLE[urgency];

  const renderContent = (text: string) => {
    return text.split('\n').map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={i}>
          {parts.map((part, j) =>
            part.startsWith('**') && part.endsWith('**')
              ? <strong key={j}>{part.slice(2, -2)}</strong>
              : part
          )}
          {i < text.split('\n').length - 1 && <br />}
        </span>
      );
    });
  };

  if (isUser) {
    return (
      <div className="flex justify-end px-4 py-1.5">
        <div className="flex items-end gap-2 max-w-[80%]">
          <div className="flex flex-col items-end gap-1">
            <div className="px-4 py-2.5 rounded-2xl rounded-br-sm bg-indigo-600 text-white text-sm leading-relaxed">
              {renderContent(message.content)}
            </div>
            <span className="text-[10px] text-muted-foreground">{message.time}</span>
          </div>
          <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
            <User className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col px-4 py-1.5">
      <div className="flex items-start gap-2.5 max-w-[92%]">
        {/* Avatar */}
        <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>

        <div className="flex-1 space-y-2">
          {/* Header badges */}
          {(message.topic || message.urgency) && !message.loading && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {message.topic && message.topic !== 'general' && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${TOPIC_COLORS[message.topic]}`}>
                  {message.topic}
                </span>
              )}
              {urgency !== 'low' && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${ust.bg} ${ust.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${ust.dot}`} />
                  {urgency}
                </span>
              )}
              {message.fallback && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
                  offline mode
                </span>
              )}
            </div>
          )}

          {/* Bubble */}
          <div className="px-4 py-3 rounded-2xl rounded-tl-none bg-muted/50 text-sm leading-relaxed">
            {renderContent(message.content)}

            {/* Decision card */}
            {message.decision_card && (
              <DecisionCardView
                card={message.decision_card}
                onSelectOption={onFollowup}
              />
            )}
          </div>

          {/* Suggested followups */}
          {message.suggested_followups && message.suggested_followups.length > 0 && !message.loading && (
            <div className="flex flex-col gap-1.5 pt-1">
              <p className="text-[10px] text-muted-foreground font-medium pl-1">Continue the discussion:</p>
              <div className="flex flex-wrap gap-1.5">
                {message.suggested_followups.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => onFollowup(q)}
                    className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:border-indigo-400 transition-all text-xs text-indigo-700 dark:text-indigo-300 font-medium"
                  >
                    <ChevronRight className="h-3 w-3 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          <span className="text-[10px] text-muted-foreground pl-1">{message.time}</span>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface AIChatProps {
  className?: string;
}

export function AIChat({ className = '' }: AIChatProps) {
  const [messages,     setMessages]     = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input,        setInput]        = useState('');
  const [sending,      setSending]      = useState(false);
  const [loadingPhrase,setLoadingPhrase]= useState(LOADING_PHRASES[0]);
  const [activeTopic,  setActiveTopic]  = useState<string | null>(null);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const phraseCycle= useRef<number>(0);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Rotate loading phrase
  useEffect(() => {
    if (!sending) return;
    const interval = setInterval(() => {
      phraseCycle.current = (phraseCycle.current + 1) % LOADING_PHRASES.length;
      setLoadingPhrase(LOADING_PHRASES[phraseCycle.current]);
    }, 2000);
    return () => clearInterval(interval);
  }, [sending]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMsg: ChatMessage = {
      id: uid(), role: 'user', content: trimmed, time: now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);
    inputRef.current?.focus();

    // Build API history
    const apiHistory = [...messages, userMsg]
      .filter(m => !m.loading)
      .map(m => ({
        role:    m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));

    try {
      const res = await api.post<{
        answer:              string;
        decision_needed:     boolean;
        decision_card:       DecisionCard | null;
        suggested_followups: string[];
        urgency:             Urgency;
        topic:               Topic;
        fallback:            boolean;
      }>('/ai-insights/chat/', { messages: apiHistory });

      const aiMsg: ChatMessage = {
        id:                  uid(),
        role:                'ai',
        content:             res.answer,
        time:                now(),
        decision_needed:     res.decision_needed,
        decision_card:       res.decision_card,
        suggested_followups: res.suggested_followups,
        urgency:             res.urgency,
        topic:               res.topic,
        fallback:            res.fallback,
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id:      uid(),
        role:    'ai',
        content: "I'm temporarily unavailable. Please check your dashboard panels for real-time data.",
        time:    now(),
        error:   true,
        suggested_followups: [
          "What are my top business risks?",
          "Which customers need urgent attention?",
          "What is my revenue outlook?",
        ],
      }]);
    } finally {
      setSending(false);
    }
  }, [messages, sending]);

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const handleClear = () => {
    setMessages([INITIAL_MESSAGE]);
    setActiveTopic(null);
    inputRef.current?.focus();
  };

  const handleExport = () => {
    const text = messages
      .filter(m => !m.loading)
      .map(m => `[${m.time}] ${m.role === 'user' ? 'Manager' : 'AI Advisor'}: ${m.content}`)
      .join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `weeg-decision-session-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const topicGroup = activeTopic ? TOPIC_QUESTIONS[activeTopic] : null;

  return (
    <div className={`flex flex-col h-[720px] rounded-2xl border bg-background shadow-sm overflow-hidden ${className}`}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b bg-gradient-to-r from-indigo-600 to-indigo-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Brain className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Decision Advisor</p>
            <p className="text-[10px] text-indigo-200">Live business context · Real-time data</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1.5 mr-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-indigo-200 font-medium">Connected</span>
          </div>
          <button
            onClick={handleExport}
            title="Export conversation"
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <Download className="h-3.5 w-3.5 text-indigo-200" />
          </button>
          <button
            onClick={handleClear}
            title="New conversation"
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5 text-indigo-200" />
          </button>
        </div>
      </div>

      {/* ── Topic tabs ── */}
      <div className="flex gap-1.5 px-4 py-2.5 border-b overflow-x-auto scrollbar-hide bg-muted/20">
        <button
          onClick={() => setActiveTopic(null)}
          className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors
            ${!activeTopic ? 'bg-indigo-600 text-white' : 'bg-muted/60 text-muted-foreground hover:bg-muted'}`}
        >
          All topics
        </button>
        {Object.entries(TOPIC_QUESTIONS).map(([key, t]) => (
          <button
            key={key}
            onClick={() => setActiveTopic(activeTopic === key ? null : key)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors
              ${activeTopic === key ? 'bg-indigo-600 text-white' : 'bg-muted/60 text-muted-foreground hover:bg-muted'}`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Topic quick questions ── */}
      {topicGroup && (
        <div className="px-4 py-2.5 border-b bg-indigo-50/50 dark:bg-indigo-950/20">
          <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mb-2 uppercase tracking-wider">
            {topicGroup.icon} {topicGroup.label} — Common decisions
          </p>
          <div className="flex flex-wrap gap-1.5">
            {topicGroup.questions.map((q, i) => (
              <button
                key={i}
                onClick={() => { send(q); setActiveTopic(null); }}
                className="px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:border-indigo-400 transition-all font-medium"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto py-3 space-y-1 scroll-smooth">
        {messages.map(msg => (
          msg.loading
            ? <TypingIndicator key={msg.id} phrase={loadingPhrase} />
            : <MessageBubble key={msg.id} message={msg} onFollowup={send} />
        ))}

        {sending && <TypingIndicator phrase={loadingPhrase} />}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div className="border-t px-4 py-3 bg-background">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
              onKeyDown={handleKey}
              placeholder="Ask me anything — I'll give you a recommendation…"
              disabled={sending}
              className="w-full resize-none rounded-xl border bg-muted/30 px-4 py-3 text-sm
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                disabled:opacity-50 placeholder:text-muted-foreground/60
                leading-relaxed max-h-[120px] overflow-y-auto"
              style={{ height: '44px' }}
            />
          </div>
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || sending}
            className="flex items-center justify-center w-11 h-11 rounded-xl bg-indigo-600
              text-white disabled:opacity-40 disabled:cursor-not-allowed
              hover:bg-indigo-700 active:scale-95 transition-all shrink-0"
          >
            {sending
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Send className="h-4 w-4" />
            }
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
          Enter to send · Shift+Enter for new line · Decision cards appear for complex questions
        </p>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-4px); }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}