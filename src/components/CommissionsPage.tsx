import { useState, useMemo, useEffect } from 'react';
import { Search, X, Edit, DollarSign, CheckCircle, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { CommissionRecord, CommissionStatus, Partner } from '../types';

const PAGE_SIZE = 15;

interface CommissionsPageProps {
  commissions: CommissionRecord[];
  partners: Partner[];
  onUpdateCommission: (id: string, updates: Partial<CommissionRecord>) => void;
}

const commissionAmount = (c: CommissionRecord) => (c.fullFee * c.commissionRate) / 100;

export default function CommissionsPage({ commissions, partners, onUpdateCommission }: CommissionsPageProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CommissionStatus>('all');
  const [editTarget, setEditTarget] = useState<CommissionRecord | null>(null);
  const [editPartner, setEditPartner] = useState('');
  const [editCommissionRate, setEditCommissionRate] = useState(0);
  const [editFullFee, setEditFullFee] = useState('');
  const [editStatus, setEditStatus] = useState<CommissionStatus>('Pending');
  const [showToast, setShowToast] = useState(false);

  const filtered = useMemo(() => {
    return commissions.filter((c) => {
      const matchesSearch = c.studentName.toLowerCase().includes(search.toLowerCase()) ||
        c.consultant.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || c.commissionStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [commissions, search, statusFilter]);

  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  );

  const totalReceivable = commissions.filter((c) => c.commissionStatus === 'Pending').reduce((sum, c) => sum + commissionAmount(c), 0);
  const totalReceived = commissions.filter((c) => c.commissionStatus === 'Paid').reduce((sum, c) => sum + commissionAmount(c), 0);

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editTarget) {
      onUpdateCommission(editTarget.id, {
        partner: editPartner,
        fullFee: Number(editFullFee),
        commissionRate: editCommissionRate,
        commissionStatus: editStatus,
      });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2500);
      setEditTarget(null);
    }
  };

  const openEdit = (c: CommissionRecord) => {
    setEditTarget(c);
    setEditPartner(c.partner);
    setEditCommissionRate(c.commissionRate);
    setEditFullFee(String(c.fullFee));
    setEditStatus(c.commissionStatus);
  };

  const handlePartnerChange = (name: string) => {
    setEditPartner(name);
    const match = partners.find((p) => p.name === name);
    if (match) setEditCommissionRate(match.commissionRate);
  };

  return (
    <div className="space-y-5">
      {/* Summary tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="w-10 h-10 rounded-lg bg-navy/5 flex items-center justify-center mb-3">
            <DollarSign className="text-navy" size={20} />
          </div>
          <p className="text-2xl font-bold text-navy">${totalReceivable.toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-0.5">Receivable</p>
        </div>
        <div className="stat-card">
          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center mb-3">
            <CheckCircle className="text-green-600" size={20} />
          </div>
          <p className="text-2xl font-bold text-green-600">${totalReceived.toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-0.5">Received</p>
        </div>
        <div className="stat-card">
          <div className="w-10 h-10 rounded-lg bg-navy/5 flex items-center justify-center mb-3">
            <DollarSign className="text-navy" size={20} />
          </div>
          <p className="text-2xl font-bold text-navy">${(totalReceivable + totalReceived).toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-0.5">Total Commissions</p>
        </div>
      </div>

      {/* Search & filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client or consultant"
            className="w-full pl-10 pr-4 py-2.5 border border-grey-border rounded-lg text-sm bg-white focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-navy">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | CommissionStatus)}
            className="w-full sm:w-auto appearance-none bg-white border border-grey-border rounded-lg pl-3 pr-9 py-2.5 text-sm font-medium text-navy focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light transition-colors"
          >
            <option value="all">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Paid">Paid</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
        </div>
      </div>

      {/* Table — desktop */}
      <div className="hidden lg:block bg-white rounded-xl border border-grey-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-grey-border bg-grey-bg">
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Client</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Branch</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Partner</th>
              <th className="text-right text-xs font-semibold text-gray-500 px-5 py-3">Full Fee</th>
              <th className="text-right text-xs font-semibold text-gray-500 px-5 py-3">%</th>
              <th className="text-right text-xs font-semibold text-gray-500 px-5 py-3">Received</th>
              <th className="text-right text-xs font-semibold text-gray-500 px-5 py-3">Receivable</th>
              <th className="text-right text-xs font-semibold text-gray-500 px-5 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((c) => {
              const amount = commissionAmount(c);
              return (
              <tr key={c.id} className="border-b border-grey-border last:border-0 hover:bg-grey-bg/50 transition-colors">
                <td className="px-5 py-3.5">
                  <p className="text-sm font-medium text-navy">{c.studentName}</p>
                  <p className="text-xs text-gray-400">{c.consultant}</p>
                </td>
                <td className="px-5 py-3.5 text-sm text-gray-600">{c.branch}</td>
                <td className="px-5 py-3.5 text-sm text-gray-600">{c.partner}</td>
                <td className="px-5 py-3.5 text-sm text-gray-600 text-right">${c.fullFee.toLocaleString()}</td>
                <td className="px-5 py-3.5 text-sm text-gray-600 text-right">{c.commissionRate}%</td>
                <td className="px-5 py-3.5 text-sm font-semibold text-right">
                  {c.commissionStatus === 'Paid' ? (
                    <span className="text-green-600">${amount.toLocaleString()}</span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-sm font-semibold text-right">
                  {c.commissionStatus === 'Pending' ? (
                    <span className="text-orange-600">${amount.toLocaleString()}</span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    onClick={() => openEdit(c)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-navy hover:text-navy-light transition-colors"
                  >
                    <Edit size={15} />
                    Edit
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">No commissions found.</div>
        )}
      </div>

      {/* Card list — mobile */}
      <div className="lg:hidden space-y-3">
        {paginated.map((c) => {
          const amount = commissionAmount(c);
          return (
          <div key={c.id} className="bg-white rounded-xl border border-grey-border p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-sm font-semibold text-navy">{c.studentName}</p>
                <p className="text-xs text-gray-400">{c.consultant} · {c.branch}</p>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                c.commissionStatus === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
              }`}>
                {c.commissionStatus}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
              <p>Partner: <span className="text-gray-700">{c.partner}</span></p>
              <p>Rate: <span className="text-gray-700">{c.commissionRate}%</span></p>
              <p>Full Fee: <span className="text-gray-700">${c.fullFee.toLocaleString()}</span></p>
              <p>
                {c.commissionStatus === 'Paid' ? 'Received' : 'Receivable'}:{' '}
                <span className={c.commissionStatus === 'Paid' ? 'text-green-600 font-medium' : 'text-orange-600 font-medium'}>
                  ${amount.toLocaleString()}
                </span>
              </p>
            </div>
            <div className="flex items-center justify-end pt-3 border-t border-grey-border">
              <button
                onClick={() => openEdit(c)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-navy hover:text-navy-light transition-colors"
              >
                <Edit size={15} />
                Edit
              </button>
            </div>
          </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">No commissions found.</div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">Page {currentPage} of {totalPages}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-grey-border bg-white px-3 py-1.5 text-sm font-medium text-navy hover:bg-navy/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={15} /> Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-grey-border bg-white px-3 py-1.5 text-sm font-medium text-navy hover:bg-navy/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Edit drawer */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-navy-dark/50 backdrop-blur-sm" onClick={() => setEditTarget(null)} />
          <div className="relative w-full sm:max-w-md bg-white border-l border-grey-border h-full flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-grey-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <Edit className="text-navy" size={20} />
                <h2 className="text-base font-semibold text-navy">Edit Commission</h2>
              </div>
              <button onClick={() => setEditTarget(null)} className="text-gray-400 hover:text-navy transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
                <div className="bg-grey-bg rounded-xl p-4 space-y-2">
                  <p className="text-xs text-gray-400">Client</p>
                  <p className="text-sm font-medium text-navy">{editTarget.studentName}</p>
                  <p className="text-xs text-gray-400 mt-2">Consultant</p>
                  <p className="text-sm font-medium text-navy">{editTarget.consultant}</p>
                  <p className="text-xs text-gray-400 mt-2">Branch</p>
                  <p className="text-sm font-medium text-navy">{editTarget.branch}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-navy mb-1.5">Partner</label>
                  <select
                    required
                    value={editPartner}
                    onChange={(e) => handlePartnerChange(e.target.value)}
                    className="w-full px-4 py-2.5 border border-grey-border rounded-lg text-sm focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light transition-colors appearance-none bg-white"
                  >
                    <option value="" disabled>Select a partner</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.name}>{p.name} ({p.commissionRate}%)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-navy mb-1.5">Full Fee ($)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editFullFee}
                    onChange={(e) => setEditFullFee(e.target.value)}
                    className="w-full px-4 py-2.5 border border-grey-border rounded-lg text-sm focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light transition-colors"
                  />
                </div>
                {editPartner && editFullFee && (
                  <p className="text-xs text-gray-500 -mt-2">
                    Commission: {editCommissionRate}% of ${Number(editFullFee).toLocaleString()} = $
                    {((Number(editFullFee) * editCommissionRate) / 100).toLocaleString()}
                  </p>
                )}
                <div>
                  <label className="block text-sm font-medium text-navy mb-1.5">Commission Status</label>
                  <div className="flex gap-2">
                    {(['Pending', 'Paid'] as CommissionStatus[]).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setEditStatus(opt)}
                        className={`px-4 py-1.5 rounded-full border text-sm font-medium transition-colors ${
                          editStatus === opt
                            ? opt === 'Paid'
                              ? 'bg-green-100 text-green-700 border-green-200'
                              : 'bg-orange-100 text-orange-700 border-orange-200'
                            : 'border-grey-border text-gray-500 hover:bg-grey-bg'
                        }`}
                      >
                        {opt === 'Paid' ? 'Received' : 'Receivable'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0 border-t border-grey-border px-5 py-4">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditTarget(null)}
                    className="flex-1 py-2.5 border border-grey-border rounded-lg text-sm font-medium text-navy hover:bg-grey-bg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-navy text-white rounded-lg text-sm font-semibold hover:bg-navy-light transition-colors active:scale-[0.98]"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success toast */}
      {showToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-green-600 text-white px-5 py-3 rounded-xl flex items-center gap-2 text-sm font-medium animate-fade-in">
          <CheckCircle size={18} />
          Commission updated
        </div>
      )}
    </div>
  );
}
