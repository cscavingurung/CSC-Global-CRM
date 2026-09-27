import { useEffect, useState } from 'react';
import { useCurrentUser } from '../currentUser';

interface GreetingBannerProps {
  /** Overrides the signed-in user's name when a page already knows it. */
  name?: string;
}

/** Shared dashboard header: "Hello, [Name]" on the first line, live date and time on the second. */
export default function GreetingBanner({ name }: GreetingBannerProps) {
  const user = useCurrentUser();
  const displayName = name ?? user?.name ?? 'there';

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const clock = `${now.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })} · ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <div className="bg-navy rounded-2xl p-6 lg:p-8 text-white">
      <h2 className="text-xl lg:text-2xl font-semibold">Hello, {displayName}</h2>
      <p className="text-white/60 text-sm mt-1">{clock}</p>
    </div>
  );
}
