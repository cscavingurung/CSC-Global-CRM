import { useState } from 'react';
import {
  LogOut, Menu, X, ChevronDown, Check, Settings, ExternalLink,
  LayoutDashboard, Building2, GraduationCap, FileText, DollarSign,
  Users, BarChart3, UserPlus, UserCheck, CalendarDays, RefreshCw, Landmark, Archive, PhoneCall, Stamp, FileCheck,
  Megaphone, Radar,
  type LucideIcon,
} from 'lucide-react';
import cscLogo from './images/Logo2.png';
import { AppNotification, IntakeStudent, MockUser, NavItem } from '../types';
import { ROLE_LABELS } from '../mockData';
import { THEME_OPTIONS, ThemeKey, applyTheme, readTheme } from '../theme';
import NotificationBell from './NotificationBell';

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, Building2, GraduationCap, FileText, DollarSign,
  Users, BarChart3, UserPlus, UserCheck, CalendarDays, RefreshCw, Landmark, Archive, PhoneCall, Stamp, FileCheck,
  Megaphone, Radar,
};

interface DashboardShellProps {
  user: MockUser;
  navItems: NavItem[];
  activeKey: string;
  onNavigate: (key: string) => void;
  onLogout: () => void;
  notifications: AppNotification[];
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: (ids: string[]) => void;
  /** Leads referenced by blind marketing broadcasts. */
  leads?: IntakeStudent[];
  onAcceptLead?: (leadId: string) => void;
  children: React.ReactNode;
}

export default function DashboardShell({
  user,
  navItems,
  activeKey,
  onNavigate,
  onLogout,
  notifications,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  leads,
  onAcceptLead,
  children,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [theme, setTheme] = useState<ThemeKey>(() => {
    const stored = readTheme();
    applyTheme(stored);
    return stored;
  });
  const activeItem = navItems.find((item) => item.key === activeKey);

  return (
    <div className="h-screen bg-grey-bg flex overflow-hidden">
      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-navy flex flex-col transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center px-6 py-4 border-b border-white/10">
          <div className="w-48 h-12 flex align items-left justify-center">
            <img src={cscLogo} alt="CSC Global" className="h-full w-full object-contain" />
          </div>
          
          <button
            className="ml-auto lg:hidden text-white/60"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = ICON_MAP[item.icon];
            return (
              <button
                key={item.key}
                onClick={() => {
                  onNavigate(item.key);
                  setSidebarOpen(false);
                }}
                className={`nav-item w-full ${
                  activeKey === item.key ? 'nav-item-active' : 'nav-item-inactive'
                }`}
              >
                {Icon && <Icon size={18} className="flex-shrink-0" />}
                <span className="truncate">{item.label}</span>
                {item.viewOnly && (
                  <span className="ml-auto text-[10px] text-white/40 font-normal italic">view</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="nav-item w-full nav-item-inactive"
          >
            <LogOut size={18} className="flex-shrink-0" />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        {/* Top bar */}
        {/* z-[41]: above the sidebar (z-40, so the notification dropdown's outside-click overlay can
            catch clicks over it), below modals/drawers (z-50) so those still sit above the header */}
        <header className="bg-white border-b border-grey-border px-4 lg:px-8 py-4 flex items-center gap-4 sticky top-0 z-[41]">
          <button
            className="lg:hidden text-navy"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>

          <h1 className="text-lg font-semibold text-navy flex-1 min-w-0 truncate">
            {activeItem?.label || 'Overview'}
          </h1>

          {/* User info + settings menu */}
          <div className="flex items-center gap-3">
            <NotificationBell
              notifications={notifications}
              user={user}
              onMarkRead={onMarkNotificationRead}
              onMarkAllRead={onMarkAllNotificationsRead}
              onNavigate={onNavigate}
              leads={leads}
              onAcceptLead={onAcceptLead}
            />
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-grey-bg"
              >
                <span className="text-right hidden sm:block">
                  <span className="block text-sm font-medium text-navy leading-tight">{user.name}</span>
                  <span className="block text-xs text-gray-500">{user.branch}</span>
                </span>
                <span className="role-badge">{ROLE_LABELS[user.role]}</span>
                <ChevronDown size={16} className="text-gray-400" />
              </button>

              {userMenuOpen && (
                <>
                  <button
                    aria-label="Close menu"
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="dissolve-in absolute right-0 z-50 mt-2 w-60 rounded-xl border border-grey-border bg-white p-1.5">
                    <p className="px-3 pb-1.5 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Theme Color
                    </p>
                    {THEME_OPTIONS.map((option) => (
                      <button
                        key={option.key}
                        onClick={() => {
                          setTheme(option.key);
                          applyTheme(option.key);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-navy hover:bg-grey-bg"
                      >
                        <span
                          className="h-4 w-4 flex-shrink-0 rounded-full border border-grey-border"
                          style={{ backgroundColor: option.swatch }}
                        />
                        <span className="flex-1 truncate">{option.label}</span>
                        {theme === option.key && <Check size={14} className="text-navy" />}
                      </button>
                    ))}

                    <div className="my-1.5 border-t border-grey-border" />

                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        setShowOptions(true);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-navy hover:bg-grey-bg"
                    >
                      <Settings size={16} className="text-gray-400" /> Options
                    </button>
                    <a
                      href="https://csc.edu.np"
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-navy hover:bg-grey-bg"
                    >
                      <ExternalLink size={16} className="text-gray-400" /> Website
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">{children}</main>
      </div>

      {/* Logout confirmation dialog */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-dark/50 backdrop-blur-sm" onClick={() => setShowLogoutConfirm(false)} />
          <div className="relative bg-white rounded-2xl border border-grey-border max-w-sm w-full p-6">
            <div className="w-12 h-12 rounded-xl bg-navy/5 flex items-center justify-center mx-auto mb-4">
              <LogOut className="text-navy" size={24} />
            </div>
            <h3 className="text-base font-semibold text-navy text-center mb-2">Log out?</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              You'll need to sign in again to access the portal.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 border border-grey-border rounded-lg text-sm font-medium text-navy hover:bg-grey-bg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onLogout}
                className="flex-1 py-2.5 bg-navy text-white rounded-lg text-sm font-semibold hover:bg-navy-light transition-colors"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Options — general account settings */}
      {showOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-dark/50 backdrop-blur-sm" onClick={() => setShowOptions(false)} />
          <div className="dissolve-in relative w-full max-w-md rounded-2xl border border-grey-border bg-white p-6">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-semibold text-navy">Options</h3>
              <button onClick={() => setShowOptions(false)} className="text-gray-400 hover:text-navy">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              {[
                { label: 'Name', value: user.name },
                { label: 'Email', value: user.email },
                { label: 'Role', value: ROLE_LABELS[user.role] },
                { label: 'Branch', value: user.branch },
                { label: 'Theme Color', value: THEME_OPTIONS.find((o) => o.key === theme)?.label ?? '' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 border-b border-grey-border pb-2.5 last:border-0">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{row.label}</span>
                  <span className="truncate text-sm text-navy">{row.value}</span>
                </div>
              ))}
            </div>

            <p className="mt-4 text-xs text-gray-400">
              Contact your branch manager to change your name, email or branch.
            </p>

            <button
              onClick={() => setShowOptions(false)}
              className="mt-5 w-full rounded-lg bg-navy py-2.5 text-sm font-semibold text-white hover:bg-navy-light"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
