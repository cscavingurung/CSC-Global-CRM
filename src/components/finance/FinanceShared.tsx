import { ChevronDown } from 'lucide-react';
import { TX_STATUS_STYLES } from '../../finance';

// Small table and layout pieces shared by the finance routes.

export function Pill({ text, cls }: { text: string; cls?: string }) {
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${cls ?? TX_STATUS_STYLES[text] ?? 'bg-gray-100 text-gray-600'}`}>{text}</span>;
}

export function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-4 py-2.5 text-xs font-semibold text-gray-500 ${right ? 'text-right' : 'text-left'}`}>{children}</th>;
}

export function Td({ children, right, className = '' }: { children: React.ReactNode; right?: boolean; className?: string }) {
  return <td className={`px-4 py-2.5 ${right ? 'text-right tabular-nums' : ''} ${className}`}>{children}</td>;
}

export function TableBox({ children, min = 760 }: { children: React.ReactNode; min?: number }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-grey-border bg-white">
      <table className="w-full text-sm" style={{ minWidth: min }}>{children}</table>
    </div>
  );
}

export function ClientCell({ t }: { t: { clientName: string; clientId: string } }) {
  return <span><span className="font-medium text-navy">{t.clientName}</span><span className="block text-[11px] text-gray-400">{t.clientId}</span></span>;
}

export function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="w-full appearance-none rounded-lg border border-grey-border bg-white py-2.5 pl-3 pr-9 text-sm font-medium text-navy focus:border-navy-light focus:outline-none sm:w-auto">
        {children}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
    </div>
  );
}

/** One-line description (and optional controls) above each section. The section's name is
 * already the page title, from its sidebar sub-tab. */
export function ViewHeader({ description, children }: { description: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <p className="flex-1 text-sm text-gray-500">{description}</p>
      {children}
    </div>
  );
}
