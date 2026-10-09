import { useState } from 'react';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { MockUser } from '../types';
import { supabase } from '../lib/supabaseClient';
import { resolveStaffUser } from '../lib/sessionUser';
import cscLogo from './images/Logo.png';

interface LoginProps {
  onLogin: (user: MockUser) => void;
}

// Real Supabase Auth (see supabase/functions/admin-staff and docs/SECURITY_AUDIT.md, P0 —
// resolved): sign-in goes through supabase.auth.signInWithPassword, then the matching `staff`
// row (looked up by authUserId) supplies role/branch/marketingRole for the session. That lookup
// must happen *after* signing in, scoped to just this user's row (`auth_user_id = auth.uid()`) —
// RLS denies an anonymous, pre-login read of the whole `staff` table, so it can't be resolved
// from a list fetched before authentication.
export default function Login({ onLogin }: LoginProps) {
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
          <PasswordSignIn onLogin={onLogin} />
        </div>
      </div>
    </div>
  );
}

function PasswordSignIn({ onLogin }: { onLogin: (user: MockUser) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    const result = await resolveStaffUser(data.user.id);
    if ('error' in result) {
      await supabase.auth.signOut();
      setError(result.error);
      setSubmitting(false);
      return;
    }
    onLogin(result.user);
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
          <input type={showPassword ? 'text' : 'password'} autoComplete="current-password" required placeholder="Enter your password" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} className={field.replace('pr-4', 'pr-10')} />
          <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-navy">
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </span>
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={submitting} className="w-full rounded-lg bg-navy py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-light disabled:opacity-60">
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
