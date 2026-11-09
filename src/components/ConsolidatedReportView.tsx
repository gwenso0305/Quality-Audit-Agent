import React, { useState } from 'react';
import { AuditReportDoc, AuditSession } from '../types';
import { SafeMarkdown } from './SafeMarkdown';
import { FileDown, Sparkles, Save, Clock, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';

interface ConsolidatedReportViewProps {
  pastReports: AuditReportDoc[];
  allSessions: AuditSession[];
  onGenerateReport: () => Promise<{ markdown: string; stats: any; modelUsed?: string }>;
  onSaveReport: (report: Omit<AuditReportDoc, 'id' | 'createdAt'>) => Promise<void>;
  onExportTranscripts: () => void;
}

export const ConsolidatedReportView: React.FC<ConsolidatedReportViewProps> = ({
  pastReports,
  allSessions,
  onGenerateReport,
  onSaveReport,
  onExportTranscripts,
}) => {
  const [generating, setGenerating] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [currentReport, setCurrentReport] = useState<{
    markdown: string;
    stats: any;
    modelUsed?: string;
  } | null>(null);
  const [selectedPastReport, setSelectedPastReport] = useState<AuditReportDoc | null>(null);
  const [reportTitle, setReportTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const completedSessions = allSessions.filter((s) => s.status === 'completed');

  const handleGenerate = async () => {
    setGenerating(true);
    setSeconds(0);
    setStatusMessage('Server computing metrics and initiating Gemini report synthesis...');
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);

    try {
      const res = await onGenerateReport();
      setCurrentReport(res);
      setSelectedPastReport(null);
      setReportTitle(
        `Consolidated Quality Audit Report - ${new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}`
      );
    } catch (err: any) {
      console.error('Failed to generate report:', err);
      setStatusMessage(`Error: ${err.message || 'Generation failed'}`);
    } finally {
      clearInterval(timer);
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!currentReport) return;
    setSaving(true);
    try {
      await onSaveReport({
        title: reportTitle.trim() || 'Consolidated Quality Audit Report',
        markdown: currentReport.markdown,
        stats: currentReport.stats,
        modelUsed: currentReport.modelUsed,
      });
      alert('Report saved to department archives successfully.');
    } catch (err: any) {
      console.error('Failed to save report:', err);
    } finally {
      setSaving(false);
    }
  };

  const downloadMarkdownFile = (title: string, markdown: string) => {
    const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.md`;
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const activeMarkdown = selectedPastReport ? selectedPastReport.markdown : currentReport?.markdown;
  const activeTitle = selectedPastReport ? selectedPastReport.title : reportTitle;

  return (
    <div className="space-y-6">
      {/* Header card with actions */}
      <div className="bg-white border border-[#E7DECD] rounded-xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-serif text-lg font-bold text-[#7A1F2B]">
            Consolidated Quality Audit Reports
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Server computes metrics and Check Sheets; Gemini drafts executive narrative with Prompt C.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onExportTranscripts}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors border border-slate-300"
          >
            <FileDown className="w-4 h-4 text-[#7A1F2B]" />
            <span>Export All Transcripts (.md)</span>
          </button>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 bg-[#7A1F2B] hover:bg-[#601822] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-[#C9A227]" />
            <span>{generating ? `Synthesizing (${seconds}s)...` : 'Generate Consolidated Report'}</span>
          </button>
        </div>
      </div>

      {generating && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-xs text-amber-900 animate-pulse">
          <Clock className="w-5 h-5 text-amber-700 animate-spin" />
          <div>
            <span className="font-bold">Analyzing Department Audit Data ({seconds}s elapsed)...</span>
            <p className="text-amber-800">{statusMessage}</p>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Past Reports List */}
        <div className="lg:col-span-1 bg-white border border-[#E7DECD] rounded-xl p-4 shadow-xs space-y-3">
          <h4 className="font-serif text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            Archived Reports ({pastReports.length})
          </h4>

          {pastReports.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No archived reports yet.</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {pastReports.map((rep) => {
                const isSelected = selectedPastReport?.id === rep.id;
                return (
                  <button
                    key={rep.id}
                    onClick={() => {
                      setSelectedPastReport(rep);
                      setCurrentReport(null);
                    }}
                    className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#7A1F2B] bg-[#FAF7F2] font-semibold text-[#7A1F2B]'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="truncate font-medium">{rep.title}</div>
                    <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-amber-600" />
                      <span>{new Date(rep.createdAt).toLocaleDateString()}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Active Report Viewer */}
        <div className="lg:col-span-3 space-y-4">
          {activeMarkdown ? (
            <div className="bg-white border border-[#E7DECD] rounded-xl p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#7A1F2B]">{activeTitle}</h3>
                  {currentReport?.modelUsed && (
                    <span className="text-[11px] text-slate-400">
                      Generated via {currentReport.modelUsed}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {currentReport && !selectedPastReport && (
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 shadow-2xs cursor-pointer disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{saving ? 'Saving...' : 'Save to Archive'}</span>
                    </button>
                  )}

                  <button
                    onClick={() => downloadMarkdownFile(activeTitle, activeMarkdown)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1 border border-slate-300 cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5 text-[#7A1F2B]" />
                    <span>Download .md</span>
                  </button>
                </div>
              </div>

              {/* Rendered Safe Markdown */}
              <div className="pt-2">
                <SafeMarkdown content={activeMarkdown} />
              </div>
            </div>
          ) : (
            <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center text-slate-400">
              <Sparkles className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-medium text-slate-600">No report selected.</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Click "Generate Consolidated Report" to synthesize all completed audits ({completedSessions.length} available) or select an archived report from the left.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
