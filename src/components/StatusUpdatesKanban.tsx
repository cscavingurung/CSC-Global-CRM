import { useState } from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { ApplicationRecord, OfferApplication, OfferStatus, VisaApplication, VisaStageStatus } from '../types';
import { getActiveOfferApplication, isVisaUnlocked, isChecklistComplete, emptyVisaChecklist, today } from '../clientPipeline';

type BoardTab = 'offer' | 'visa';

interface StatusUpdatesKanbanProps {
  applications: ApplicationRecord[];
  onUpdateApplication: (id: string, updates: Partial<ApplicationRecord>) => void;
  /** Which board opens first — set when arriving from the Offer/Visa Applications page's
   * own Status Updates tab, so it lands on the matching board instead of always "offer". */
  initialTab?: BoardTab;
}

const OFFER_COLUMNS: { status: OfferStatus; label: string; dotColor: string; headerColor: string }[] = [
  { status: 'Enrolled', label: 'Enrolled', dotColor: 'bg-gray-400', headerColor: 'text-gray-600' },
  { status: 'Applied to Institution', label: 'Applied to Institution', dotColor: 'bg-navy', headerColor: 'text-navy' },
  { status: 'Further Information Required', label: 'Further Information Required', dotColor: 'bg-amber-400', headerColor: 'text-amber-700' },
  { status: 'Offer Received', label: 'Offer Received', dotColor: 'bg-green-500', headerColor: 'text-green-600' },
  { status: 'Rejected', label: 'Rejected', dotColor: 'bg-red-500', headerColor: 'text-red-600' },
  { status: 'Fee Paid', label: 'Fee Paid', dotColor: 'bg-green-500', headerColor: 'text-green-600' },
];

const VISA_COLUMNS: { status: VisaStageStatus; label: string; dotColor: string; headerColor: string }[] = [
  { status: 'Preparing Documents', label: 'Preparing Documents', dotColor: 'bg-gray-400', headerColor: 'text-gray-600' },
  { status: 'File Ready for Visa', label: 'File Ready for Visa', dotColor: 'bg-navy', headerColor: 'text-navy' },
  { status: 'Visa Applied', label: 'Visa Applied', dotColor: 'bg-navy', headerColor: 'text-navy' },
  { status: 'Visa Approved', label: 'Visa Approved', dotColor: 'bg-green-500', headerColor: 'text-green-600' },
  { status: 'Visa Refused', label: 'Visa Refused', dotColor: 'bg-red-500', headerColor: 'text-red-600' },
];

const OFFER_TERMINAL: OfferStatus[] = ['Offer Received', 'Rejected', 'Fee Paid'];
const VISA_TERMINAL: VisaStageStatus[] = ['Visa Approved', 'Visa Refused'];

interface OfferCardData { app: ApplicationRecord; offerApp: OfferApplication }

export default function StatusUpdatesKanban({ applications, onUpdateApplication, initialTab }: StatusUpdatesKanbanProps) {
  const [tab, setTab] = useState<BoardTab>(initialTab ?? 'offer');
  const [pendingOfferMove, setPendingOfferMove] = useState<{ card: OfferCardData; newStatus: OfferStatus } | null>(null);
  const [pendingVisaMove, setPendingVisaMove] = useState<{ app: ApplicationRecord; newStatus: VisaStageStatus } | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showToastMessage = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
  };

  // ─── Offer board ───────────────────────────────────────────────────────────

  const activeOfferCards: OfferCardData[] = applications
    .filter((a) => !a.withdrawn)
    .map((a) => {
      const offerApp = getActiveOfferApplication(a);
      return offerApp ? { app: a, offerApp } : null;
    })
    .filter((c): c is OfferCardData => c !== null);

  const applyOfferMove = (card: OfferCardData, newStatus: OfferStatus) => {
    const date = today();
    const updates: Partial<OfferApplication> = { status: newStatus, statusUpdatedAt: date };
    if (newStatus === 'Applied to Institution') updates.appliedDate = date;
    if (newStatus === 'Offer Received' || newStatus === 'Rejected') updates.outcomeDate = date;
    if (newStatus === 'Fee Paid') updates.feePaidDate = date;
    onUpdateApplication(card.app.id, {
      offerApplications: card.app.offerApplications.map((o) => (o.id === card.offerApp.id ? { ...o, ...updates } : o)),
      // Fee Paid unlocks the visa stage — spin up its case here too, same as ClientProfile.
      ...(newStatus === 'Fee Paid'
        ? { visaApplication: { status: 'Preparing Documents' as const, statusUpdatedAt: date, checklist: emptyVisaChecklist(), notes: '' } }
        : {}),
    });
    showToastMessage(`${card.app.name} moved to ${newStatus}`);
  };

  const handleOfferMove = (card: OfferCardData, newStatus: OfferStatus) => {
    if (newStatus === card.offerApp.status) return;
    if (OFFER_TERMINAL.includes(newStatus)) setPendingOfferMove({ card, newStatus });
    else applyOfferMove(card, newStatus);
  };

  // ─── Visa board ────────────────────────────────────────────────────────────

  const visaCards = applications.filter((a) => !a.withdrawn && isVisaUnlocked(a) && a.visaApplication !== null);

  const applyVisaMove = (app: ApplicationRecord, newStatus: VisaStageStatus) => {
    if (!app.visaApplication) return;
    const date = today();
    const updated: VisaApplication = { ...app.visaApplication, status: newStatus, statusUpdatedAt: date };
    if (newStatus === 'Visa Applied') updated.appliedDate = date;
    if (newStatus === 'Visa Approved' || newStatus === 'Visa Refused') updated.outcomeDate = date;
    onUpdateApplication(app.id, { visaApplication: updated });
    showToastMessage(`${app.name} moved to ${newStatus}`);
  };

  const handleVisaMove = (app: ApplicationRecord, newStatus: VisaStageStatus) => {
    if (!app.visaApplication || newStatus === app.visaApplication.status) return;
    if (newStatus === 'File Ready for Visa' && !isChecklistComplete(app.visaApplication)) return;
    if (VISA_TERMINAL.includes(newStatus)) setPendingVisaMove({ app, newStatus });
    else applyVisaMove(app, newStatus);
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="inline-flex bg-grey-bg border border-grey-border rounded-lg p-1">
        {(['offer', 'visa'] as BoardTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-white text-navy' : 'text-gray-500 hover:text-navy'}`}
          >
            {t === 'offer' ? 'Offer Applications' : 'Visa Applications'}
          </button>
        ))}
      </div>

      {tab === 'offer' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {OFFER_COLUMNS.map((col) => {
            const colCards = activeOfferCards.filter((c) => c.offerApp.status === col.status);
            return (
              <div key={col.status} className="bg-grey-bg rounded-xl border border-grey-border flex flex-col min-h-[200px]">
                <div className="px-4 py-3 border-b border-grey-border flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                  <h3 className={`text-sm font-semibold ${col.headerColor}`}>{col.label}</h3>
                  <span className="ml-auto text-xs font-medium text-gray-400 bg-white px-2 py-0.5 rounded-full">{colCards.length}</span>
                </div>
                <div className="p-3 space-y-2.5 flex-1">
                  {colCards.map((card) => {
                    const cardKey = `${card.app.id}-${card.offerApp.id}`;
                    return (
                      <div key={cardKey} className="bg-white rounded-lg border border-grey-border p-3.5 group">
                        <div className="min-w-0 mb-2">
                          <p className="text-sm font-semibold text-navy truncate">{card.app.name}</p>
                          <p className="text-xs text-gray-400 truncate">{card.offerApp.institution}</p>
                        </div>
                        <p className="text-xs text-gray-500 mb-3">Counselor: {card.app.counselor}</p>
                        <div className="border-t border-grey-border pt-2.5">
                          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Move to</p>
                          <div className="space-y-1">
                            {OFFER_COLUMNS.map((target) => {
                              const current = target.status === card.offerApp.status;
                              return (
                                <button
                                  key={target.status}
                                  onClick={() => handleOfferMove(card, target.status)}
                                  disabled={current}
                                  className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs font-medium transition-colors ${
                                    current
                                      ? 'cursor-not-allowed border-grey-border bg-grey-bg text-gray-400'
                                      : 'border-grey-border text-navy hover:border-navy-light hover:bg-navy/5'
                                  }`}
                                >
                                  <span className={`h-2 w-2 flex-shrink-0 rounded-full ${target.dotColor}`} />
                                  <span className="truncate">{target.label}</span>
                                  {current && <span className="ml-auto flex-shrink-0 text-[11px]">Current</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                  {colCards.length === 0 && <div className="py-8 text-center text-xs text-gray-400">No clients</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'visa' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {VISA_COLUMNS.map((col) => {
            const colApps = visaCards.filter((a) => a.visaApplication?.status === col.status);
            return (
              <div key={col.status} className="bg-grey-bg rounded-xl border border-grey-border flex flex-col min-h-[200px]">
                <div className="px-4 py-3 border-b border-grey-border flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                  <h3 className={`text-sm font-semibold ${col.headerColor}`}>{col.label}</h3>
                  <span className="ml-auto text-xs font-medium text-gray-400 bg-white px-2 py-0.5 rounded-full">{colApps.length}</span>
                </div>
                <div className="p-3 space-y-2.5 flex-1">
                  {colApps.map((app) => {
                    const checklistDone = app.visaApplication ? isChecklistComplete(app.visaApplication) : false;
                    return (
                      <div key={app.id} className="bg-white rounded-lg border border-grey-border p-3.5 group">
                        <div className="min-w-0 mb-2">
                          <p className="text-sm font-semibold text-navy truncate">{app.name}</p>
                          <p className="text-xs text-gray-400 truncate">{app.purpose} — {app.country}</p>
                        </div>
                        <p className="text-xs text-gray-500 mb-3">Counselor: {app.counselor}</p>
                        <div className="border-t border-grey-border pt-2.5">
                          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Move to</p>
                          <div className="space-y-1">
                            {VISA_COLUMNS.map((target) => {
                              const blocked = target.status === 'File Ready for Visa' && !checklistDone;
                              const current = target.status === app.visaApplication?.status;
                              const disabled = current || blocked;
                              return (
                                <button
                                  key={target.status}
                                  onClick={() => handleVisaMove(app, target.status)}
                                  disabled={disabled}
                                  title={blocked ? 'Complete every checklist document first' : undefined}
                                  className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs font-medium transition-colors ${
                                    disabled
                                      ? 'cursor-not-allowed border-grey-border bg-grey-bg text-gray-400'
                                      : 'border-grey-border text-navy hover:border-navy-light hover:bg-navy/5'
                                  }`}
                                >
                                  <span className={`h-2 w-2 flex-shrink-0 rounded-full ${target.dotColor}`} />
                                  <span className="truncate">{target.label}</span>
                                  {current && <span className="ml-auto flex-shrink-0 text-[11px]">Current</span>}
                                  {blocked && !current && <span className="ml-auto flex-shrink-0 text-[11px]">Locked</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                  {colApps.length === 0 && <div className="py-8 text-center text-xs text-gray-400">No clients</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Terminal status confirmation dialogs */}
      {pendingOfferMove && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-dark/60" onClick={() => setPendingOfferMove(null)} />
          <div className="relative bg-white rounded-2xl border border-grey-border max-w-sm w-full p-6">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 ${pendingOfferMove.newStatus === 'Offer Received' ? 'bg-green-50' : 'bg-red-50'}`}>
              <AlertTriangle className={pendingOfferMove.newStatus === 'Offer Received' ? 'text-green-600' : 'text-red-600'} size={26} />
            </div>
            <h3 className="text-base font-semibold text-navy text-center mb-2">
              Move {pendingOfferMove.card.app.name} to {pendingOfferMove.newStatus}?
            </h3>
            <p className="text-sm text-gray-500 text-center mb-6">This outcome stays in the client's offer history either way.</p>
            <div className="flex gap-3">
              <button onClick={() => setPendingOfferMove(null)} className="flex-1 py-2.5 border border-grey-border rounded-lg text-sm font-medium text-navy hover:bg-grey-bg transition-colors">Cancel</button>
              <button
                onClick={() => { applyOfferMove(pendingOfferMove.card, pendingOfferMove.newStatus); setPendingOfferMove(null); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors ${pendingOfferMove.newStatus === 'Offer Received' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingVisaMove && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-dark/60" onClick={() => setPendingVisaMove(null)} />
          <div className="relative bg-white rounded-2xl border border-grey-border max-w-sm w-full p-6">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 ${pendingVisaMove.newStatus === 'Visa Approved' ? 'bg-green-50' : 'bg-red-50'}`}>
              <AlertTriangle className={pendingVisaMove.newStatus === 'Visa Approved' ? 'text-green-600' : 'text-red-600'} size={26} />
            </div>
            <h3 className="text-base font-semibold text-navy text-center mb-2">
              Move {pendingVisaMove.app.name} to {pendingVisaMove.newStatus}?
            </h3>
            <p className="text-sm text-gray-500 text-center mb-6">This is usually a final outcome and cannot be easily reversed.</p>
            <div className="flex gap-3">
              <button onClick={() => setPendingVisaMove(null)} className="flex-1 py-2.5 border border-grey-border rounded-lg text-sm font-medium text-navy hover:bg-grey-bg transition-colors">Cancel</button>
              <button
                onClick={() => { applyVisaMove(pendingVisaMove.app, pendingVisaMove.newStatus); setPendingVisaMove(null); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors ${pendingVisaMove.newStatus === 'Visa Approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success toast */}
      {showToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-green-600 text-white px-5 py-3 rounded-xl flex items-center gap-2 text-sm font-medium animate-fade-in">
          <CheckCircle size={18} />
          {toastMessage}
        </div>
      )}
    </div>
  );
}
