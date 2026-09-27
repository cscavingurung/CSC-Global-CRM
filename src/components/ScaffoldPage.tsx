import { Check, Construction } from 'lucide-react';
import { ScaffoldInfo } from '../branchManagerPages';

interface ScaffoldPageProps {
  title: string;
  /** Main Tab this sub-tab sits under, shown as a soft pill. */
  section?: string;
  info?: ScaffoldInfo;
}

/** Placeholder for a scaffolded sub-tab: what the page is for and what's planned. */
export default function ScaffoldPage({ title, section, info }: ScaffoldPageProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-grey-border p-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {section && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-navy/10 text-navy">{section}</span>}
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">In development</span>
        </div>
        <h2 className="text-xl font-semibold text-navy">{title}</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          {info?.description ?? 'This section is being built.'}
        </p>
      </div>

      {info && info.features.length > 0 && (
        <div className="bg-white rounded-xl border border-grey-border p-6">
          <h3 className="text-base font-semibold text-navy mb-4">Planned features</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {info.features.map((feature) => (
              <div key={feature} className="flex items-center gap-3 rounded-lg border border-grey-border px-4 py-3">
                <span className="w-6 h-6 rounded-full bg-navy/5 text-navy flex items-center justify-center flex-shrink-0">
                  <Check size={14} />
                </span>
                <span className="text-sm text-navy">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col items-center justify-center text-center py-10">
        <div className="w-14 h-14 rounded-2xl bg-navy/5 flex items-center justify-center mb-4">
          <Construction className="text-navy" size={28} />
        </div>
        <p className="text-sm text-gray-500 max-w-sm">This page is scaffolded and ready to be built out.</p>
      </div>
    </div>
  );
}
