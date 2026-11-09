import React, { useState } from 'react';
import { UserProfile, RoleCategory } from '../types';
import { UserCheck, X, AlertCircle } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  initialProfile?: Partial<UserProfile>;
  onSave: (profile: UserProfile) => Promise<void>;
  onClose?: () => void;
  isFirstTime?: boolean;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  initialProfile,
  onSave,
  onClose,
  isFirstTime = false,
}) => {
  const [department, setDepartment] = useState(
    initialProfile?.department || 'Department of Computing Education'
  );
  const [roleCategory, setRoleCategory] = useState<RoleCategory>(
    initialProfile?.roleCategory || 'Faculty'
  );
  const [position, setPosition] = useState(initialProfile?.position || '');
  const [jobFunction, setJobFunction] = useState(initialProfile?.jobFunction || '');
  const [yearsInRole, setYearsInRole] = useState<number>(initialProfile?.yearsInRole ?? 2);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!department.trim()) {
      setError('Department is required.');
      return;
    }
    if (!position.trim()) {
      setError('Position/Designation is required.');
      return;
    }
    if (!jobFunction.trim()) {
      setError('Job function summary is required.');
      return;
    }
    if (isNaN(yearsInRole) || yearsInRole < 0 || yearsInRole > 50) {
      setError('Years in role must be a whole number between 0 and 50.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        department: department.trim(),
        roleCategory,
        position: position.trim(),
        jobFunction: jobFunction.trim(),
        yearsInRole: Math.round(yearsInRole),
      });
      if (onClose) onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#E7DECD] text-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-100 text-[#7A1F2B] flex items-center justify-center font-bold">
              <UserCheck className="w-4 h-4 text-[#C9A227]" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-[#7A1F2B]">
                {isFirstTime ? 'Complete Your Auditor Profile' : 'Edit Professional Profile'}
              </h3>
              <p className="text-[11px] text-slate-500">
                Department of Computing Education • UM Visayan Campus
              </p>
            </div>
          </div>
          {!isFirstTime && onClose && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Department</label>
            <input
              type="text"
              required
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7A1F2B]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Role Category *</label>
              <select
                value={roleCategory}
                onChange={(e) => setRoleCategory(e.target.value as RoleCategory)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7A1F2B]"
              >
                <option value="Faculty">Faculty</option>
                <option value="Program Head">Program Head</option>
                <option value="Administrative Staff">Administrative Staff</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Years in Role (0-50) *</label>
              <input
                type="number"
                min={0}
                max={50}
                required
                value={yearsInRole}
                onChange={(e) => setYearsInRole(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7A1F2B]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Position / Designation *</label>
            <input
              type="text"
              required
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="e.g. BSIT Instructor, Computer Lab Custodian"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7A1F2B]"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Primary Job Function *</label>
            <textarea
              rows={3}
              required
              value={jobFunction}
              onChange={(e) => setJobFunction(e.target.value)}
              placeholder="Describe your regular responsibilities (e.g., Programming instruction, syllabus updates, lab equipment maintenance)..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7A1F2B]"
            />
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-slate-200">
            {!isFirstTime && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg cursor-pointer"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-[#7A1F2B] hover:bg-[#601822] text-white font-semibold rounded-lg cursor-pointer shadow-xs disabled:opacity-50"
            >
              {saving ? 'Saving Profile...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
