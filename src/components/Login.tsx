import { useRef, useState } from 'react';
import { Lock, Mail, Eye, EyeOff } from 'lucide-react';
import { MockUser, StaffMember } from '../types';
import { STAFF_ROLE_TO_ROLE } from '../mockData';
import { isValidEmail, PASSWORD_PATTERN } from '../validation';
import cscLogo from './images/Logo.png';

interface LoginProps {
  staff: StaffMember[];
  onLogin: (user: MockUser) => void;
}

export default function Login({ staff, onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // type="email" only rejects grossly malformed values (e.g. missing "@") — it does not
    // enforce `pattern` — so the stricter email shape is checked here instead.
    if (!isValidEmail(email)) {
      emailRef.current?.setCustomValidity('Enter a valid email address, e.g. you@csc.edu.np');
      emailRef.current?.reportValidity();
      return;
    }

    const match = staff.find((s) => s.email.trim().toLowerCase() === email.trim().toLowerCase());
    if (!match || match.password !== password) {
      setError('Invalid email or password.');
      return;
    }
    if (match.status !== 'Active') {
      setError('This account has been deactivated. Contact your administrator.');
      return;
    }

    onLogin({ name: match.name, role: STAFF_ROLE_TO_ROLE[match.role], branch: match.branch, email: match.email });
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-16">
          <div className="w-60 h-16 flex items-center justify-center">
            <img src={cscLogo} alt="CSC Global" />
          </div>
          <p className="text-gray text-sm">Management Portal</p>
        </div>

        {/* Login card */}
        <div className="bg-white rounded-2xl p-8 border border-grey-border">
          <h2 className="text-xl font-semibold text-navy mb-1">Sign in</h2>
          <p className="text-sm text-gray-500 mb-6">Enter the credentials issued to you by your Branch Manager or Super Admin.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-navy mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={emailRef}
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    e.target.setCustomValidity('');
                    setError(null);
                  }}
                  placeholder="you@csc.edu.np"
                  className="w-full pl-10 pr-4 py-2.5 border border-grey-border rounded-lg text-sm focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-navy mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  pattern={PASSWORD_PATTERN}
                  maxLength={15}
                  title="More than 8 and fewer than 16 characters, including a letter and a number"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="Enter password"
                  className="w-full pl-10 pr-10 py-2.5 border border-grey-border rounded-lg text-sm focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light transition-colors"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 p-1 text-gray-400 hover:text-navy transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">9–15 characters, with at least one letter and one number.</p>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="w-full bg-navy text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-navy-light transition-colors active:scale-[0.98]"
            >
              Sign in
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
