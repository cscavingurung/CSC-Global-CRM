import { useState, useMemo } from 'react';
import { Search, X, Plus, Landmark, Trash2, Edit, Percent, CheckCircle, BookOpen, ChevronDown } from 'lucide-react';
import { Partner, PartnerType, PartnerCourse } from '../types';

interface PartnersPageProps {
  partners: Partner[];
  onAddPartner: (partner: Partner) => void;
  onUpdatePartner: (id: string, updates: Partial<Partner>) => void;
  onDeletePartner: (id: string) => void;
}

const TYPE_STYLES: Record<PartnerType, string> = {
  College: 'bg-blue-100 text-blue-700',
  University: 'bg-purple-100 text-purple-700',
};

const EMPTY_FORM = { name: '', type: 'University' as PartnerType, commissionRate: '', courses: [] as PartnerCourse[] };
const EMPTY_COURSE_DRAFT = { name: '', price: '' };

type PartnerForm = typeof EMPTY_FORM;
type CourseDraft = typeof EMPTY_COURSE_DRAFT;

interface PartnerFormFieldsProps {
  form: PartnerForm;
  setForm: (form: PartnerForm) => void;
  courseDraft: CourseDraft;
  setCourseDraft: (draft: CourseDraft) => void;
  addCourse: () => void;
  removeCourse: (name: string) => void;
}

function PartnerFormFields({ form, setForm, courseDraft, setCourseDraft, addCourse, removeCourse }: PartnerFormFieldsProps) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-navy mb-1.5">Name</label>
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. University of Auckland"
          className="w-full px-4 py-2.5 border border-grey-border rounded-lg text-sm focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light transition-colors"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-navy mb-1.5">Type</label>
        <div className="flex gap-2">
          {(['University', 'College'] as PartnerType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setForm({ ...form, type: t })}
              className={`px-4 py-1.5 rounded-full border text-sm font-medium transition-colors ${
                form.type === t
                  ? 'bg-navy text-white border-navy'
                  : 'border-grey-border text-gray-500 hover:bg-grey-bg'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-navy mb-1.5">Commission Rate (%)</label>
        <div className="relative">
          <input
            type="number"
            required
            min="0"
            max="100"
            step="0.5"
            value={form.commissionRate}
            onChange={(e) => setForm({ ...form, commissionRate: e.target.value })}
            placeholder="e.g. 15"
            className="w-full pl-4 pr-9 py-2.5 border border-grey-border rounded-lg text-sm focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light transition-colors"
          />
          <Percent className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={15} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-navy mb-1.5">Courses</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={courseDraft.name}
            onChange={(e) => setCourseDraft({ ...courseDraft, name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCourse();
              }
            }}
            placeholder="e.g. Master of IT"
            className="flex-1 min-w-0 px-4 py-2.5 border border-grey-border rounded-lg text-sm focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light transition-colors"
          />
          <div className="relative w-32 flex-shrink-0">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              type="number"
              min="0"
              value={courseDraft.price}
              onChange={(e) => setCourseDraft({ ...courseDraft, price: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCourse();
                }
              }}
              placeholder="Price"
              className="w-full pl-6 pr-2 py-2.5 border border-grey-border rounded-lg text-sm focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={addCourse}
            className="px-4 py-2.5 border border-grey-border rounded-lg text-sm font-medium text-navy hover:bg-grey-bg transition-colors flex-shrink-0"
          >
            Add
          </button>
        </div>
        {form.courses.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {form.courses.map((course) => (
              <span
                key={course.name}
                className="inline-flex items-center gap-1.5 bg-grey-bg text-navy text-xs font-medium px-2.5 py-1 rounded-full"
              >
                {course.name} · ${course.price.toLocaleString()}
                <button
                  type="button"
                  onClick={() => removeCourse(course.name)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function PartnersPage({ partners, onAddPartner, onUpdatePartner, onDeletePartner }: PartnersPageProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | PartnerType>('all');
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Partner | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Partner | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [courseDraft, setCourseDraft] = useState(EMPTY_COURSE_DRAFT);

  const filtered = useMemo(() => {
    return partners.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === 'all' || p.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [partners, search, typeFilter]);

  const openAddForm = () => {
    setForm(EMPTY_FORM);
    setCourseDraft(EMPTY_COURSE_DRAFT);
    setAddFormOpen(true);
  };

  const openEditDrawer = (p: Partner) => {
    setEditTarget(p);
    setForm({ name: p.name, type: p.type, commissionRate: String(p.commissionRate), courses: [...p.courses] });
    setCourseDraft(EMPTY_COURSE_DRAFT);
  };

  const addCourse = () => {
    const name = courseDraft.name.trim();
    if (name && !form.courses.some((c) => c.name === name)) {
      setForm({ ...form, courses: [...form.courses, { name, price: Number(courseDraft.price) || 0 }] });
    }
    setCourseDraft(EMPTY_COURSE_DRAFT);
  };

  const removeCourse = (name: string) => {
    setForm({ ...form, courses: form.courses.filter((c) => c.name !== name) });
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const partner: Partner = {
      id: `p${Date.now()}`,
      name: form.name,
      type: form.type,
      commissionRate: Number(form.commissionRate),
      courses: form.courses,
    };
    onAddPartner(partner);
    setToastMessage(`${partner.name} added`);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
    setAddFormOpen(false);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editTarget) {
      onUpdatePartner(editTarget.id, {
        name: form.name,
        type: form.type,
        commissionRate: Number(form.commissionRate),
        courses: form.courses,
      });
      setToastMessage(`${form.name} updated`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2500);
      setEditTarget(null);
    }
  };

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      onDeletePartner(deleteTarget.id);
      setToastMessage(`${deleteTarget.name} removed`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2500);
      setDeleteTarget(null);
      if (editTarget?.id === deleteTarget.id) setEditTarget(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Search, filter & Add button */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name"
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
        <div className="relative">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'all' | PartnerType)}
            className="w-full sm:w-auto appearance-none bg-white border border-grey-border rounded-lg pl-3 pr-9 py-2.5 text-sm font-medium text-navy focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light transition-colors"
          >
            <option value="all">All Types</option>
            <option value="University">University</option>
            <option value="College">College</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
        </div>
        <button
          onClick={openAddForm}
          className="inline-flex items-center justify-center gap-2 bg-navy text-white font-semibold px-4 py-2.5 rounded-lg text-sm hover:bg-navy-light transition-colors active:scale-[0.98] whitespace-nowrap"
        >
          <Plus size={16} />
          Add Partner
        </button>
      </div>

      {/* Table — desktop */}
      <div className="hidden lg:block bg-white rounded-xl border border-grey-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-grey-border bg-grey-bg">
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Partner</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Type</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Courses</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Commission Rate</th>
              <th className="text-right text-xs font-semibold text-gray-500 px-5 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-grey-border last:border-0 hover:bg-grey-bg/50 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-navy/5 flex items-center justify-center flex-shrink-0">
                      <Landmark className="text-navy" size={16} />
                    </div>
                    <p className="text-sm font-medium text-navy">{p.name}</p>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${TYPE_STYLES[p.type]}`}>
                    {p.type}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  {p.courses.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 max-w-xs">
                      {p.courses.map((course) => (
                        <span
                          key={course.name}
                          className="inline-flex items-center gap-1 bg-grey-bg text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                        >
                          {course.name} · ${course.price.toLocaleString()}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-sm text-gray-400">
                      <BookOpen size={14} className="text-gray-400" />
                      No courses
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-navy">
                    {p.commissionRate}
                    <Percent size={13} />
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="inline-flex items-center gap-4">
                    <button
                      onClick={() => openEditDrawer(p)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-navy hover:text-navy-light transition-colors"
                    >
                      <Edit size={15} />
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteTarget(p)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={15} />
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">No partners found.</div>
        )}
      </div>

      {/* Card list — mobile */}
      <div className="lg:hidden space-y-3">
        {filtered.map((p) => (
          <div key={p.id} className="bg-white rounded-xl border border-grey-border p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-navy/5 flex items-center justify-center flex-shrink-0">
                  <Landmark className="text-navy" size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy truncate">{p.name}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_STYLES[p.type]}`}>
                    {p.type}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-grey-border">
              <p className="text-xs text-gray-500">{p.commissionRate}% commission</p>
              <div className="flex items-center gap-3">
                <button onClick={() => openEditDrawer(p)} className="text-navy hover:text-navy-light transition-colors">
                  <Edit size={16} />
                </button>
                <button onClick={() => setDeleteTarget(p)} className="text-red-500 hover:text-red-600 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            {p.courses.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-grey-border">
                {p.courses.map((course) => (
                  <span
                    key={course.name}
                    className="inline-flex items-center gap-1 bg-grey-bg text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full"
                  >
                    {course.name} · ${course.price.toLocaleString()}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-grey-border inline-flex items-center gap-1.5">
                <BookOpen size={13} className="text-gray-400" />
                No courses
              </p>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">No partners found.</div>
        )}
      </div>

      {/* Add partner modal */}
      {addFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-dark/50 backdrop-blur-sm" onClick={() => setAddFormOpen(false)} />
          <div className="relative bg-white rounded-2xl border border-grey-border max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-navy">Add Partner</h2>
              <button onClick={() => setAddFormOpen(false)} className="text-gray-400 hover:text-navy transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <PartnerFormFields
                form={form}
                setForm={setForm}
                courseDraft={courseDraft}
                setCourseDraft={setCourseDraft}
                addCourse={addCourse}
                removeCourse={removeCourse}
              />
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAddFormOpen(false)}
                  className="flex-1 py-2.5 border border-grey-border rounded-lg text-sm font-medium text-navy hover:bg-grey-bg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-navy text-white rounded-lg text-sm font-semibold hover:bg-navy-light transition-colors active:scale-[0.98]"
                >
                  Add Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit partner drawer */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-navy-dark/50 backdrop-blur-sm" onClick={() => setEditTarget(null)} />
          <div className="relative w-full sm:max-w-md bg-white border-l border-grey-border h-full flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-grey-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <Landmark className="text-navy" size={20} />
                <h2 className="text-base font-semibold text-navy">{editTarget.name}</h2>
              </div>
              <button onClick={() => setEditTarget(null)} className="text-gray-400 hover:text-navy transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
                <PartnerFormFields
                  form={form}
                  setForm={setForm}
                  courseDraft={courseDraft}
                  setCourseDraft={setCourseDraft}
                  addCourse={addCourse}
                  removeCourse={removeCourse}
                />
              </div>
              <div className="flex-shrink-0 border-t border-grey-border px-5 py-4 space-y-3">
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
                <button
                  type="button"
                  onClick={() => setDeleteTarget(editTarget)}
                  className="w-full inline-flex items-center justify-center gap-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg py-2.5 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={16} />
                  Delete Partner
                </button>
              </div>
            </form>
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
              Remove {deleteTarget.name}?
            </h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              This will remove {deleteTarget.name} and its commission rate from the system. This action cannot be undone.
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
                Remove
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
