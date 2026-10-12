import { useLayoutEffect, useRef, useState } from 'react';
import { AlertTriangle, Pencil, Plus, X } from 'lucide-react';
import { AcademicEntry, CounselorStudent } from '../types';
import { COUNTRIES, PURPOSES } from '../mockData';
import { today } from '../clientPipeline';
import { isValidEmail } from '../validation';
import { caretPositionForDigitCount, dialedDigitsBeforeCaret, formatPhoneInput, isValidPhone } from '../lib/phone';
import { ACADEMIC_LEVELS, GENDERS, MARITAL_STATUSES } from './NewIntakeForm';

// Marketing's quick Add Lead only takes name, phone, email and source — the counselor fills in
// the rest of the Front Desk intake profile here, during consultation.

type DetailFields = Pick<
  CounselorStudent,
  'name' | 'phone' | 'email' | 'address' | 'country' | 'purpose' | 'dob' | 'gender' | 'maritalStatus' | 'academics' | 'ieltsPte' | 'workExperience'
>;

const EMPTY_ACADEMIC: AcademicEntry = { level: '', stream: '', gpa: '', completionYear: '' };
const academicComplete = (a: AcademicEntry) => Boolean(a.level.trim() && a.stream.trim() && a.gpa.trim() && a.completionYear.trim());

/** Intake details still blank on a client — the counselor must fill these before Proceeding. */
export function missingDetails(c: DetailFields): string[] {
  const out: string[] = [];
  if (!c.address?.trim()) out.push('Address');
  if (!c.country?.trim()) out.push('Country of Interest');
  if (!c.purpose?.trim()) out.push('Purpose');
  if (!c.dob?.trim()) out.push('Date of Birth');
  if (!c.gender?.trim()) out.push('Gender');
  if (!c.maritalStatus?.trim()) out.push('Marital Status');
  if (!(c.academics ?? []).some(academicComplete)) out.push('Academic');
  if (!c.ieltsPte?.trim()) out.push('IELTS/PTE');
  if (!c.workExperience?.trim()) out.push('Work Experience');
  return out;
}

export function MissingDetailsNotice({ missing, onEdit }: { missing: string[]; onEdit?: () => void }) {
  if (missing.length === 0) return null;
  return (
    <div role="status" className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
      <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
      <p className="flex-1">
        <span className="font-medium">{missing.length} detail{missing.length === 1 ? '' : 's'} to fill in:</span> {missing.join(', ')}.
        {' '}Needed before the client can proceed.
      </p>
      {onEdit && (
        <button type="button" onClick={onEdit} className="flex-shrink-0 font-medium text-amber-900 underline hover:no-underline">
          Fill in
        </button>
      )}
    </div>
  );
}

export function EditDetailsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-grey-border px-3 py-1.5 text-xs font-medium text-navy transition-colors hover:border-navy-light hover:text-navy-light"
    >
      <Pencil size={13} /> Edit details
    </button>
  );
}

const fieldClass = 'w-full px-3 py-2.5 border border-grey-border rounded-lg text-sm focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light transition-colors';
const selectClass = `${fieldClass} appearance-none bg-white`;
const errorClass = 'border-red-400 focus:border-red-400 focus:ring-red-300';

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-gray-500 mb-1.5">{children}</label>;
}

export default function ClientDetailsEditor({ client, onSave, onClose }: {
  client: DetailFields;
  onSave: (updates: Partial<CounselorStudent>) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<DetailFields>(() => ({
    ...client,
    // Level is free text with suggestions, so levels typed under "Others" at intake stay editable.
    academics: client.academics?.length ? client.academics : [{ ...EMPTY_ACADEMIC }],
  }));
  const set = <K extends keyof DetailFields>(k: K, v: DetailFields[K]) => setF((p) => ({ ...p, [k]: v }));
  const [phoneError, setPhoneError] = useState('');
  const [emailError, setEmailError] = useState('');
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const phoneCaretRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (phoneCaretRef.current === null || !phoneInputRef.current) return;
    phoneInputRef.current.setSelectionRange(phoneCaretRef.current, phoneCaretRef.current);
    phoneCaretRef.current = null;
  }, [f.phone]);

  const countries = f.country ? f.country.split(',').map((c) => c.trim()).filter(Boolean) : [];
  const toggleCountry = (c: string) =>
    set('country', (countries.includes(c) ? countries.filter((v) => v !== c) : [...countries, c]).join(', '));
  const updateAcademic = (i: number, patch: Partial<AcademicEntry>) =>
    set('academics', f.academics.map((a, ai) => (ai === i ? { ...a, ...patch } : a)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    if (!isValidPhone(f.phone)) { setPhoneError('Enter a valid number, e.g. +1 416 272 4274 or +977 98XXXXXXXX'); return; }
    if (!isValidEmail(f.email.trim())) { setEmailError('Enter a valid email, e.g. name@example.com'); return; }
    const trimmed = (v: string) => v.trim();
    onSave({
      name: trimmed(f.name),
      phone: f.phone,
      email: trimmed(f.email),
      address: trimmed(f.address),
      country: f.country,
      purpose: f.purpose,
      dob: f.dob,
      gender: f.gender,
      maritalStatus: f.maritalStatus,
      // Blank rows are dropped; half-filled ones are kept so nothing typed is lost.
      academics: f.academics
        .map((a) => ({ level: trimmed(a.level), stream: trimmed(a.stream), gpa: trimmed(a.gpa), completionYear: trimmed(a.completionYear) }))
        .filter((a) => a.level || a.stream || a.gpa || a.completionYear),
      ieltsPte: trimmed(f.ieltsPte),
      workExperience: trimmed(f.workExperience),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={submit} className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-grey-border bg-white">
        <div className="flex items-center justify-between border-b border-grey-border px-5 py-4">
          <h3 className="text-base font-semibold text-navy">Client details</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-gray-400 hover:text-navy"><X size={18} /></button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto px-5 py-4 sm:grid-cols-2">
          <div>
            <Label>Full name</Label>
            <input required value={f.name} onChange={(e) => set('name', e.target.value)} className={fieldClass} />
          </div>
          <div>
            <Label>Phone / WhatsApp</Label>
            <input
              ref={phoneInputRef}
              type="tel"
              value={f.phone}
              onChange={(e) => {
                const raw = e.target.value;
                const formatted = formatPhoneInput(raw);
                phoneCaretRef.current = caretPositionForDigitCount(formatted, dialedDigitsBeforeCaret(raw, e.target.selectionStart ?? raw.length));
                set('phone', formatted);
                if (phoneError) setPhoneError('');
              }}
              className={`${fieldClass} ${phoneError ? errorClass : ''}`}
            />
            {phoneError && <p className="mt-1 text-xs text-red-500">{phoneError}</p>}
          </div>
          <div>
            <Label>Email</Label>
            <input
              type="email"
              value={f.email}
              onChange={(e) => { set('email', e.target.value); if (emailError) setEmailError(''); }}
              className={`${fieldClass} ${emailError ? errorClass : ''}`}
            />
            {emailError && <p className="mt-1 text-xs text-red-500">{emailError}</p>}
          </div>
          <div>
            <Label>Address</Label>
            <input value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="e.g. Kathmandu, Nepal" className={fieldClass} />
          </div>

          <div className="sm:col-span-2">
            <Label>Country of interest</Label>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border border-grey-border p-3 sm:grid-cols-3">
              {COUNTRIES.map((c) => (
                <label key={c} className="flex cursor-pointer items-center gap-2 text-sm text-navy">
                  <input type="checkbox" checked={countries.includes(c)} onChange={() => toggleCountry(c)} className="rounded border-grey-border text-navy focus:ring-navy-light" />
                  {c}
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label>Purpose</Label>
            <select value={f.purpose} onChange={(e) => set('purpose', e.target.value)} className={selectClass}>
              <option value="">Select a purpose</option>
              {PURPOSES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <Label>Date of birth</Label>
            <input type="date" min="1900-01-01" max={today()} value={f.dob} onChange={(e) => set('dob', e.target.value)} className={fieldClass} />
          </div>
          <div>
            <Label>Gender</Label>
            <select value={f.gender} onChange={(e) => set('gender', e.target.value)} className={selectClass}>
              <option value="">Select gender</option>
              {GENDERS.map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <Label>Marital status</Label>
            <select value={f.maritalStatus} onChange={(e) => set('maritalStatus', e.target.value)} className={selectClass}>
              <option value="">Select marital status</option>
              {MARITAL_STATUSES.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>

          <div className="sm:col-span-2">
            <Label>Academic</Label>
            <div className="space-y-3">
              {f.academics.map((a, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
                      <input
                        list="client-details-levels"
                        value={a.level}
                        onChange={(e) => updateAcademic(i, { level: e.target.value })}
                        placeholder="Level, e.g. Bachelor's"
                        className={fieldClass}
                      />
                      <input value={a.stream} onChange={(e) => updateAcademic(i, { stream: e.target.value })} placeholder="Stream" className={fieldClass} />
                      <input value={a.gpa} onChange={(e) => updateAcademic(i, { gpa: e.target.value })} placeholder="GPA" className={fieldClass} />
                      <input value={a.completionYear} onChange={(e) => updateAcademic(i, { completionYear: e.target.value })} placeholder="Year" className={fieldClass} />
                    </div>
                    {f.academics.length > 1 && (
                      <button type="button" onClick={() => set('academics', f.academics.filter((_, ai) => ai !== i))} aria-label="Remove qualification" className="mt-1 p-2 text-gray-400 hover:text-red-500">
                        <X size={16} />
                      </button>
                    )}
                  </div>
              ))}
              <datalist id="client-details-levels">
                {ACADEMIC_LEVELS.filter((l) => l !== 'Others').map((l) => <option key={l} value={l} />)}
              </datalist>
            </div>
            <button type="button" onClick={() => set('academics', [...f.academics, { ...EMPTY_ACADEMIC }])} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-navy hover:text-navy-light">
              <Plus size={15} /> Add another qualification
            </button>
          </div>

          <div>
            <Label>IELTS/PTE score</Label>
            <input value={f.ieltsPte} onChange={(e) => set('ieltsPte', e.target.value)} placeholder="e.g. IELTS 7.0 or Not taken yet" className={fieldClass} />
          </div>
          <div>
            <Label>Work experience</Label>
            <input value={f.workExperience} onChange={(e) => set('workExperience', e.target.value)} placeholder="e.g. 3 years as Software Engineer" className={fieldClass} />
          </div>
        </div>

        <div className="flex gap-3 border-t border-grey-border px-5 py-4">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-grey-border py-2.5 text-sm font-medium text-navy hover:bg-grey-bg">Cancel</button>
          <button type="submit" className="flex-1 rounded-lg bg-navy py-2.5 text-sm font-semibold text-white hover:bg-navy-light">Save details</button>
        </div>
      </form>
    </div>
  );
}
