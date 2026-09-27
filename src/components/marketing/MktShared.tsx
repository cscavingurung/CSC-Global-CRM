import { useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { CHANNEL_STYLES, STAGE_STYLES, campaignName } from '../../marketingDept';
import { Campaign } from '../../types';

// Small building blocks shared by every Marketing page — white cards, thin grey borders,
// no shadows, soft-tinted pills.

export function Pill({ text, cls }: { text: string; cls?: string }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${cls ?? STAGE_STYLES[text] ?? 'bg-gray-100 text-gray-600'}`}>{text}</span>;
}

export function SourceTag({ source }: { source: string }) {
  return <Pill text={source} cls={CHANNEL_STYLES[source] ?? 'bg-gray-100 text-gray-600'} />;
}

export function CampaignTag({ campaigns, id }: { campaigns: Campaign[]; id?: string }) {
  if (!id) return <span className="text-xs text-gray-400">—</span>;
  return <span className="inline-block max-w-[180px] truncate whitespace-nowrap rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700" title={campaignName(campaigns, id)}>{campaignName(campaigns, id)}</span>;
}

export function Card({ title, action, children, className = '' }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-grey-border bg-white ${className}`}>
      {title && (
        <div className="flex items-center gap-2 border-b border-grey-border px-5 py-3">
          <h3 className="flex-1 text-sm font-semibold text-navy">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: 'red' | 'amber' | 'green' }) {
  const toneCls = tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-700' : tone === 'green' ? 'text-emerald-700' : 'text-navy';
  return (
    <div className="rounded-xl border border-grey-border bg-white px-4 py-3">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${toneCls}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}

export function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th className={`whitespace-nowrap px-4 py-2.5 text-xs font-semibold text-gray-500 ${right ? 'text-right' : 'text-left'}`}>{children}</th>;
}

export function Td({ children, right, className = '' }: { children?: React.ReactNode; right?: boolean; className?: string }) {
  return <td className={`px-4 py-2.5 align-top ${right ? 'text-right tabular-nums' : ''} ${className}`}>{children}</td>;
}

export function TableBox({ children, min = 760 }: { children: React.ReactNode; min?: number }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-grey-border bg-white">
      <table className="w-full text-sm" style={{ minWidth: min }}>{children}</table>
    </div>
  );
}

export function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return <tr><td colSpan={cols} className="px-4 py-8 text-center text-sm text-gray-400">{text}</td></tr>;
}

export function PageIntro({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <p className="flex-1 text-sm text-gray-500">{text}</p>
      {children}
    </div>
  );
}

export function PrimaryButton({ children, onClick, disabled, type = 'button', small }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit'; small?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg bg-navy font-medium text-white transition-colors hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-40 ${small ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, onClick, small, danger }: { children: React.ReactNode; onClick?: () => void; small?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition-colors ${danger ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-grey-border text-navy hover:border-navy-light hover:text-navy-light'} ${small ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'}`}
    >
      {children}
    </button>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-dark/50 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className={`dissolve-in relative max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-grey-border bg-white ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>
        <div className="flex items-center justify-between border-b border-grey-border px-6 py-4">
          <h3 className="text-base font-semibold text-navy">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 transition-colors hover:text-navy-light"><X size={18} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

const inputCls = 'w-full rounded-lg border border-grey-border bg-white px-3 py-2.5 text-sm text-navy focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light';

export function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}{required && <span className="text-red-500"> *</span>}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-gray-400">{hint}</span>}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputCls} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={`${inputCls} resize-y`} />;
}

export function SelectInput({ value, onChange, children, label }: { value: string; onChange: (v: string) => void; children: React.ReactNode; label?: string }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={`${inputCls} appearance-none pr-9`}>
        {children}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
    </div>
  );
}

/** Segmented filter chips in one row above a table. */
export function Chips<T extends string>({ options, value, onChange, counts }: {
  options: readonly T[]; value: T; onChange: (v: T) => void; counts?: Partial<Record<T, number>>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${value === o ? 'border-navy bg-navy text-white' : 'border-grey-border bg-white text-gray-600 hover:border-navy-light hover:text-navy-light'}`}
        >
          {o}{counts?.[o] !== undefined && <span className={`ml-1.5 ${value === o ? 'text-white/70' : 'text-gray-400'}`}>{counts[o]}</span>}
        </button>
      ))}
    </div>
  );
}

/** Horizontal bar row — one hue, value labelled in text ink, hover shows the exact figure. */
export function BarRow({ label, value, max, display, sub }: { label: string; value: number; max: number; display?: string; sub?: string }) {
  const pct = max > 0 ? Math.max(value > 0 ? 2 : 0, (value / max) * 100) : 0;
  return (
    <div className="group" title={`${label}: ${display ?? value}`}>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate text-gray-600">{label}</span>
        <span className="shrink-0 font-semibold tabular-nums text-navy">{display ?? value}{sub && <span className="ml-1 font-normal text-gray-400">{sub}</span>}</span>
      </div>
      <div className="h-2 rounded-full bg-grey-bg">
        <div className="h-2 rounded-full bg-navy transition-all duration-500 group-hover:bg-navy-light" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Progress({ value, max, danger }: { value: number; max: number; danger?: boolean }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full rounded-full bg-grey-bg">
      <div className={`h-1.5 rounded-full ${danger ? 'bg-red-500' : 'bg-navy'}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ReadOnlyNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-grey-bg px-3 py-2 text-xs text-gray-500">{children}</p>;
}

/** Right-hand slide-over panel (Lead 360). */
export function Drawer({ title, subtitle, onClose, children }: { title: string; subtitle?: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="animate-fade-in absolute inset-0 bg-navy-dark/30" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label={title} className="dissolve-in relative flex h-full w-full max-w-xl flex-col border-l border-grey-border bg-white">
        <div className="flex items-start justify-between gap-3 border-b border-grey-border px-6 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold text-navy">{title}</h3>
            {subtitle && <div className="mt-1">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 transition-colors hover:text-navy-light"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </aside>
    </div>
  );
}
