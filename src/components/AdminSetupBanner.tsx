import React, { useState } from 'react';
import { ShieldAlert, Copy, Check, ExternalLink } from 'lucide-react';

interface AdminSetupBannerProps {
  uid: string;
  email: string;
}

export const AdminSetupBanner: React.FC<AdminSetupBannerProps> = ({ uid, email }) => {
  const [copiedPath, setCopiedPath] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);

  const docPath = `admins/${uid}`;

  const copyToClipboard = (text: string, type: 'path' | 'uid') => {
    navigator.clipboard.writeText(text);
    if (type === 'path') {
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
    } else {
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
    }
  };

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl p-5 shadow-sm text-xs text-amber-950 my-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-amber-200/80 text-amber-900 flex items-center justify-center shrink-0 mt-0.5">
          <ShieldAlert className="w-5 h-5 text-[#7A1F2B]" />
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-serif font-bold text-sm text-[#7A1F2B]">
              Super Administrator Setup Required
            </h4>
            <span className="px-2 py-0.5 bg-amber-200 text-amber-900 font-semibold rounded text-[11px]">
              Directive 8 Verification
            </span>
          </div>

          <p className="text-slate-700 leading-relaxed">
            You are signed in as <strong className="text-[#7A1F2B]">{email}</strong> (the designated super administrator).
            To activate admin privileges (Check Sheets, PDCA Board, Quality Baseline, Consolidated Reports), create your role document in the Firebase Console:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div className="p-3 bg-white rounded-lg border border-amber-200 space-y-1">
              <span className="font-semibold text-slate-700 block">Exact Document Path:</span>
              <div className="flex items-center justify-between bg-slate-50 px-2 py-1.5 rounded font-mono text-[11px] text-slate-900 border border-slate-200">
                <span className="truncate">{docPath}</span>
                <button
                  onClick={() => copyToClipboard(docPath, 'path')}
                  className="p-1 hover:text-[#7A1F2B] cursor-pointer"
                  title="Copy Document Path"
                >
                  {copiedPath ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="p-3 bg-white rounded-lg border border-amber-200 space-y-1">
              <span className="font-semibold text-slate-700 block">Required Field:</span>
              <div className="bg-slate-50 px-2 py-1.5 rounded font-mono text-[11px] text-slate-900 border border-slate-200">
                Field: <strong className="text-[#7A1F2B]">role</strong> (string) = <strong className="text-emerald-700">"superadmin"</strong>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 pt-1">
            After creating this single document in the Firebase Console, refresh this page to instantly unlock all administrator controls.
          </p>
        </div>
      </div>
    </div>
  );
};
