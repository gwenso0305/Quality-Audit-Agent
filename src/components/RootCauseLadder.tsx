import React from 'react';
import { ArrowDown, CheckCircle2, HelpCircle } from 'lucide-react';

interface RootCauseLadderProps {
  whyChain: string[];
  rootCause: string;
  problemTitle?: string;
}

export const RootCauseLadder: React.FC<RootCauseLadderProps> = ({
  whyChain,
  rootCause,
  problemTitle,
}) => {
  if (!whyChain || whyChain.length === 0) {
    return (
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-3 text-xs text-amber-900">
        <span className="font-semibold">Root Cause:</span> {rootCause}
      </div>
    );
  }

  return (
    <div className="my-3 p-4 bg-[#FAF7F2] border border-[#E7DECD] rounded-xl">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2.5 h-2.5 rounded-full bg-[#7A1F2B]"></span>
        <h5 className="text-xs font-semibold uppercase tracking-wider text-[#7A1F2B]">
          5 Whys Root Cause Ladder
        </h5>
      </div>

      <div className="space-y-2">
        {/* Step 0: Starting Problem / Observation */}
        {problemTitle && (
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className="w-6 h-6 rounded-full bg-[#7A1F2B] text-white flex items-center justify-center text-xs font-bold shrink-0">
                0
              </div>
              <div className="w-0.5 h-4 bg-[#7A1F2B]/30 my-0.5" />
            </div>
            <div className="pt-0.5 pb-2 text-xs">
              <span className="font-semibold text-slate-800">Problem:</span>{' '}
              <span className="text-slate-700">{problemTitle}</span>
            </div>
          </div>
        )}

        {/* Why chain steps */}
        {whyChain.map((step, idx) => {
          const isLast = idx === whyChain.length - 1;
          return (
            <div key={idx} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className="w-6 h-6 rounded-full bg-amber-100 border border-amber-400 text-amber-900 flex items-center justify-center text-xs font-semibold shrink-0">
                  {idx + 1}
                </div>
                {!isLast && <div className="w-0.5 h-4 bg-amber-300 my-0.5" />}
                {isLast && <div className="w-0.5 h-4 bg-emerald-400 my-0.5" />}
              </div>
              <div className="pt-0.5 pb-1 text-xs">
                <span className="font-medium text-amber-950">Why {idx + 1}:</span>{' '}
                <span className="text-slate-700">{step}</span>
              </div>
            </div>
          );
        })}

        {/* Final Root Cause */}
        <div className="flex items-start gap-3 pt-1">
          <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-950 flex-1">
            <span className="font-bold text-emerald-800 block mb-0.5">Identified Root Cause:</span>
            <span>{rootCause}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
