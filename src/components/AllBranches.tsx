import { useState, useMemo } from 'react';
import {
  Search, X, Building2, Plus, MapPin, Users,
  GraduationCap, FileText, CheckCircle, CheckCircle as CheckIcon, Trash2,
} from 'lucide-react';
import { Branch, StaffMember, IntakeStudent, ApplicationRecord } from '../types';
import { computeBranchLiveStats, type BranchLiveStats } from '../branchLiveStats';

interface AllBranchesProps {
  branches: Branch[];
  staff: StaffMember[];
  students: IntakeStudent[];
  applications: ApplicationRecord[];
  onAddBranch: (branch: Branch) => void;
  onDeleteBranch: (id: string) => void;
}

export default function AllBranches({ branches, staff, students, applications, onAddBranch, onDeleteBranch }: AllBranchesProps) {
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [newBranch, setNewBranch] = useState({ name: '', location: '' });

  const statsByBranch = useMemo(() => {
    const map = new Map<string, BranchLiveStats>();
    branches.forEach((b) => map.set(b.name, computeBranchLiveStats(b.name, staff, students, applications)));
    return map;
  }, [branches, staff, students, applications]);

  const filtered = useMemo(() => {
    return branches.filter((b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      (b.manager || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [branches, search]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const branch: Branch = {
      id: `b${Date.now()}`,
      name: newBranch.name,
      location: newBranch.location,
      manager: null,
    };
    onAddBranch(branch);
    setToastMessage(`Branch '${branch.name}' created`);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
    setNewBranch({ name: '', location: '' });
    setShowAddForm(false);
  };

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      onDeleteBranch(deleteTarget.id);
      setToastMessage(`Branch '${deleteTarget.name}' deleted`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2500);
      setDeleteTarget(null);
      setSelectedBranch(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Search & Add button */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by branch name or manager"
            className="w-full pl-10 pr-4 py-2.5 border border-grey-border rounded-lg text-sm bg-white focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-navy"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center justify-center gap-2 bg-navy text-white font-semibold px-4 py-2.5 rounded-lg text-sm hover:bg-navy-light transition-colors active:scale-[0.98] whitespace-nowrap"
        >
          <Plus size={16} />
          Add Branch
        </button>
      </div>

      {/* Branch cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((b) => {
          const stats = statsByBranch.get(b.name);
          return (
            <button
              key={b.id}
              onClick={() => setSelectedBranch(b)}
              className="bg-white rounded-xl border border-grey-border p-5 text-left transition-colors hover:border-navy-light/40"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 rounded-lg bg-navy/5 flex items-center justify-center">
                  <Building2 className="text-navy" size={22} />
                </div>
                <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                  <MapPin size={12} />
                  {b.location}
                </span>
              </div>
              <h3 className="text-base font-semibold text-navy mb-1">{b.name}</h3>
              <p className="text-xs text-gray-400 mb-4">Manager: {b.manager || 'Unassigned'}</p>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-grey-border">
                <div>
                  <p className="text-lg font-bold text-navy">{stats?.staffCount ?? 0}</p>
                  <p className="text-xs text-gray-400">Staff</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-navy">{stats?.activeStudents ?? 0}</p>
                  <p className="text-xs text-gray-400">Clients</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-navy">{stats?.applicationsInProgress ?? 0}</p>
                  <p className="text-xs text-gray-400">In Progress</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-green-600">{stats?.visasGranted ?? 0}</p>
                  <p className="text-xs text-gray-400">Granted</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-400">No branches found.</div>
      )}

      {/* Add branch modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-dark/50 backdrop-blur-sm" onClick={() => setShowAddForm(false)} />
          <div className="relative bg-white rounded-2xl border border-grey-border max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-navy">Add New Branch</h2>
              <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-navy transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-navy mb-1.5">Branch Name</label>
                <input
                  type="text"
                  required
                  value={newBranch.name}
                  onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
                  placeholder="e.g. Lalitpur"
                  className="w-full px-4 py-2.5 border border-grey-border rounded-lg text-sm focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-navy mb-1.5">Location / City</label>
                <input
                  type="text"
                  required
                  value={newBranch.location}
                  onChange={(e) => setNewBranch({ ...newBranch, location: e.target.value })}
                  placeholder="e.g. Lalitpur"
                  className="w-full px-4 py-2.5 border border-grey-border rounded-lg text-sm focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light transition-colors"
                />
              </div>
              <p className="text-xs text-gray-400 -mt-1">
                New branches start unassigned — assign a manager by adding a Branch Manager to Staff for this branch.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 py-2.5 border border-grey-border rounded-lg text-sm font-medium text-navy hover:bg-grey-bg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-navy text-white rounded-lg text-sm font-semibold hover:bg-navy-light transition-colors active:scale-[0.98]"
                >
                  Create Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Branch summary drawer */}
      {selectedBranch && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-navy-dark/50 backdrop-blur-sm" onClick={() => setSelectedBranch(null)} />
          <div className="relative w-full sm:max-w-md bg-white border-l border-grey-border h-full flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-grey-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <Building2 className="text-navy" size={20} />
                <h2 className="text-base font-semibold text-navy">{selectedBranch.name}</h2>
              </div>
              <button onClick={() => setSelectedBranch(null)} className="text-gray-400 hover:text-navy transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              <div className="bg-navy rounded-xl p-5 text-white">
                <p className="text-white/60 text-xs mb-1">Location</p>
                <p className="text-lg font-semibold">{selectedBranch.location}</p>
                <p className="text-white/60 text-xs mt-3 mb-1">Manager</p>
                <p className="text-sm font-medium">{selectedBranch.manager || 'Unassigned'}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Users, label: 'Staff', value: statsByBranch.get(selectedBranch.name)?.staffCount ?? 0 },
                  { icon: GraduationCap, label: 'Active Clients', value: statsByBranch.get(selectedBranch.name)?.activeStudents ?? 0 },
                  { icon: FileText, label: 'Apps In Progress', value: statsByBranch.get(selectedBranch.name)?.applicationsInProgress ?? 0 },
                  { icon: CheckIcon, label: 'Visas Granted', value: statsByBranch.get(selectedBranch.name)?.visasGranted ?? 0, green: true },
                ].map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div key={stat.label} className="bg-grey-bg rounded-xl p-4">
                      <Icon className={stat.green ? 'text-green-600' : 'text-navy'} size={20} />
                      <p className={`text-2xl font-bold mt-2 ${stat.green ? 'text-green-600' : 'text-navy'}`}>
                        {stat.value}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex-shrink-0 border-t border-grey-border px-5 py-4">
              <button
                onClick={() => setDeleteTarget(selectedBranch)}
                className="w-full inline-flex items-center justify-center gap-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg py-2.5 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={16} />
                Delete Branch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-dark/50 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-2xl border border-grey-border max-w-sm w-full p-6">
            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="text-red-500" size={26} />
            </div>
            <h3 className="text-base font-semibold text-navy text-center mb-2">
              Delete {deleteTarget.name}?
            </h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              This will permanently delete the {deleteTarget.name} branch. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 border border-grey-border rounded-lg text-sm font-medium text-navy hover:bg-grey-bg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success toast */}
      {showToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-green-600 text-white px-5 py-3 rounded-xl flex items-center gap-2 text-sm font-medium animate-fade-in">
          <CheckCircle size={18} />
          {toastMessage}
        </div>
      )}
    </div>
  );
}
