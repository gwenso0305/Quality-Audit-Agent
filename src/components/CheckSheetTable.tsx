import React, { useState } from 'react';
import { AuditSession, RoleCategory } from '../types';
import { X, Quote, Tag, PlusCircle } from 'lucide-react';

interface CheckSheetTableProps {
  sessions: AuditSession[];
  onCreateAction?: (issue: any) => void;
}

const CATEGORIES = [
  'Instruction & Learning Materials',
  'Assessment & Grading',
  'Laboratory & Equipment',
  'Records & Documentation',
  'Communication & Coordination',
  'Policies & Procedures',
  'Workload & Staffing',
  'Student Support',
];

const ROLES: RoleCategory[] = ['Faculty', 'Program Head', 'Administrative Staff'];

interface SelectedCellData {
  category: string;
  role: string;
  issues: Array<{
    session: AuditSession;
    issue: any;
  }>;
}

export const CheckSheetTable: React.FC<CheckSheetTableProps> = ({
  sessions,
  onCreateAction,
}) => {
  const [selectedCell, setSelectedCell] = useState<SelectedCellData | null>(null);

  // Completed sessions only
  const completed = sessions.filter((s) => s.status === 'completed');

  // Matrix: [category][role] = list of issues with their session
  const matrix: Record<string, Record<string, Array<{ session: AuditSession; issue: any }>>> = {};
  CATEGORIES.forEach((cat) => {
    matrix[cat] = {
      Faculty: [],
      'Program Head': [],
      'Administrative Staff': [],
    };
  });

  completed.forEach((session) => {
    const roleCat = (session.profileSnapshot?.roleCategory as RoleCategory) || 'Faculty';
    if (session.auditCard?.issues) {
      session.auditCard.issues.forEach((issue) => {
        const cat = CATEGORIES.includes(issue.category) ? issue.category : 'Policies & Procedures';
        if (matrix[cat] && matrix[cat][roleCat]) {
          matrix[cat][roleCat].push({ session, issue });
        }
      });
    }
  });

  // Calculate totals
  const columnTotals: Record<string, number> = {
    Faculty: 0,
    'Program Head': 0,
    'Administrative Staff': 0,
  };

  let grandTotal = 0;

  CATEGORIES.forEach((cat) => {
    ROLES.forEach((role) => {
      const count = matrix[cat][role].length;
      columnTotals[role] += count;
      grandTotal += count;
    });
  });

  const handleCellClick = (cat: string, role: string) => {
    const list = matrix[cat][role];
    if (list.length > 0) {
      setSelectedCell({ category: cat, role, issues: list });
    }
  };

  return (
    <div className="bg-white border border-[#E7DECD] rounded-xl p-5 shadow-xs">
      <div className="mb-4">
        <h3 className="font-serif text-lg font-bold text-[#7A1F2B]">
          TQM Check Sheet (Process Defect & Issue Frequency)
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Tally of all process challenges recorded across completed audits by issue and role category.
          Click any cell with recorded counts to view specific issues.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#FAF7F2] border-b border-[#E7DECD]">
              <th className="py-3 px-3 font-semibold text-slate-700">Issue Category</th>
              {ROLES.map((role) => (
                <th key={role} className="py-3 px-3 font-semibold text-slate-700 text-center">
                  {role}
                </th>
              ))}
              <th className="py-3 px-3 font-bold text-[#7A1F2B] text-center bg-amber-50/50">
                Row Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFE8DA]">
            {CATEGORIES.map((cat) => {
              const rowTotal = ROLES.reduce((acc, role) => acc + matrix[cat][role].length, 0);

              return (
                <tr key={cat} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-3 font-medium text-slate-800">{cat}</td>
                  {ROLES.map((role) => {
                    const count = matrix[cat][role].length;
                    const hasIssues = count > 0;
                    return (
                      <td key={role} className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handleCellClick(cat, role)}
                          disabled={!hasIssues}
                          className={`w-8 h-8 mx-auto rounded-md font-semibold inline-flex items-center justify-center transition-all ${
                            hasIssues
                              ? 'bg-amber-100 hover:bg-[#7A1F2B] text-amber-900 hover:text-white cursor-pointer shadow-2xs hover:scale-105'
                              : 'text-slate-300 cursor-default'
                          }`}
                        >
                          {count}
                        </button>
                      </td>
                    );
                  })}
                  <td className="py-2.5 px-3 text-center font-bold text-[#7A1F2B] bg-amber-50/30">
                    {rowTotal}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-[#FAF7F2] font-bold border-t-2 border-[#E7DECD]">
              <td className="py-3 px-3 text-[#7A1F2B]">Column Totals</td>
              {ROLES.map((role) => (
                <td key={role} className="py-3 px-3 text-center text-[#7A1F2B]">
                  {columnTotals[role]}
                </td>
              ))}
              <td className="py-3 px-3 text-center text-sm font-extrabold text-[#7A1F2B] bg-amber-100/60">
                {grandTotal}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* In-app Drilldown Modal */}
      {selectedCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-xl border border-[#E7DECD]">
            <div className="p-4 bg-[#7A1F2B] text-white flex items-center justify-between">
              <div>
                <h4 className="font-serif font-bold text-sm text-[#FDFBF7]">
                  {selectedCell.category}
                </h4>
                <p className="text-xs text-amber-200">
                  Role: {selectedCell.role} ({selectedCell.issues.length} reported issues)
                </p>
              </div>
              <button
                onClick={() => setSelectedCell(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              {selectedCell.issues.map(({ session, issue }, i) => (
                <div key={i} className="p-3.5 bg-[#FAF7F2] border border-[#E7DECD] rounded-lg">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h5 className="font-serif font-bold text-xs text-slate-900">{issue.title}</h5>
                      <p className="text-[11px] text-slate-500">
                        Interviewee: {session.profileSnapshot?.displayName || 'Faculty'} (
                        {session.profileSnapshot?.position || 'Staff'})
                      </p>
                    </div>
                    {onCreateAction && (
                      <button
                        onClick={() => {
                          onCreateAction(issue);
                          setSelectedCell(null);
                        }}
                        className="px-2 py-1 bg-[#7A1F2B] hover:bg-[#601822] text-white text-[11px] font-medium rounded flex items-center gap-1 cursor-pointer"
                      >
                        <PlusCircle className="w-3 h-3 text-[#C9A227]" />
                        <span>Action</span>
                      </button>
                    )}
                  </div>

                  {issue.employeeQuote && (
                    <div className="my-2 p-2 bg-white rounded border border-slate-200 text-xs text-slate-700 italic flex items-start gap-1.5">
                      <Quote className="w-3.5 h-3.5 text-[#C9A227] shrink-0 mt-0.5" />
                      <span>"{issue.employeeQuote}"</span>
                    </div>
                  )}

                  <div className="text-xs text-slate-700 mt-2">
                    <span className="font-semibold text-[#7A1F2B]">Root Cause: </span>
                    {issue.rootCause}
                  </div>

                  {issue.relatedStandard && issue.relatedStandard !== 'None' && (
                    <div className="mt-2">
                      <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-indigo-50 text-indigo-700 border border-indigo-200 inline-flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {issue.relatedStandard}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedCell(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-medium rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
