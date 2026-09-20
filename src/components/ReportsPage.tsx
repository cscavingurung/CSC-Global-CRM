import { useState } from 'react';
import { Calendar, BarChart3, FileText, TrendingUp, Download, ChevronDown, Building2 } from 'lucide-react';

interface ReportsPageProps {
  branches?: string[];
  showBranchFilter?: boolean;
}

export default function ReportsPage({ branches, showBranchFilter }: ReportsPageProps) {
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const barData = [
    { label: 'Preparation', value: 40, color: 'bg-gray-400' },
    { label: 'Lodgement', value: 30, color: 'bg-navy' },
    { label: 'Success', value: 20, color: 'bg-green-500' },
    { label: 'Refused', value: 10, color: 'bg-red-500' },
  ];

  const lineData = [
    { label: 'W1', value: 8 },
    { label: 'W2', value: 12 },
    { label: 'W3', value: 6 },
    { label: 'W4', value: 15 },
    { label: 'W5', value: 10 },
    { label: 'W6', value: 18 },
  ];

  const countryData = [
    { label: 'Australia', value: 35, color: 'bg-navy' },
    { label: 'Canada', value: 25, color: 'bg-navy-light' },
    { label: 'UK', value: 18, color: 'bg-navy/60' },
    { label: 'USA', value: 12, color: 'bg-navy/40' },
    { label: 'NZ', value: 10, color: 'bg-navy/20' },
  ];

  return (
    <div className="space-y-6">
      {/* Header with date range picker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-navy">Reports & Analytics</h2>
          <p className="text-sm text-gray-500 mt-0.5">Branch performance overview</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-grey-border rounded-lg px-3 py-2">
            <Calendar className="text-gray-400" size={16} />
            <input
              type="date"
              defaultValue="2026-09-01"
              className="text-sm text-navy focus:outline-none bg-transparent"
            />
            <span className="text-gray-300 text-sm">to</span>
            <input
              type="date"
              defaultValue="2026-09-15"
              className="text-sm text-navy focus:outline-none bg-transparent"
            />
          </div>
          <button className="inline-flex items-center gap-2 bg-navy text-white font-medium px-4 py-2 rounded-lg text-sm hover:bg-navy-light transition-colors whitespace-nowrap">
            <Download size={15} />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>
      {showBranchFilter && branches && (
        <div className="flex items-center gap-2">
          <Building2 className="text-gray-400" size={16} />
          <div className="relative">
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="appearance-none bg-white border border-grey-border rounded-lg pl-3 pr-9 py-2 text-sm font-medium text-navy focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light transition-colors"
            >
              <option value="all">All Branches (Company-wide)</option>
              {branches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
          </div>
        </div>
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Applications', value: '8', icon: FileText, sub: 'this period' },
          { label: 'Success Rate', value: '75%', icon: TrendingUp, sub: '+5% vs last' },
          { label: 'Avg Processing Time', value: '12 days', icon: BarChart3, sub: '-2 days vs last' },
          { label: 'Total Consultations', value: '14', icon: Calendar, sub: '+3 this week' },
        ].map((tile) => {
          const Icon = tile.icon;
          return (
            <div key={tile.label} className="stat-card">
              <div className="w-10 h-10 rounded-lg bg-navy/5 flex items-center justify-center mb-3">
                <Icon className="text-navy" size={20} />
              </div>
              <p className="text-2xl font-bold text-navy">{tile.value}</p>
              <p className="text-sm text-gray-500 mt-0.5">{tile.label}</p>
              <p className="text-xs text-gray-400 mt-1">{tile.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar chart — Applications by Status */}
        <div className="stat-card">
          <h3 className="text-base font-semibold text-navy mb-1">Applications by Status</h3>
          <p className="text-xs text-gray-400 mb-6">Distribution of applications across all stages</p>
          <div className="flex items-end justify-between gap-4 h-48 px-2">
            {barData.map((bar) => (
              <div key={bar.label} className="flex flex-col items-center gap-2 flex-1">
                <div className="w-full flex items-end justify-center" style={{ height: '160px' }}>
                  <div
                    className={`w-full max-w-[60px] rounded-t-lg ${bar.color} transition-all duration-300 hover:opacity-80`}
                    style={{ height: `${bar.value * 3.2}px` }}
                  />
                </div>
                <span className="text-xs text-gray-500 text-center">{bar.label}</span>
                <span className="text-xs font-semibold text-navy">{bar.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Line chart — Consultations Over Time */}
        <div className="stat-card">
          <h3 className="text-base font-semibold text-navy mb-1">Consultations Over Time</h3>
          <p className="text-xs text-gray-400 mb-6">Weekly consultation count for the past 6 weeks</p>
          <div className="relative h-48">
            <svg className="w-full h-full" viewBox="0 0 300 160" preserveAspectRatio="none">
              {/* Grid lines */}
              {[0, 40, 80, 120, 160].map((y) => (
                <line key={y} x1="0" y1={y} x2="300" y2={y} stroke="#E5E7EB" strokeWidth="1" strokeDasharray={y === 160 ? '0' : '4'} />
              ))}
              {/* Line */}
              <polyline
                points={lineData.map((d, i) => {
                  const x = (i / (lineData.length - 1)) * 280 + 10;
                  const y = 160 - (d.value / 20) * 140;
                  return `${x},${y}`;
                }).join(' ')}
                fill="none"
                stroke="#16283D"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {/* Area fill */}
              <polygon
                points={`${lineData.map((d, i) => {
                  const x = (i / (lineData.length - 1)) * 280 + 10;
                  const y = 160 - (d.value / 20) * 140;
                  return `${x},${y}`;
                }).join(' ')},290,160 10,160`}
                fill="#16283D"
                opacity="0.05"
              />
              {/* Dots */}
              {lineData.map((d, i) => {
                const x = (i / (lineData.length - 1)) * 280 + 10;
                const y = 160 - (d.value / 20) * 140;
                return <circle key={i} cx={x} cy={y} r="4" fill="#16283D" />;
              })}
            </svg>
            {/* X-axis labels */}
            <div className="flex justify-between px-3 -mt-1">
              {lineData.map((d) => (
                <span key={d.label} className="text-xs text-gray-400">{d.label}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Horizontal bar — Clients by Country */}
        <div className="stat-card lg:col-span-2">
          <h3 className="text-base font-semibold text-navy mb-1">Clients by Country of Interest</h3>
          <p className="text-xs text-gray-400 mb-6">Top destinations for this period</p>
          <div className="space-y-3">
            {countryData.map((item) => (
              <div key={item.label} className="flex items-center gap-4">
                <span className="text-sm text-gray-600 w-24 flex-shrink-0">{item.label}</span>
                <div className="flex-1 h-7 bg-grey-bg rounded-lg overflow-hidden">
                  <div
                    className={`h-full rounded-lg ${item.color} transition-all duration-300`}
                    style={{ width: `${item.value * 2.5}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-navy w-8 text-right">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
