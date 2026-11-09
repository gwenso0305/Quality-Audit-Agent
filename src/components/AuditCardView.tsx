import React from 'react';
import { AuditCard } from '../types';
import { RootCauseLadder } from './RootCauseLadder';
import { Award, AlertCircle, Quote, PlusCircle, CheckCircle, Tag } from 'lucide-react';

interface AuditCardViewProps {
  card: AuditCard;
  isAdmin?: boolean;
  onCreateAction?: (issue: any) => void;
}

export const AuditCardView: React.FC<AuditCardViewProps> = ({
  card,
  isAdmin = false,
  onCreateAction,
}) => {
  const getImpactBadge = (impact: string) => {
    switch (impact) {
      case 'High':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'Medium':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Low':
      default:
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      <div className="bg-white border border-[#E7DECD] rounded-xl p-5 shadow-xs">
        <h4 className="font-serif text-lg font-bold text-[#7A1F2B] mb-2 flex items-center gap-2">
          <span>Audit Card Summary</span>
        </h4>
        <p className="text-slate-700 text-sm leading-relaxed mb-3">{card.summary}</p>
        <div className="bg-[#FAF7F2] p-3 rounded-lg border border-[#EFE8DA] text-xs">
          <span className="font-semibold text-slate-800">Process Described:</span>{' '}
          <span className="text-slate-700">{card.processDescribed}</span>
        </div>
      </div>

      {/* Strengths */}
      {card.strengths && card.strengths.length > 0 && (
        <div className="bg-white border border-[#E7DECD] rounded-xl p-5 shadow-xs">
          <h4 className="font-serif text-md font-bold text-emerald-800 mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-600" />
            <span>Demonstrated Quality Strengths</span>
          </h4>
          <ul className="space-y-2">
            {card.strengths.map((str, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{str}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Issues Found */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-serif text-md font-bold text-[#7A1F2B] flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>Process Bottlenecks & Identified Issues ({card.issues?.length || 0})</span>
          </h4>
        </div>

        {!card.issues || card.issues.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
            No distinct process bottlenecks or non-conformances identified in this session.
          </div>
        ) : (
          card.issues.map((issue, idx) => (
            <div
              key={idx}
              className="bg-white border border-[#E7DECD] rounded-xl p-5 shadow-xs hover:border-[#C9A227]/70 transition-colors"
            >
              <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 text-xs font-semibold rounded border bg-[#7A1F2B]/10 text-[#7A1F2B] border-[#7A1F2B]/20">
                      {issue.category}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs font-semibold rounded border ${getImpactBadge(
                        issue.impact
                      )}`}
                    >
                      {issue.impact} Impact
                    </span>
                    {issue.relatedStandard && issue.relatedStandard !== 'None' && (
                      <span className="px-2 py-0.5 text-xs font-mono font-medium rounded border bg-indigo-50 text-indigo-700 border-indigo-200 flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {issue.relatedStandard}
                      </span>
                    )}
                  </div>
                  <h5 className="font-serif text-base font-bold text-slate-900 pt-1">
                    {issue.title}
                  </h5>
                </div>

                {isAdmin && onCreateAction && (
                  <button
                    onClick={() => onCreateAction(issue)}
                    className="px-3 py-1.5 bg-[#7A1F2B] hover:bg-[#601822] text-white text-xs font-medium rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-[#C9A227]" />
                    <span>Create improvement action</span>
                  </button>
                )}
              </div>

              {/* Employee Quote */}
              {issue.employeeQuote && (
                <div className="my-3 p-3 bg-slate-50 border-l-4 border-[#C9A227] rounded-r-lg text-xs text-slate-700 italic flex items-start gap-2">
                  <Quote className="w-4 h-4 text-[#C9A227] shrink-0 mt-0.5" />
                  <span>"{issue.employeeQuote}"</span>
                </div>
              )}

              {/* Root Cause Ladder */}
              <RootCauseLadder
                whyChain={issue.whyChain}
                rootCause={issue.rootCause}
                problemTitle={issue.title}
              />

              {/* Suggested Action */}
              <div className="mt-3 p-3 bg-[#FAF7F2] border border-[#E7DECD] rounded-lg text-xs">
                <span className="font-bold text-[#7A1F2B] block mb-1">
                  Suggested Action & Verification:
                </span>
                <p className="text-slate-800 leading-relaxed">{issue.suggestedAction}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Overall Observation */}
      {card.overallObservation && (
        <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4 text-xs text-amber-950">
          <span className="font-bold block mb-1">Overall Quality Observation:</span>
          <p className="leading-relaxed">{card.overallObservation}</p>
        </div>
      )}
    </div>
  );
};
