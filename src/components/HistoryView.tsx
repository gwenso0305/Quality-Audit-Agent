import React, { useState } from 'react';
import { AuditSession, AuditInteraction } from '../types';
import { AuditCardView } from './AuditCardView';
import { SafeMarkdown } from './SafeMarkdown';
import { Calendar, CheckCircle2, Clock, ChevronRight, ArrowLeft, ClipboardList, User } from 'lucide-react';

interface HistoryViewProps {
  sessions: AuditSession[];
  interactions: Record<string, AuditInteraction[]>; // sessionId -> list of interactions
  onSelectSession?: (session: AuditSession) => void;
  isAdminView?: boolean;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  sessions,
  interactions,
  isAdminView = false,
}) => {
  const [selectedSession, setSelectedSession] = useState<AuditSession | null>(null);

  if (selectedSession) {
    const sessionMsgs = (interactions[selectedSession.sessionId] || []).sort(
      (a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
    );

    return (
      <div className="space-y-5">
        <button
          onClick={() => setSelectedSession(null)}
          className="px-3 py-1.5 bg-white border border-[#E7DECD] hover:bg-[#FAF7F2] text-[#7A1F2B] text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Session History</span>
        </button>

        {/* Session details banner */}
        <div className="bg-white border border-[#E7DECD] rounded-xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`px-2 py-0.5 text-xs font-bold rounded ${
                  selectedSession.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {selectedSession.status === 'completed' ? 'Completed Audit' : 'In Progress'}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                ID: {selectedSession.sessionId}
              </span>
            </div>
            <h3 className="font-serif text-lg font-bold text-[#7A1F2B]">
              {selectedSession.profileSnapshot?.displayName || 'Faculty Member'} (
              {selectedSession.profileSnapshot?.position || 'Staff'})
            </h3>
            <p className="text-xs text-slate-500">
              Department: {selectedSession.profileSnapshot?.department || 'DCE'} • Role:{' '}
              {selectedSession.profileSnapshot?.roleCategory || 'Faculty'}
            </p>
          </div>

          <div className="text-right text-xs text-slate-500">
            <div className="flex items-center gap-1 justify-end font-medium text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-[#C9A227]" />
              <span>
                {selectedSession.createdAt ? new Date(selectedSession.createdAt).toLocaleString() : 'N/A'}
              </span>
            </div>
            {selectedSession.completedAt && (
              <div className="text-[11px] text-emerald-700 mt-0.5">
                Completed: {new Date(selectedSession.completedAt).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>

        {/* If Audit Card exists */}
        {selectedSession.auditCard && (
          <div className="space-y-3">
            <h4 className="font-serif text-base font-bold text-[#7A1F2B]">
              Synthesized Audit Card
            </h4>
            <AuditCardView card={selectedSession.auditCard} isAdmin={isAdminView} />
          </div>
        )}

        {/* Full Transcript */}
        <div className="bg-white border border-[#E7DECD] rounded-xl p-5 shadow-xs space-y-4">
          <h4 className="font-serif text-base font-bold text-[#7A1F2B] pb-2 border-b border-slate-200">
            Full Audit Interview Transcript ({sessionMsgs.length} messages)
          </h4>

          {sessionMsgs.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No messages saved for this session.</p>
          ) : (
            <div className="space-y-3">
              {sessionMsgs.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs ${
                        isUser
                          ? 'bg-[#7A1F2B] text-white'
                          : 'bg-[#FAF7F2] text-[#7A1F2B] border border-[#E7DECD]'
                      }`}
                    >
                      {isUser ? <User className="w-3.5 h-3.5" /> : <ClipboardList className="w-3.5 h-3.5" />}
                    </div>

                    <div
                      className={`max-w-[85%] p-3.5 rounded-xl text-xs ${
                        isUser
                          ? 'bg-[#7A1F2B] text-white rounded-tr-xs'
                          : 'bg-[#FAF7F2] border border-[#E7DECD] text-slate-800 rounded-tl-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span
                          className={`font-semibold text-[11px] ${
                            isUser ? 'text-amber-200' : 'text-[#7A1F2B]'
                          }`}
                        >
                          {isUser
                            ? selectedSession.profileSnapshot?.displayName || 'Interviewee'
                            : 'Audit Agent'}
                        </span>
                        {msg.modelUsed && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {msg.modelUsed}
                          </span>
                        )}
                      </div>
                      <SafeMarkdown
                        content={msg.content}
                        className={isUser ? 'text-white prose-invert' : 'text-slate-800'}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E7DECD] rounded-xl p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-serif text-lg font-bold text-[#7A1F2B]">
            {isAdminView ? 'All Completed Audit Sessions' : 'Your Audit Session History'}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Click any session to review its full interview transcript and synthesized Audit Card.
          </p>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="p-8 border border-dashed border-slate-300 rounded-xl text-center text-slate-400 text-xs">
          No audit sessions found.
        </div>
      ) : (
        <div className="divide-y divide-[#EFE8DA] border border-[#EFE8DA] rounded-lg overflow-hidden">
          {sessions.map((sess) => {
            const issuesCount = sess.auditCard?.issues?.length || 0;
            const isCompleted = sess.status === 'completed';

            return (
              <div
                key={sess.id}
                onClick={() => setSelectedSession(sess)}
                className="p-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-[#FAF7F2] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isCompleted
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-slate-900">
                        {sess.profileSnapshot?.displayName || 'Faculty Member'}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        ({sess.profileSnapshot?.position || 'Staff'} •{' '}
                        {sess.profileSnapshot?.roleCategory || 'Faculty'})
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                      <span>{new Date(sess.createdAt || Date.now()).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>Part {sess.part || 1} reached</span>
                      {isCompleted && (
                        <>
                          <span>•</span>
                          <span className="text-amber-800 font-semibold">
                            {issuesCount} issues identified
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 text-xs font-semibold rounded ${
                      isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {isCompleted ? 'Completed' : 'In Progress'}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
