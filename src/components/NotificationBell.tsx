import { useState } from 'react';
import { Bell, CheckCheck, Lock, UserCheck } from 'lucide-react';
import { AppNotification, IntakeStudent, MockUser } from '../types';
import { isNotificationVisibleTo, formatRelativeTime } from '../notifications';

interface NotificationBellProps {
  notifications: AppNotification[];
  user: MockUser;
  onMarkRead: (id: string) => void;
  onMarkAllRead: (ids: string[]) => void;
  onNavigate: (key: string) => void;
  /** Leads referenced by blind broadcast notifications — used to show claim state. */
  leads?: IntakeStudent[];
  /** Claims a broadcast lead for the signed-in counselor (first-come, first-served). */
  onAcceptLead?: (leadId: string) => void;
}

export default function NotificationBell({ notifications, user, onMarkRead, onMarkAllRead, onNavigate, leads = [], onAcceptLead }: NotificationBellProps) {
  const [open, setOpen] = useState(false);

  const visible = notifications
    .filter((n) => isNotificationVisibleTo(n, user))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const unread = visible.filter((n) => !n.read);

  const handleRowClick = (n: AppNotification) => {
    if (!n.read) onMarkRead(n.id);
    onNavigate(n.navigateTo);
    setOpen(false);
  };

  const leadFor = (n: AppNotification) => (n.leadId ? leads.find((l) => l.id === n.leadId) : undefined);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative text-gray-400 hover:text-navy transition-colors"
        title="Notifications"
      >
        <Bell size={20} />
        {unread.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-navy text-white text-[10px] font-semibold flex items-center justify-center">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Sidebar sits at z-40, so this overlay must sit above it to catch outside clicks there too */}
          <div className="fixed inset-0 z-[45]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-[46] mt-2 w-80 sm:w-96 bg-white border border-grey-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-grey-border">
              <h3 className="text-sm font-semibold text-navy">Notifications</h3>
              {unread.length > 0 && (
                <button
                  onClick={() => onMarkAllRead(unread.map((n) => n.id))}
                  className="inline-flex items-center gap-1 text-xs font-medium text-navy hover:text-navy-light transition-colors"
                >
                  <CheckCheck size={13} />
                  Mark all as read
                </button>
              )}
            </div>

            {visible.length > 0 ? (
              <div className="max-h-96 overflow-y-auto">
                {visible.map((n) => {
                  // Blind broadcast: no personal contact details, just country + case type
                  // and an Accept Lead button until someone claims it.
                  if (n.trigger === 'lead-broadcast') {
                    const lead = leadFor(n);
                    const claimedBy = lead?.claimedBy;
                    return (
                      <div
                        key={n.id}
                        className={`flex items-start gap-2.5 border-b border-grey-border px-4 py-3 last:border-0 ${
                          !n.read ? 'bg-navy/5' : ''
                        }`}
                      >
                        <Lock size={13} className="mt-1 flex-shrink-0 text-gray-400" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-snug text-navy">{n.messageBefore}{n.messageAfter}</p>
                          <p className="mt-1 text-xs text-gray-400">{formatRelativeTime(n.createdAt)}</p>
                          {claimedBy ? (
                            <span className="mt-2 inline-block rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                              {claimedBy === user.name ? 'Claimed by you' : `Claimed by ${claimedBy}`}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (!n.read) onMarkRead(n.id);
                                if (n.leadId) onAcceptLead?.(n.leadId);
                              }}
                              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-navy-light active:scale-[0.98]"
                            >
                              <UserCheck size={13} />
                              Accept Lead
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={n.id}
                      onClick={() => handleRowClick(n)}
                      className={`w-full flex items-start gap-2.5 px-4 py-3 text-left border-b border-grey-border last:border-0 transition-colors hover:bg-grey-bg ${
                        !n.read ? 'bg-navy/5' : ''
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${!n.read ? 'bg-navy' : 'bg-transparent'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-navy leading-snug">
                          {n.messageBefore}
                          <span className="font-semibold">{n.studentName}</span>
                          {n.messageAfter}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">{formatRelativeTime(n.createdAt)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">No notifications</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
