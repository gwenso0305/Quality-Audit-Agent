import React, { useState, useEffect, useRef } from 'react';
import { AuditSession, AuditInteraction, UserProfile, AuditCard } from '../types';
import { SafeMarkdown } from './SafeMarkdown';
import { AuditCardView } from './AuditCardView';
import {
  Send,
  ClipboardList,
  User,
  Clock,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface ChatInterfaceProps {
  session: AuditSession;
  profile: UserProfile;
  interactions: AuditInteraction[];
  onSendMessage: (params: {
    message: string;
    clientMessageId: string;
    part: number;
  }) => Promise<{ reply: string; part: number; modelUsed?: string }>;
  onFinishAndAnalyze: () => Promise<AuditCard>;
  onRetrySaveInteraction?: (interaction: Partial<AuditInteraction>) => Promise<void>;
}

const PARTS = [
  { num: 1, title: 'Process Walkthrough' },
  { num: 2, title: 'Difficulties & Complaints' },
  { num: 3, title: '5 Whys' },
  { num: 4, title: 'Suggestions' },
];

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  session,
  profile,
  interactions,
  onSendMessage,
  onFinishAndAnalyze,
}) => {
  const [inputText, setInputText] = useState('');
  const [activeClientMessageId, setActiveClientMessageId] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [showRetryToast, setShowRetryToast] = useState(false);
  const [isConfirmFinishOpen, setIsConfirmFinishOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingSeconds, setAnalyzingSeconds] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const lastSentCopyRef = useRef<string>('');

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [interactions, sending]);

  // Initial welcome message (fixed text, no Gemini call)
  const initialWelcomeText = `Hello ${profile.displayName || 'Colleague'} (${profile.position || 'Staff'})! Welcome to the Total Quality Management (TQM) process audit for the Department of Computing Education. I am the Audit Agent. Our conversation follows four structured parts:

1. **Process Walkthrough**: Walk through one regular task step by step.
2. **Difficulties & Complaints**: Discuss operational bottlenecks and pain points.
3. **5 Whys**: Explore root causes behind the key challenge.
4. **Suggestions**: Brainstorm actionable, standard-aligned improvements.

To start, could you walk me through one task you do regularly, step by step?`;

  // Start sending message
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const textToSend = (inputText.trim() || lastSentCopyRef.current).trim();
    if (!textToSend || sending || session.status === 'completed') return;

    // Generate or reuse clientMessageId for idempotency
    const clientMsgId = activeClientMessageId || crypto.randomUUID();
    setActiveClientMessageId(clientMsgId);
    lastSentCopyRef.current = textToSend;

    // Clear input box immediately as soon as Send is pressed
    setInputText('');
    setSending(true);
    setSecondsElapsed(0);
    setErrorMessage('');
    setShowRetryToast(false);

    const timer = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);

    try {
      await onSendMessage({
        message: textToSend,
        clientMessageId: clientMsgId,
        part: session.part || 1,
      });

      // Clear pending message tracking on success
      lastSentCopyRef.current = '';
      setActiveClientMessageId('');
    } catch (err: any) {
      console.error('Failed to send interview message:', err);
      // Restore the text in the input box on failure
      setInputText(lastSentCopyRef.current);

      const isBusy =
        err.status === 502 ||
        err.status === 504 ||
        err.message?.includes('502') ||
        err.message?.includes('504') ||
        err.message?.includes('JSON');

      setErrorMessage(
        isBusy
          ? 'The audit server is busy. Click Retry Save to continue.'
          : err.message || 'Failed to send message.'
      );
      setShowRetryToast(true);
      // Note: activeClientMessageId is kept so retry reuses it idempotently
    } finally {
      clearInterval(timer);
      setSending(false);
    }
  };

  const handleFinish = async () => {
    setIsConfirmFinishOpen(false);
    setAnalyzing(true);
    setAnalyzingSeconds(0);
    const timer = setInterval(() => setAnalyzingSeconds((s) => s + 1), 1000);

    try {
      await onFinishAndAnalyze();
    } catch (err: any) {
      console.error('Failed to analyze session:', err);
      alert(`Analysis failed: ${err.message || 'Please try again.'}`);
    } finally {
      clearInterval(timer);
      setAnalyzing(false);
    }
  };

  const currentPart = session.part || 1;
  const isCompleted = session.status === 'completed';

  return (
    <div className={isCompleted ? "space-y-4" : "space-y-4 md:flex md:flex-col md:h-[calc(100vh-4.5rem)]"}>
      {/* 4-Part Progress Indicator */}
      <div className="bg-white border border-[#E7DECD] rounded-xl p-4 shadow-xs shrink-0">
        <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
          {PARTS.map((p, idx) => {
            const isCompleted = currentPart > p.num;
            const isCurrent = currentPart === p.num;

            return (
              <React.Fragment key={p.num}>
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                    isCurrent
                      ? 'bg-[#7A1F2B] text-white shadow-xs'
                      : isCompleted
                      ? 'bg-amber-100/80 text-amber-900'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      isCurrent
                        ? 'bg-[#C9A227] text-slate-900'
                        : isCompleted
                        ? 'bg-amber-200 text-amber-900'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {isCompleted ? '✓' : p.num}
                  </span>
                  <span>{p.title}</span>
                </div>
                {idx < PARTS.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Audit Card view if session is completed */}
      {session.status === 'completed' && session.auditCard && (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 flex items-center justify-between text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span className="font-bold">
                Audit interview completed and verified. Audit Card generated below.
              </span>
            </div>
            <span className="text-emerald-700 font-mono">
              Completed on {new Date(session.completedAt || Date.now()).toLocaleDateString()}
            </span>
          </div>

          <AuditCardView card={session.auditCard} />
        </div>
      )}

      {/* Chat Messages Log */}
      <div
        className={`bg-white border border-[#E7DECD] rounded-xl p-5 shadow-xs flex flex-col overflow-hidden ${
          isCompleted
            ? 'min-h-[480px] max-h-[620px]'
            : 'min-h-[420px] md:min-h-[420px] md:flex-1'
        }`}
      >
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
          {/* Welcome Message (First message from app) */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#7A1F2B] text-[#C9A227] flex items-center justify-center shrink-0 shadow-2xs mt-1">
              <ClipboardList className="w-4 h-4" />
            </div>
            <div className="max-w-[85%] bg-[#FAF7F2] border border-[#E7DECD] rounded-2xl rounded-tl-xs p-4 text-xs text-slate-800 shadow-2xs">
              <div className="font-serif font-bold text-[#7A1F2B] mb-1.5 flex items-center gap-1.5">
                <span>Audit Agent</span>
                <span className="text-[10px] font-sans font-normal text-slate-400">
                  DCE TQM Interviewer
                </span>
              </div>
              <SafeMarkdown content={initialWelcomeText} />
            </div>
          </div>

          {/* User & Assistant Interactions */}
          {interactions.map((msg) => {
            const isUser = msg.role === 'user';

            return (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-2xs mt-1 ${
                    isUser ? 'bg-[#7A1F2B] text-white' : 'bg-[#FAF7F2] text-[#7A1F2B] border border-[#E7DECD]'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <ClipboardList className="w-4 h-4" />}
                </div>

                <div
                  className={`max-w-[85%] p-4 text-xs shadow-2xs rounded-2xl ${
                    isUser
                      ? 'bg-[#7A1F2B] text-[#FDFBF7] rounded-tr-xs'
                      : 'bg-[#FAF7F2] border border-[#E7DECD] text-slate-800 rounded-tl-xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span
                      className={`font-semibold text-[11px] ${
                        isUser ? 'text-amber-200' : 'text-[#7A1F2B] font-serif font-bold'
                      }`}
                    >
                      {isUser ? profile.displayName || 'You' : 'Audit Agent'}
                    </span>
                    {msg.modelUsed && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        {msg.modelUsed}
                      </span>
                    )}
                  </div>
                  <SafeMarkdown
                    content={msg.content}
                    className={isUser ? 'text-[#FDFBF7] prose-invert' : 'text-slate-800'}
                  />
                </div>
              </div>
            );
          })}

          {/* Thinking status with seconds counter */}
          {sending && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#FAF7F2] border border-[#E7DECD] text-[#7A1F2B] flex items-center justify-center shrink-0 animate-pulse mt-1">
                <ClipboardList className="w-4 h-4" />
              </div>
              <div className="bg-[#FAF7F2] border border-[#E7DECD] rounded-2xl rounded-tl-xs p-3 text-xs text-slate-600 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#7A1F2B] animate-spin" />
                <span>Audit Agent is reviewing baseline & thinking... ({secondsElapsed}s)</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Retry Toast Banner if save or API failed */}
        {showRetryToast && (
          <div className="shrink-0 my-2 p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>{errorMessage || 'Failed to save or receive response.'}</span>
            </div>
            <button
              onClick={() => handleSend()}
              className="px-3 py-1 bg-[#7A1F2B] hover:bg-[#601822] text-white font-semibold rounded-lg flex items-center gap-1 cursor-pointer shadow-xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#C9A227]" />
              <span>Retry Save</span>
            </button>
          </div>
        )}

        {/* Input area & Finish button */}
        {!isCompleted && (
          <div className="shrink-0 pt-3 border-t border-slate-200 mt-2 space-y-2">
            <form onSubmit={handleSend} className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  rows={2}
                  maxLength={2000}
                  value={inputText}
                  disabled={sending}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Type your response to the Audit Agent (max 2,000 characters; English/Tagalog/Cebuano)..."
                  className="w-full px-3 py-2 pr-16 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#7A1F2B] text-xs resize-none"
                />
                <div className="absolute right-2 bottom-2 text-[10px] text-slate-400">
                  {inputText.length}/2000
                </div>
              </div>

              <button
                type="submit"
                disabled={sending || !inputText.trim()}
                className="px-4 py-2.5 bg-[#7A1F2B] hover:bg-[#601822] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 transition-colors"
              >
                <Send className="w-4 h-4 text-[#C9A227]" />
                <span>Send</span>
              </button>
            </form>

            <div className="flex items-center justify-between text-xs text-slate-500 px-1 pt-1">
              <span>Press Enter to send, Shift+Enter for new line.</span>

              <button
                type="button"
                onClick={() => setIsConfirmFinishOpen(true)}
                disabled={analyzing || interactions.length < 2}
                className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-[#7A1F2B] font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors border border-amber-300 disabled:opacity-40"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#C9A227]" />
                <span>Finish & Analyze</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Finish & Analyze Confirmation Modal */}
      {isConfirmFinishOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-[#E7DECD] text-xs">
            <h4 className="font-serif font-bold text-base text-[#7A1F2B] mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#C9A227]" />
              <span>Finish Audit Interview?</span>
            </h4>
            <p className="text-slate-600 mb-4 leading-relaxed">
              This will conclude the active interview session and request Gemini to synthesize your
              Root Cause Ladder and Audit Card against the department's quality baseline.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsConfirmFinishOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg cursor-pointer"
              >
                Continue Interview
              </button>
              <button
                onClick={handleFinish}
                className="px-4 py-2 bg-[#7A1F2B] hover:bg-[#601822] text-white font-semibold rounded-lg cursor-pointer shadow-xs"
              >
                Generate Audit Card
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analyzing Progress Overlay */}
      {analyzing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-[#7A1F2B] flex items-center justify-center mx-auto animate-spin">
              <Sparkles className="w-6 h-6 text-[#C9A227]" />
            </div>
            <div>
              <h4 className="font-serif font-bold text-base text-[#7A1F2B]">
                Synthesizing TQM Audit Card
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Evaluating 5 Whys chain, strengths, and standard conformity ({analyzingSeconds}s)...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
