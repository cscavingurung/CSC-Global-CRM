import { useState } from 'react';
import { Lock, Mail } from 'lucide-react';
import { MockUser, StaffMember } from '../types';
import { STAFF_ROLE_TO_ROLE } from '../mockData';
import { supabase } from '../lib/supabaseClient';
import cscLogo from './images/Logo.png';

interface LoginProps {
  staff: StaffMember[];
  onLogin: (user: MockUser) => void;
}

// Real Supabase Auth (see supabase/functions/admin-staff and docs/SECURITY_AUDIT.md, P0 —
// resolved): sign-in goes through supabase.auth.signInWithPassword, then the matching `staff`
// row (looked up by authUserId) supplies role/branch/marketingRole for the session.
export default function Login({ staff, onLogin }: LoginProps) {
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
          <PasswordSignIn staff={staff} onLogin={onLogin} />
        </div>
      </div>
    </div>
  );
}

function PasswordSignIn({ staff, onLogin }: { staff: StaffMember[]; onLogin: (user: MockUser) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) { setError('Can’t reach the server — check the connection and try again.'); return; }
    setSubmitting(true);
    setError('');
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError || !data.user) {
      // One message for unknown email and wrong password, so accounts can't be probed.
      setError('Email or password is incorrect.');
      setSubmitting(false);
      return;
    }
    const match = staff.find((s) => s.authUserId === data.user!.id);
    if (!match || match.status !== 'Active') {
      await supabase.auth.signOut();
      setError(match ? 'This account is inactive. Contact your manager or the Super Admin.' : 'No staff record is linked to this account. Contact the Super Admin.');
      setSubmitting(false);
      return;
    }
    onLogin({
      name: match.name,
      role: STAFF_ROLE_TO_ROLE[match.role],
      branch: match.branch,
      email: match.email,
      authUserId: data.user.id,
      ...(match.role === 'Marketing' ? { marketingRole: match.marketingRole ?? 'Marketing Manager' } : {}),
    });
    setSubmitting(false);
  };

  const field = 'w-full pl-10 pr-4 py-2.5 border border-grey-border rounded-lg text-sm focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light';
  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-navy">Email</span>
        <span className="relative block">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="email" autoComplete="username" required placeholder="you@csc.edu.np" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} className={field} />
        </span>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-navy">Password</span>
        <span className="relative block">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="password" autoComplete="current-password" required placeholder="Enter your password" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} className={field} />
        </span>
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={submitting} className="w-full rounded-lg bg-navy py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-light disabled:opacity-60">
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
