import { useEffect, useRef, useState } from 'react';
import {
  LogOut, Menu, X, ChevronDown, Check, Settings, ExternalLink, Pipette,
  LayoutDashboard, Building2, GraduationCap, FileText, DollarSign,
  Users, BarChart3, UserPlus, UserCheck, CalendarDays, RefreshCw, Landmark, Archive, PhoneCall, Stamp, FileCheck,
  Megaphone, Radar, Briefcase, ListChecks, MonitorCheck, AlertTriangle, DoorOpen, Target, Award,
  Wallet, Percent, ClipboardCheck, Clock, Compass, BadgeCheck, LifeBuoy,
  Inbox, Filter, Send, Activity, ClipboardList, SquareKanban, FolderOpen, Share2, CheckCircle2, Search,
  TrendingUp, Globe, Palette, CalendarClock, Film, ArrowRightLeft,
  Network, Plane, MessagesSquare, Bell, PanelLeftClose, PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react';
import cscLogo from './images/Logo2.png';
// Square logo mark (served from public/) for the compact sidebar.
const cscMark = '/favicon.png';
import { AppNotification, IntakeStudent, MockUser, NavItem } from '../types';
import { ROLE_LABELS, findNavEntry, firstLeaf } from '../mockData';
import { THEME_PRESETS, applyTheme, readTheme, themeLabel } from '../theme';
import NotificationBell from './NotificationBell';

// Desktop sidebar width limits. MAX is the full width that shows every label;
// MIN fits only the logo mark and the tab icons.
const SIDEBAR_MIN = 76;
const SIDEBAR_MAX = 256;
// Below this width labels no longer fit, so the sidebar switches to icons only.
const SIDEBAR_COMPACT_BELOW = 160;
const SIDEBAR_WIDTH_KEY = 'csc-sidebar-width';

const clampSidebar = (w: number) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, w));

function readSidebarWidth(): number {
  try {
    const stored = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    return stored ? clampSidebar(stored) : SIDEBAR_MAX;
  } catch {
    return SIDEBAR_MAX;
  }
}

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, Building2, GraduationCap, FileText, DollarSign,
  Users, BarChart3, UserPlus, UserCheck, CalendarDays, RefreshCw, Landmark, Archive, PhoneCall, Stamp, FileCheck,
  Megaphone, Radar, Briefcase, ListChecks, MonitorCheck, AlertTriangle, DoorOpen, Target, Award,
  Wallet, Percent, ClipboardCheck, Clock, Compass, BadgeCheck, LifeBuoy,
  Inbox, Filter, Send, Activity, ClipboardList, SquareKanban, FolderOpen, Share2, CheckCircle2, Search,
  TrendingUp, Globe, Palette, CalendarClock, Film, ArrowRightLeft,
  Network, Plane, MessagesSquare, Bell, Settings,
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
  /** Optional search box in the top header (Super Admin's Global Search). */
  headerSearch?: React.ReactNode;
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
  headerSearch,
  children,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(readSidebarWidth);
  const [resizing, setResizing] = useState(false);
  const widthRef = useRef(sidebarWidth);
  widthRef.current = sidebarWidth;
  // Tracks the lg breakpoint — on mobile the sidebar is a full-width drawer and never compact.
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const compact = isDesktop && sidebarWidth < SIDEBAR_COMPACT_BELOW;

  const saveSidebarWidth = (w: number) => {
    setSidebarWidth(w);
    try {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w));
    } catch {
      /* storage unavailable — width just won't persist */
    }
  };

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = widthRef.current;
    setResizing(true);
    const onMove = (ev: PointerEvent) => setSidebarWidth(clampSidebar(startWidth + ev.clientX - startX));
    const onUp = () => {
      setResizing(false);
      saveSidebarWidth(widthRef.current);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [theme, setTheme] = useState<string>(() => {
    const stored = readTheme(user.email);
    applyTheme(stored, user.email);
    return stored;
  });
  const chooseTheme = (color: string) => {
    setTheme(color);
    applyTheme(color, user.email);
  };
  const isPreset = THEME_PRESETS.some((p) => p.color.toLowerCase() === theme.toLowerCase());
  const activeEntry = findNavEntry(navItems, activeKey);
  const activeItem = activeEntry?.item;
  const activeGroup = activeEntry?.ancestors[0]?.key ?? null;
  // Nested group inside the Main Tab (e.g. HRM → Attendance), when the page sits in one.
  const activeSubGroup = activeEntry?.ancestors[1]?.key ?? null;

  // Which Main Tab's sub-menu is open — follows the current page, but can be toggled by hand.
  const [expandedGroup, setExpandedGroup] = useState<string | null>(activeGroup);
  useEffect(() => {
    if (activeGroup) setExpandedGroup(activeGroup);
  }, [activeGroup]);
  // Same for the nested group — toggling it only shows/hides its pages, it doesn't navigate.
  const [expandedSubGroup, setExpandedSubGroup] = useState<string | null>(activeSubGroup);
  useEffect(() => {
    if (activeSubGroup) setExpandedSubGroup(activeSubGroup);
  }, [activeSubGroup]);

  const goTo = (key: string) => {
    onNavigate(key);
    setSidebarOpen(false);
  };

  const handleMainTab = (item: NavItem) => {
    if (!item.children) {
      onNavigate(item.key);
      setSidebarOpen(false);
      return;
    }
    if (compact) {
      if (activeGroup !== item.key) onNavigate(firstLeaf(item).key);
      return;
    }
    // Clicking the open Main Tab collapses it; clicking another opens it on its first sub-tab.
    if (expandedGroup === item.key) {
      setExpandedGroup(null);
      return;
    }
    setExpandedGroup(item.key);
    if (activeGroup !== item.key) onNavigate(firstLeaf(item).key);
  };

  const subTabClass = (active: boolean) =>
    `w-full text-left rounded-md px-3 py-2 text-[13px] leading-snug ${
      active ? 'bg-navy-light text-white font-medium' : 'text-white/60 hover:text-white hover:bg-navy-light/60'
    }`;

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
        style={isDesktop ? { width: sidebarWidth } : undefined}
      >
        {/* Logo */}
        <div className={`flex items-center border-b border-white/10 py-4 ${compact ? 'justify-center px-2' : 'px-6'}`}>
          {compact ? (
            <img src={cscMark} alt="CSC Global" className="h-12 w-12 rounded-lg bg-white object-contain p-1" />
          ) : (
            <div className="h-12 w-48 min-w-0 flex justify-center">
              <img src={cscLogo} alt="CSC Global" className="h-full w-full object-contain" />
            </div>
          )}
          
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
            const isGroup = !!item.children;
            const isOpen = isGroup && expandedGroup === item.key;
            const isActive = isGroup ? activeGroup === item.key : activeKey === item.key;
            return (
              <div key={item.key}>
                <button
                  onClick={() => handleMainTab(item)}
                  aria-expanded={isGroup && !compact ? isOpen : undefined}
                  title={compact ? item.label : undefined}
                  className={`nav-item w-full ${compact ? 'justify-center px-0' : ''} ${isActive ? 'nav-item-active' : 'nav-item-inactive'}`}
                >
                  {Icon && <Icon size={18} className="flex-shrink-0" />}
                  {/* Wraps rather than truncates, so long names like "Operation Management" stay readable at any width. */}
                  {!compact && <span className="min-w-0 flex-1 text-left leading-snug break-words">{item.label}</span>}
                  {!compact && item.viewOnly && (
                    <span className="ml-auto text-[10px] text-white/40 font-normal italic">view</span>
                  )}
                  {isGroup && !compact && (
                    <ChevronDown size={16} className={`ml-auto flex-shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
                  )}
                </button>
                {isOpen && !compact && (
                  <div className="dissolve-in mt-1 mb-2 ml-5 pl-3 border-l border-white/15 space-y-0.5">
                    {item.children!.map((child) => {
                      if (!child.children) {
                        return (
                          <button key={child.key} onClick={() => goTo(child.key)} className={subTabClass(activeKey === child.key)}>
                            {child.label}
                          </button>
                        );
                      }
                      // Nested group, e.g. HRM → Attendance.
                      const subOpen = expandedSubGroup === child.key;
                      const holdsActive = activeSubGroup === child.key;
                      return (
                        <div key={child.key}>
                          <button
                            onClick={() => setExpandedSubGroup(subOpen ? null : child.key)}
                            aria-expanded={subOpen}
                            className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] leading-snug ${
                              holdsActive && !subOpen
                                ? 'bg-navy-light/60 text-white font-medium'
                                : holdsActive ? 'text-white font-medium' : 'text-white/60 hover:text-white hover:bg-navy-light/60'
                            }`}
                          >
                            <span className="min-w-0 flex-1">{child.label}</span>
                            <ChevronDown size={14} className={`flex-shrink-0 transition-transform duration-150 ${subOpen ? 'rotate-180' : ''}`} />
                          </button>
                          {subOpen && (
                            <div className="dissolve-in mt-0.5 mb-1 ml-3 pl-2.5 border-l border-white/15 space-y-0.5">
                              {child.children.map((leaf) => (
                                <button key={leaf.key} onClick={() => goTo(leaf.key)} className={subTabClass(activeKey === leaf.key)}>
                                  {leaf.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            title={compact ? 'Log out' : undefined}
            className={`nav-item w-full nav-item-inactive ${compact ? 'justify-center px-0' : ''}`}
          >
            <LogOut size={18} className="flex-shrink-0" />
            {!compact && <span>Log out</span>}
          </button>
        </div>

        {/* Resize handle (desktop) — drag to resize, double-click to toggle full / compact */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          title="Drag to resize · double-click to toggle"
          onPointerDown={startResize}
          onDoubleClick={() => saveSidebarWidth(sidebarWidth > SIDEBAR_MIN ? SIDEBAR_MIN : SIDEBAR_MAX)}
          className={`absolute inset-y-0 -right-1 hidden w-2 cursor-col-resize lg:block after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:transition-colors hover:after:bg-white/40 ${
            resizing ? 'after:bg-white/60' : ''
          }`}
        />
      </aside>

      {/* Main content */}
      <div
        className="flex-1 flex flex-col min-w-0 lg:ml-64"
        style={isDesktop ? { marginLeft: sidebarWidth } : undefined}
      >
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
          {/* Desktop: collapse the sidebar to icons, or expand it back. */}
          <button
            type="button"
            className="hidden lg:inline-flex rounded-lg p-1.5 text-gray-400 transition-colors hover:text-navy-light"
            onClick={() => saveSidebarWidth(compact ? SIDEBAR_MAX : SIDEBAR_MIN)}
            aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'}
            title={compact ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {compact ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>

          <div className="flex-1 min-w-0">
            {activeEntry && activeEntry.ancestors.length > 0 && (
              <p className="text-xs font-medium text-gray-400 truncate">{activeEntry.ancestors.map((a) => a.label).join(' · ')}</p>
            )}
            <h1 key={activeKey} className="dissolve-in text-lg font-semibold text-navy truncate">
              {activeItem?.label || 'Overview'}
            </h1>
          </div>

          {headerSearch}

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
                  <span className="block text-sm font-bold text-navy leading-tight">{user.name}</span>
                  <span className="block text-xs leading-tight mt-0.5 whitespace-nowrap">
                    <span className="font-medium text-navy-light">
                      {user.role === 'marketing' && user.marketingRole ? `Marketing · ${user.marketingRole}` : ROLE_LABELS[user.role]}
                    </span>
                    <span className="text-gray-300 mx-1">·</span>
                    <span className="text-gray-500">{user.branch}</span>
                  </span>
                </span>
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
                    <div className="grid grid-cols-5 gap-2 px-3 pb-2 pt-1">
                      {THEME_PRESETS.map((preset) => {
                        const selected = preset.color.toLowerCase() === theme.toLowerCase();
                        return (
                          <button
                            key={preset.color}
                            title={preset.label}
                            aria-label={preset.label}
                            onClick={() => chooseTheme(preset.color)}
                            className={`h-7 w-7 rounded-full flex items-center justify-center border border-grey-border transition-transform hover:scale-110 ${
                              selected ? 'ring-2 ring-offset-2 ring-navy' : ''
                            }`}
                            style={{ backgroundColor: preset.color }}
                          >
                            {selected && <Check size={14} className="text-white" />}
                          </button>
                        );
                      })}
                    </div>
                    <label className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-navy hover:bg-grey-bg">
                      <span className="relative h-4 w-4 flex-shrink-0 overflow-hidden rounded-full border border-grey-border" style={{ backgroundColor: theme }}>
                        <input
                          type="color"
                          value={theme}
                          onChange={(e) => chooseTheme(e.target.value)}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        />
                      </span>
                      <span className="flex-1 truncate">{isPreset ? 'Custom color…' : themeLabel(theme)}</span>
                      {isPreset ? <Pipette size={14} className="text-gray-400" /> : <Check size={14} className="text-navy" />}
                    </label>

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
                {
                  label: 'Role',
                  value: user.role === 'marketing' && user.marketingRole ? `Marketing · ${user.marketingRole}` : ROLE_LABELS[user.role],
                },
                { label: 'Branch', value: user.branch },
                { label: 'Theme Color', value: themeLabel(theme) },
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
