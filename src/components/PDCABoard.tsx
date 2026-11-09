import React, { useState } from 'react';
import { ImprovementAction, PDCAColumn } from '../types';
import { Plus, Trash2, ArrowRight, ArrowLeft, Tag, Calendar, User, CheckCircle2 } from 'lucide-react';

interface PDCABoardProps {
  actions: ImprovementAction[];
  onAddAction: (action: Omit<ImprovementAction, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onMoveAction: (id: string, newColumn: PDCAColumn) => Promise<void>;
  onDeleteAction: (id: string) => Promise<void>;
  prefilledIssue?: any | null;
  onClearPrefilled?: () => void;
}

const COLUMNS: { key: PDCAColumn; label: string; desc: string; color: string; badge: string }[] = [
  {
    key: 'Plan',
    label: 'Plan',
    desc: 'Identify problem, establish objectives & targets',
    color: 'border-blue-300 bg-blue-50/40',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  {
    key: 'Do',
    label: 'Do',
    desc: 'Implement solutions & train staff on changes',
    color: 'border-amber-300 bg-amber-50/40',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  {
    key: 'Check',
    label: 'Check',
    desc: 'Monitor KPI results & verify effectiveness',
    color: 'border-purple-300 bg-purple-50/40',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  {
    key: 'Act',
    label: 'Act',
    desc: 'Standardize into SOP or iterate if needed',
    color: 'border-emerald-300 bg-emerald-50/40',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
];

export const PDCABoard: React.FC<PDCABoardProps> = ({
  actions,
  onAddAction,
  onMoveAction,
  onDeleteAction,
  prefilledIssue,
  onClearPrefilled,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [owner, setOwner] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('Policies & Procedures');
  const [standardCode, setStandardCode] = useState('None');
  const [column, setColumn] = useState<PDCAColumn>('Plan');
  const [submitting, setSubmitting] = useState(false);

  // If a prefilled issue is passed from another component, open modal with its details
  React.useEffect(() => {
    if (prefilledIssue) {
      setTitle(prefilledIssue.suggestedAction || prefilledIssue.title || '');
      setCategory(prefilledIssue.category || 'Policies & Procedures');
      setStandardCode(prefilledIssue.relatedStandard || 'None');
      setNotes(`Originating Issue: ${prefilledIssue.title}\nRoot Cause: ${prefilledIssue.rootCause || ''}`);
      setColumn('Plan');
      setIsModalOpen(true);
    }
  }, [prefilledIssue]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTitle('');
    setOwner('');
    setTargetDate('');
    setNotes('');
    setCategory('Policies & Procedures');
    setStandardCode('None');
    setColumn('Plan');
    if (onClearPrefilled) onClearPrefilled();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !owner.trim()) return;

    setSubmitting(true);
    try {
      await onAddAction({
        title: title.trim(),
        owner: owner.trim(),
        targetDate: targetDate.trim(),
        notes: notes.trim(),
        category,
        standardCode,
        column,
      });
      handleCloseModal();
    } catch (err) {
      console.error('Failed to create improvement action:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-[#E7DECD] rounded-xl p-5 shadow-xs">
        <div>
          <h3 className="font-serif text-lg font-bold text-[#7A1F2B]">
            PDCA Continuous Improvement Board
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Track root cause countermeasures through Deming's Plan-Do-Check-Act quality cycle.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-[#7A1F2B] hover:bg-[#601822] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
        >
          <Plus className="w-4 h-4 text-[#C9A227]" />
          <span>New Action Item</span>
        </button>
      </div>

      {/* 4 Columns Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const colActions = actions.filter((a) => a.column === col.key);

          return (
            <div
              key={col.key}
              className={`rounded-xl border flex flex-col p-3 shadow-2xs ${col.color}`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-1">
                <span className={`px-2.5 py-0.5 text-xs font-bold rounded border ${col.badge}`}>
                  {col.label}
                </span>
                <span className="text-xs font-bold text-slate-600 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                  {colActions.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mb-3">{col.desc}</p>

              {/* Action Cards */}
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-0.5">
                {colActions.length === 0 ? (
                  <div className="p-4 rounded-lg border border-dashed border-slate-300 text-center text-xs text-slate-400">
                    No actions in {col.label}
                  </div>
                ) : (
                  colActions.map((action) => (
                    <div
                      key={action.id}
                      className="bg-white rounded-lg p-3.5 border border-[#E7DECD] shadow-xs space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <h5 className="font-semibold text-xs text-slate-900 leading-snug">
                          {action.title}
                        </h5>
                        <button
                          onClick={() => onDeleteAction(action.id)}
                          title="Delete Action"
                          className="text-slate-400 hover:text-red-600 p-0.5 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium border border-slate-200">
                          {action.category}
                        </span>
                        {action.standardCode && action.standardCode !== 'None' && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono border border-indigo-200 flex items-center gap-0.5">
                            <Tag className="w-2.5 h-2.5" />
                            {action.standardCode}
                          </span>
                        )}
                      </div>

                      {action.notes && (
                        <p className="text-[11px] text-slate-600 bg-[#FAF7F2] p-2 rounded border border-[#EFE8DA] whitespace-pre-wrap">
                          {action.notes}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          <User className="w-3 h-3 text-[#7A1F2B]" />
                          {action.owner}
                        </span>
                        {action.targetDate && (
                          <span className="flex items-center gap-1 text-slate-500">
                            <Calendar className="w-3 h-3 text-amber-600" />
                            {action.targetDate}
                          </span>
                        )}
                      </div>

                      {/* Movement Buttons (Per Directive: Buttons, NOT drag and drop) */}
                      <div className="pt-2 flex items-center justify-between gap-1 border-t border-slate-100">
                        {col.key === 'Plan' && (
                          <button
                            onClick={() => onMoveAction(action.id, 'Do')}
                            className="w-full py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11px] font-semibold rounded border border-amber-300 flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <span>Move to Do</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}

                        {col.key === 'Do' && (
                          <>
                            <button
                              onClick={() => onMoveAction(action.id, 'Plan')}
                              className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-medium rounded border border-slate-200 flex items-center gap-1 cursor-pointer"
                            >
                              <ArrowLeft className="w-3 h-3" />
                              <span>Plan</span>
                            </button>
                            <button
                              onClick={() => onMoveAction(action.id, 'Check')}
                              className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-900 text-[11px] font-semibold rounded border border-purple-300 flex items-center gap-1 cursor-pointer"
                            >
                              <span>Check</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </>
                        )}

                        {col.key === 'Check' && (
                          <>
                            <button
                              onClick={() => onMoveAction(action.id, 'Do')}
                              className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-medium rounded border border-slate-200 flex items-center gap-1 cursor-pointer"
                            >
                              <ArrowLeft className="w-3 h-3" />
                              <span>Do</span>
                            </button>
                            <button
                              onClick={() => onMoveAction(action.id, 'Act')}
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-[11px] font-semibold rounded border border-emerald-300 flex items-center gap-1 cursor-pointer"
                            >
                              <span>Act</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </>
                        )}

                        {col.key === 'Act' && (
                          <>
                            <button
                              onClick={() => onMoveAction(action.id, 'Check')}
                              className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-medium rounded border border-slate-200 flex items-center gap-1 cursor-pointer"
                            >
                              <ArrowLeft className="w-3 h-3" />
                              <span>Check</span>
                            </button>
                            <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Standardized
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-lg w-full p-5 shadow-2xl border border-[#E7DECD]">
            <h4 className="font-serif font-bold text-base text-[#7A1F2B] mb-1">
              Create Improvement Action
            </h4>
            <p className="text-xs text-slate-500 mb-4">
              Enter target countermeasure details to advance on the PDCA board.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Action Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Update Syllabus template to include unified grading rubric"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7A1F2B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Owner *</label>
                  <input
                    type="text"
                    required
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    placeholder="e.g., Program Head, Lab Custodian"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7A1F2B]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Date</label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7A1F2B]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7A1F2B]"
                  >
                    <option value="Instruction & Learning Materials">Instruction & Learning Materials</option>
                    <option value="Assessment & Grading">Assessment & Grading</option>
                    <option value="Laboratory & Equipment">Laboratory & Equipment</option>
                    <option value="Records & Documentation">Records & Documentation</option>
                    <option value="Communication & Coordination">Communication & Coordination</option>
                    <option value="Policies & Procedures">Policies & Procedures</option>
                    <option value="Workload & Staffing">Workload & Staffing</option>
                    <option value="Student Support">Student Support</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Standard Code</label>
                  <input
                    type="text"
                    value={standardCode}
                    onChange={(e) => setStandardCode(e.target.value)}
                    placeholder="e.g. INS-5.3 or None"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7A1F2B]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Stage</label>
                <select
                  value={column}
                  onChange={(e) => setColumn(e.target.value as PDCAColumn)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7A1F2B]"
                >
                  <option value="Plan">Plan</option>
                  <option value="Do">Do</option>
                  <option value="Check">Check</option>
                  <option value="Act">Act</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes / Root Cause Context</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional context, implementation notes, or KPI targets..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7A1F2B]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#7A1F2B] hover:bg-[#601822] text-white font-semibold rounded-lg cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Create Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
