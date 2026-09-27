import { useMemo, useState } from 'react';
import { ChevronRight, Lock, Mail, Search } from 'lucide-react';
import { DEMO_MODE } from '../appMode';
import { MockUser, StaffMember, StaffRole } from '../types';
import { STAFF_ROLE_TO_ROLE, ROLE_BADGE_STYLES } from '../mockData';
import cscLogo from './images/Logo.png';

interface LoginProps {
  staff: StaffMember[];
  onLogin: (user: MockUser) => void;
}

// Demo mode (see appMode.ts): pick any active staff member to sign in as them.
// Otherwise: email + password, active accounts only.
// SECURITY (P0, docs/SECURITY_AUDIT.md): the password check below compares against the `staff`
// table in the browser. Real CSC data needs Supabase Auth + RLS before go-live.
const ROLE_ORDER: StaffRole[] = [
  'Super Admin', 'Marketing', 'Branch Manager', 'Front Desk Officer', 'Counselor', 'V/A Officer',
];

export default function Login({ staff, onLogin }: LoginProps) {
  const [query, setQuery] = useState('');

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = staff.filter(
      (s) => !q || [s.name, s.email, s.role, s.branch].some((v) => v.toLowerCase().includes(q))
    );
    return ROLE_ORDER.map((role) => ({
      role,
      members: matches.filter((s) => s.role === role).sort((a, b) => a.branch.localeCompare(b.branch)),
    })).filter((g) => g.members.length > 0);
  }, [staff, query]);

  // Deactivated employees can't sign in (and App.tsx signs them out if deactivated mid-session).
  const signInAs = (s: StaffMember) => s.status === 'Active' && onLogin({
      name: s.name, role: STAFF_ROLE_TO_ROLE[s.role], branch: s.branch, email: s.email,
      ...(s.role === 'Marketing' ? { marketingRole: s.marketingRole ?? 'Marketing Manager' } : {}),
    });

  return (
    <div className="min-h-screen flex items-center justify-center py-10 px-4">
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center mb-8">
          <div className="w-60 h-16 flex items-center justify-center">
            <img src={cscLogo} alt="CSC Global" />
          </div>
          <p className="text-gray text-sm">Management Portal</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-grey-border">
          <h2 className="text-xl font-semibold text-navy mb-1">Sign in</h2>
          {!DEMO_MODE ? <PasswordSignIn staff={staff} onSignIn={signInAs} /> : (<>
          <p className="text-sm text-gray-500 mb-4">Demo mode — sample data. Select a user to sign in; no password required.</p>

          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, role or branch"
              className="w-full pl-10 pr-4 py-2.5 border border-grey-border rounded-lg text-sm focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light transition-colors"
            />
          </div>

          <div className="max-h-[60vh] overflow-y-auto space-y-4 -mx-1 px-1">
            {staff.length === 0 && <p className="text-sm text-gray-500 text-center py-6">Loading users…</p>}
            {staff.length > 0 && grouped.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-6">No users match “{query}”.</p>
            )}
            {grouped.map(({ role, members }) => (
              <div key={role}>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">{role}</p>
                <div className="space-y-1.5">
                  {members.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => signInAs(s)}
                      disabled={s.status !== 'Active'}
                      title={s.status !== 'Active' ? 'Inactive employees cannot sign in' : undefined}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-grey-border text-left hover:border-navy-light hover:bg-gray-50 transition-colors active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
                    >
                      <span className="w-9 h-9 shrink-0 rounded-full bg-navy/10 text-navy text-sm font-semibold flex items-center justify-center">
                        {s.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-navy truncate">{s.name}</span>
                        <span className="block text-xs text-gray-500 truncate">{s.email} · {s.branch}</span>
                      </span>
                      {s.status !== 'Active' && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>
                      )}
                      <span className={`hidden sm:inline text-[11px] px-2 py-0.5 rounded-full ${ROLE_BADGE_STYLES[STAFF_ROLE_TO_ROLE[s.role]]}`}>
                        {s.role === 'Marketing' && s.marketingRole ? s.marketingRole : role}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          </>)}
        </div>
      </div>
    </div>
  );
}

function PasswordSignIn({ staff, onSignIn }: { staff: StaffMember[]; onSignIn: (s: StaffMember) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (staff.length === 0) { setError('Can’t reach the staff directory — check the connection and try again.'); return; }
    const match = staff.find((s) => s.email.trim().toLowerCase() === email.trim().toLowerCase());
    // One message for unknown email and wrong password, so accounts can't be probed.
    if (!match || match.password !== password) { setError('Email or password is incorrect.'); return; }
    if (match.status !== 'Active') { setError('This account is inactive. Contact your manager or the Super Admin.'); return; }
    onSignIn(match);
  };
  const field = 'w-full pl-10 pr-4 py-2.5 border border-grey-border rounded-lg text-sm focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light';
  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-navy">Email</span>
        <span className="relative block">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="email" autoComplete="username" required value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} className={field} />
        </span>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-navy">Password</span>
        <span className="relative block">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} className={field} />
        </span>
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" className="w-full rounded-lg bg-navy py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-light">Sign in</button>
    </form>
  );
}
