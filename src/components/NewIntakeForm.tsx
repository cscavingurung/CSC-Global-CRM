import { useState, useRef, useLayoutEffect } from 'react';
import {
  Mountain, CheckCircle, User, Phone, Mail, Globe, Target, Calendar,
  Users, Heart, GraduationCap, Languages, Briefcase, Share2, Megaphone,
} from 'lucide-react';
import { COUNTRIES, PURPOSES } from '../mockData';
import { PLATFORM_SOURCES } from '../marketing';
import { today } from '../clientPipeline';

export interface IntakeFormData {
  name: string;
  phone: string;
  email: string;
  country: string;
  purpose: string;
  dob: string;
  gender: string;
  maritalStatus: string;
  academicQualification: string;
  ieltsPte: string;
  workExperience: string;
  /** How the client found the consultancy. */
  referredThrough: string;
  /** Marketing mode only — the platform the lead was generated from. */
  platformSource?: string;
}

const GENDERS = ['Male', 'Female', 'Other'];
const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed'];
export const REFERRAL_SOURCES = ['Walk Ins', 'Marketing', 'Others'];

// +1 (Canada/US, 10-digit NANP number) or +977 (Nepal, 10-digit mobile starting with 9).
const PHONE_REGEX = /^(?:\+1[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}|\+977[\s-]?9\d{9})$/;

function isValidPhone(phone: string): boolean {
  return PHONE_REGEX.test(phone.trim());
}

// The "+1"/"+977" country code we prepend is synthetic, not typed by the user — since the
// input is controlled, our own formatted output becomes next keystroke's raw value, so the
// digit(s) inside that prefix ("1", or "977") must never be re-counted as dialed digits.
function staticPrefixLength(value: string): number {
  if (value.startsWith('+977')) return 4;
  if (value.startsWith('+1')) return 2;
  return 0;
}

// Live-formats digits as they're typed — a 9-leading number becomes a Nepal +977 mobile
// number, anything else is treated as a NANP +1 number, matching the input on
// cscglobalcanada.ca/contact so staff never have to type the country code or punctuation.
function formatPhoneInput(raw: string): string {
  const digits = raw.slice(staticPrefixLength(raw)).replace(/\D/g, '').slice(0, 10);
  if (!digits) return '';
  if (digits[0] === '9') return `+977 ${digits}`;

  const area = digits.slice(0, 3);
  const mid = digits.slice(3, 6);
  const last = digits.slice(6, 10);
  let out = `+1 (${area}`;
  if (area.length === 3) out += ')';
  if (mid) out += ` ${mid}`;
  if (last) out += `-${last}`;
  return out;
}

// How many real (dialed) digits sit before the caret in the raw, pre-format input value.
function dialedDigitsBeforeCaret(raw: string, caretIndex: number): number {
  const prefixLen = staticPrefixLength(raw);
  if (caretIndex <= prefixLen) return 0;
  return raw.slice(prefixLen, caretIndex).replace(/\D/g, '').length;
}

// Re-formatting on every keystroke changes the string length (adding "(", ")", "-", "+977 "),
// which resets the browser's cursor to the wrong spot unless we restore it ourselves — this
// finds where the caret belongs in the new formatted string by counting real dialed digits,
// skipping the synthetic country-code prefix so its digit(s) don't throw the count off.
function caretPositionForDigitCount(formatted: string, digitCount: number): number {
  const prefixLen = staticPrefixLength(formatted);
  if (digitCount <= 0) return prefixLen;
  let seen = 0;
  for (let i = prefixLen; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      seen++;
      if (seen === digitCount) return i + 1;
    }
  }
  return formatted.length;
}

interface NewIntakeFormProps {
  onSubmitted?: () => void;
  /** Renders as a bare card for embedding inside the dashboard instead of a standalone public page. */
  embedded?: boolean;
  /** Called with the form data on submit — required to actually persist the intake when embedded. */
  onSubmit?: (data: IntakeFormData) => void;
  /** Marketing mode: adds the required "Lead Generated From" platform field. */
  marketing?: boolean;
}

const EMPTY_FORM: IntakeFormData = {
  name: '',
  phone: '',
  email: '',
  country: '',
  purpose: '',
  dob: '',
  gender: '',
  maritalStatus: '',
  academicQualification: '',
  ieltsPte: '',
  workExperience: '',
  referredThrough: '',
  platformSource: '',
};

export default function NewIntakeForm({ onSubmitted, embedded = false, onSubmit, marketing = false }: NewIntakeFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<IntakeFormData>(
    marketing ? { ...EMPTY_FORM, referredThrough: 'Marketing' } : EMPTY_FORM
  );
  const [platformOther, setPlatformOther] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const phoneCaretRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (phoneCaretRef.current === null || !phoneInputRef.current) return;
    phoneInputRef.current.setSelectionRange(phoneCaretRef.current, phoneCaretRef.current);
    phoneCaretRef.current = null;
  }, [form.phone]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidPhone(form.phone)) {
      setPhoneError('Enter a valid number, e.g. +1 416 272 4274 or +977 98XXXXXXXX');
      return;
    }

    // "Others" keeps the typed platform name so reporting shows the real source.
    const platformSource =
      form.platformSource === 'Others' ? platformOther.trim() || 'Others' : form.platformSource;
    onSubmit?.(marketing ? { ...form, platformSource } : form);
    setSubmitted(true);
    onSubmitted?.();
  };

  const handleReset = () => {
    setForm(marketing ? { ...EMPTY_FORM, referredThrough: 'Marketing' } : EMPTY_FORM);
    setPlatformOther('');
    setPhoneError('');
    setSubmitted(false);
  };

  if (submitted) {
    const successCard = (
      <div className="w-full max-w-md bg-white rounded-2xl border border-grey-border p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="text-green-600" size={36} />
        </div>
        <h2 className="text-xl font-semibold text-navy mb-2">
          {marketing ? 'Lead added' : embedded ? 'Client added' : 'Thanks — please wait'}
        </h2>
        <p className="text-sm text-gray-500 leading-relaxed mb-6">
          {marketing
            ? 'The lead is saved and ready to broadcast to a branch group from the Assign Clients tab.'
            : embedded
              ? 'The client has been added as a new intake and is ready to be assigned to a counselor.'
              : "Your details have been received. Our front desk officer will call you shortly to confirm your consultation."}
        </p>
        <button
          onClick={handleReset}
          className="text-sm text-navy font-medium hover:text-navy-light transition-colors"
        >
          {marketing ? 'Add another lead' : embedded ? 'Add another client' : 'Submit another response'}
        </button>
      </div>
    );

    if (embedded) {
      return <div className="flex items-center justify-center py-10">{successCard}</div>;
    }

    return (
      <div className="min-h-screen bg-grey-bg flex flex-col">
        <header className="bg-navy px-5 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center">
            <Mountain className="text-navy" size={20} strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">CSC Global</p>
            <p className="text-white/50 text-xs">Client Intake</p>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">{successCard}</div>

        <footer className="bg-white border-t border-grey-border px-5 py-3 text-center">
          <p className="text-xs text-gray-400">CSC Global</p>
        </footer>
      </div>
    );
  }

  const fieldClass = "w-full pl-10 pr-4 py-2.5 border border-grey-border rounded-lg text-sm focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light transition-colors";
  const selectClass = `${fieldClass} appearance-none bg-white`;

  const formCard = (
    <div className={embedded ? 'w-full' : 'w-full max-w-md'}>
      <div className="bg-white rounded-2xl border border-grey-border p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-navy mb-1">
          {marketing ? 'New Marketing Lead' : embedded ? 'New Client Intake' : 'Welcome'}
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          {marketing
            ? 'Log a lead generated from a marketing campaign, then broadcast it to a branch group.'
            : embedded
              ? 'Log a walk-in or phone enquiry directly into the system.'
              : "Fill in your details and we'll arrange a consultation for you."}
        </p>

        <form onSubmit={handleSubmit} className={embedded ? 'grid grid-cols-2 gap-x-6 gap-y-4' : 'space-y-4'}>
          {/* Full name */}
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">Full name</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Full name"
                className={fieldClass}
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">Phone / WhatsApp</label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                ref={phoneInputRef}
                type="tel"
                required
                value={form.phone}
                onChange={(e) => {
                  const raw = e.target.value;
                  const caretPos = e.target.selectionStart ?? raw.length;
                  const digitsBeforeCaret = dialedDigitsBeforeCaret(raw, caretPos);
                  const formatted = formatPhoneInput(raw);
                  phoneCaretRef.current = caretPositionForDigitCount(formatted, digitsBeforeCaret);
                  setForm({ ...form, phone: formatted });
                  if (phoneError) setPhoneError('');
                }}
                onBlur={() => {
                  if (form.phone && !isValidPhone(form.phone)) {
                    setPhoneError('Enter a valid number, e.g. +1 416 272 4274 or +977 98XXXXXXXX');
                  }
                }}
                placeholder="+1 or +977 number"
                className={`${fieldClass} ${phoneError ? 'border-red-400 focus:border-red-400 focus:ring-red-300' : ''}`}
              />
            </div>
            {phoneError && <p className="mt-1 text-xs text-red-500">{phoneError}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="client@email.com"
                className={fieldClass}
              />
            </div>
          </div>

          {/* Date of birth */}
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">Date of birth</label>
            <div className="relative">
              <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
              <input
                type="date"
                required
                min="1900-01-01"
                max={today()}
                value={form.dob}
                onChange={(e) => setForm({ ...form, dob: e.target.value })}
                onClick={(e) => e.currentTarget.showPicker?.()}
                onBlur={(e) => {
                  // The year segment of a native date input isn't capped at 4 digits by the
                  // browser (Chrome allows up to 6) — min/max only affect validity, not how
                  // much you can type. Clamp once the field is left, rather than mid-keystroke
                  // (blocking onChange fights the widget and breaks normal typing).
                  const value = e.target.value;
                  if (!value) return;
                  const year = Number(value.slice(0, 4));
                  const maxYear = new Date().getFullYear();
                  if (year > maxYear) setForm((f) => ({ ...f, dob: today() }));
                  else if (year < 1900) setForm((f) => ({ ...f, dob: '1900-01-01' }));
                }}
                className={fieldClass}
              />
            </div>
          </div>

          {/* Country of interest */}
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">Country of interest</label>
            <div className="relative">
              <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
              <select
                required
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className={selectClass}
              >
                <option value="" disabled>Select a country</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Purpose */}
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">Purpose</label>
            <div className="relative">
              <Target className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
              <select
                required
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                className={selectClass}
              >
                <option value="" disabled>Select a purpose</option>
                {PURPOSES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Lead Generated From — marketing only */}
          {marketing ? (
            <>
              <div>
                <label className="block text-sm font-medium text-navy mb-1.5">Lead Generated From</label>
                <div className="relative">
                  <Megaphone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                  <select
                    required
                    value={form.platformSource ?? ''}
                    onChange={(e) => setForm({ ...form, platformSource: e.target.value })}
                    className={selectClass}
                  >
                    <option value="" disabled>Select a platform</option>
                    {PLATFORM_SOURCES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              {form.platformSource === 'Others' && (
                <div>
                  <label className="block text-sm font-medium text-navy mb-1.5">Specify Platform</label>
                  <div className="relative">
                    <Share2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      required
                      value={platformOther}
                      onChange={(e) => setPlatformOther(e.target.value)}
                      placeholder="e.g. YouTube, Referral Partner"
                      className={fieldClass}
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Referred Through */
            <div>
              <label className="block text-sm font-medium text-navy mb-1.5">Referred Through</label>
              <div className="relative">
                <Share2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                <select
                  required
                  value={form.referredThrough}
                  onChange={(e) => setForm({ ...form, referredThrough: e.target.value })}
                  className={selectClass}
                >
                  <option value="" disabled>Select a source</option>
                  {REFERRAL_SOURCES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Gender */}
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">Gender</label>
            <div className="relative">
              <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
              <select
                required
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className={selectClass}
              >
                <option value="" disabled>Select gender</option>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Marital status */}
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">Marital status</label>
            <div className="relative">
              <Heart className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
              <select
                required
                value={form.maritalStatus}
                onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })}
                className={selectClass}
              >
                <option value="" disabled>Select marital status</option>
                {MARITAL_STATUSES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Academic qualification */}
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">Academic qualification</label>
            <div className="relative">
              <GraduationCap className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                required
                value={form.academicQualification}
                onChange={(e) => setForm({ ...form, academicQualification: e.target.value })}
                placeholder="e.g. Bachelor's in Computer Science"
                className={fieldClass}
              />
            </div>
          </div>

          {/* IELTS/PTE */}
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">IELTS/PTE score</label>
            <div className="relative">
              <Languages className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                required
                value={form.ieltsPte}
                onChange={(e) => setForm({ ...form, ieltsPte: e.target.value })}
                placeholder="e.g. IELTS 7.0 or Not taken yet"
                className={fieldClass}
              />
            </div>
          </div>

          {/* Work experience */}
          <div className={embedded ? 'col-span-2' : ''}>
            <label className="block text-sm font-medium text-navy mb-1.5">Work experience</label>
            <div className="relative">
              <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                required
                value={form.workExperience}
                onChange={(e) => setForm({ ...form, workExperience: e.target.value })}
                placeholder="e.g. 3 years as Software Engineer"
                className={fieldClass}
              />
            </div>
          </div>

          {/* Submit */}
          <div className={embedded ? 'col-span-2' : ''}>
            <button
              type="submit"
              className="w-full bg-navy text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-navy-light transition-colors active:scale-[0.98] mt-2"
            >
              {marketing ? 'Add Lead' : embedded ? 'Add Client' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (embedded) {
    return <div className="p-2">{formCard}</div>;
  }

  return (
    <div className="min-h-screen bg-grey-bg flex flex-col">
      {/* Navy header bar */}
      <header className="bg-navy px-5 py-4 flex items-center gap-3">
        <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center">
          <Mountain className="text-navy" size={20} strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-white font-semibold text-sm leading-tight">CSC Global</p>
          <p className="text-white/50 text-xs">Client Intake Form</p>
        </div>
      </header>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center p-5">{formCard}</div>

      <footer className="bg-white border-t border-grey-border px-5 py-3 text-center">
        <p className="text-xs text-gray-400">CSC Global</p>
      </footer>
    </div>
  );
}
