import React, { useState } from 'react';
import { BaselineDoc, BaselineSettings } from '../types';
import { Upload, FileText, Trash2, Eye, Plus, AlertCircle, X, ShieldCheck } from 'lucide-react';

interface BaselineManagerProps {
  baseline: BaselineSettings;
  onSaveBaseline: (newDocuments: BaselineDoc[]) => Promise<void>;
}

const MAX_TOTAL_CHARS = 800000;
const MAX_FILE_BYTES = 200 * 1024; // 200 KB

export const BaselineManager: React.FC<BaselineManagerProps> = ({
  baseline,
  onSaveBaseline,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<BaselineDoc | null>(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [fileError, setFileError] = useState('');
  const [saving, setSaving] = useState(false);

  const documents = baseline?.documents || [];
  const currentTotalChars = documents.reduce((acc, d) => acc + (d.sizeChars || 0), 0);
  const percentage = Math.min(100, Math.round((currentTotalChars / MAX_TOTAL_CHARS) * 100));

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('');
    const file = e.target.files?.[0];
    if (!file) return;

    // Check extension
    const name = file.name;
    const isMdOrTxt = name.endsWith('.md') || name.endsWith('.txt');
    if (!isMdOrTxt) {
      setFileError('Invalid file type. Only .md and .txt files are allowed.');
      return;
    }

    // Check size limit: max 200 KB
    if (file.size > MAX_FILE_BYTES) {
      setFileError('File exceeds the 200 KB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (typeof content === 'string') {
        const potentialTotal = currentTotalChars + content.length;
        if (potentialTotal > MAX_TOTAL_CHARS) {
          setFileError(`Adding this file would exceed the department 800,000 character baseline limit (${potentialTotal} chars).`);
          return;
        }
        setTitle(name.replace(/\.(md|txt)$/i, ''));
        setText(content);
      }
    };
    reader.readAsText(file);
  };

  const handleSaveDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setFileError('');
    if (!title.trim() || !text.trim()) {
      setFileError('Title and document content are required.');
      return;
    }

    const potentialTotal = currentTotalChars + text.length;
    if (potentialTotal > MAX_TOTAL_CHARS) {
      setFileError(`This document exceeds the remaining baseline capacity. Total would be ${potentialTotal} / 800,000 characters.`);
      return;
    }

    const newDoc: BaselineDoc = {
      id: crypto.randomUUID(),
      title: title.trim(),
      text: text,
      sizeChars: text.length,
      uploadedAt: new Date().toISOString(),
    };

    setSaving(true);
    try {
      await onSaveBaseline([...documents, newDoc]);
      setIsAddModalOpen(false);
      setTitle('');
      setText('');
    } catch (err: any) {
      setFileError(err.message || 'Failed to save baseline document.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const updated = documents.filter((d) => d.id !== id);
    setSaving(true);
    try {
      await onSaveBaseline(updated);
    } catch (err: any) {
      console.error('Failed to delete document:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Overview header */}
      <div className="bg-white border border-[#E7DECD] rounded-xl p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-serif text-lg font-bold text-[#7A1F2B] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#C9A227]" />
              <span>Department Quality Standards Baseline</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Authoritative TQM standards (INS-*, PRG-*, OFF-*, DCE-*) referenced by the Audit Agent.
              Stored in a single unified settings document.
            </p>
          </div>
          <button
            onClick={() => {
              setFileError('');
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2 bg-[#7A1F2B] hover:bg-[#601822] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4 text-[#C9A227]" />
            <span>Add Standard Document</span>
          </button>
        </div>

        {/* Capacity Bar */}
        <div className="bg-[#FAF7F2] p-3.5 rounded-xl border border-[#E7DECD]">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-slate-700">Storage Capacity Limit:</span>
            <span className="text-slate-600 font-mono">
              {currentTotalChars.toLocaleString()} / {MAX_TOTAL_CHARS.toLocaleString()} characters ({percentage}%)
            </span>
          </div>
          <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                percentage > 90 ? 'bg-red-600' : percentage > 70 ? 'bg-amber-500' : 'bg-[#7A1F2B]'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Documents List */}
      <div className="bg-white border border-[#E7DECD] rounded-xl p-5 shadow-xs">
        <h4 className="font-serif text-sm font-bold text-slate-800 mb-3">
          Uploaded Quality Documents ({documents.length})
        </h4>

        {documents.length === 0 ? (
          <div className="p-8 border border-dashed border-slate-300 rounded-xl text-center">
            <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-600">No quality standard documents uploaded yet.</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Upload Department of Computing Education standards (.md or .txt files, e.g., INS-5.3, PRG-2.1).
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#EFE8DA] border border-[#EFE8DA] rounded-lg overflow-hidden">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="p-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-[#FAF7F2] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-[#7A1F2B] shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-xs text-slate-900">{doc.title}</h5>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                      <span>{(doc.sizeChars || 0).toLocaleString()} characters</span>
                      <span>•</span>
                      <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewingDoc(doc)}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#7A1F2B]" />
                    <span>View Text</span>
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-medium rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* View Document Modal */}
      {viewingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-[#E7DECD]">
            <div className="p-4 bg-[#7A1F2B] text-white flex items-center justify-between">
              <div>
                <h4 className="font-serif font-bold text-sm text-[#FDFBF7]">{viewingDoc.title}</h4>
                <p className="text-xs text-amber-200">
                  {viewingDoc.sizeChars.toLocaleString()} characters • Uploaded{' '}
                  {new Date(viewingDoc.uploadedAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => setViewingDoc(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 font-mono text-xs text-slate-800 bg-[#FAF7F2] whitespace-pre-wrap leading-relaxed select-text">
              {viewingDoc.text}
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setViewingDoc(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-medium rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Document Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-xl w-full p-5 shadow-2xl border border-[#E7DECD]">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-serif font-bold text-base text-[#7A1F2B]">
                Upload or Paste Quality Standard
              </h4>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {fileError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{fileError}</span>
              </div>
            )}

            <form onSubmit={handleSaveDoc} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Upload File (.md or .txt, max 200 KB)
                </label>
                <input
                  type="file"
                  accept=".md,.txt"
                  onChange={handleFileUpload}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-100 file:text-[#7A1F2B] hover:file:bg-amber-200 cursor-pointer"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Document Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., DCE BSIT Faculty Instruction Standards (INS-5.3)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7A1F2B]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Document Text (Exact standard text with codes) *
                </label>
                <textarea
                  rows={8}
                  required
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste or review file text here. Keep standard codes intact (e.g. INS-5.3, PRG-2.1, OFF-1.2, DCE-1.0)..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7A1F2B] font-mono text-[11px]"
                />
                <div className="flex justify-end text-[10px] text-slate-400 mt-1">
                  {text.length.toLocaleString()} characters
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-[#7A1F2B] hover:bg-[#601822] text-white font-semibold rounded-lg cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
