import { useState, useMemo, useEffect } from 'react';
import Login from './components/Login';
import DashboardShell from './components/DashboardShell';
import { CurrentUserContext } from './currentUser';
import OverviewPage from './components/OverviewPage';
import BranchManagerOverview from './components/BranchManagerOverview';
import SuperAdminOverview from './components/SuperAdminOverview';
import ReceptionistOverview from './components/ReceptionistOverview';
import CounselorOverview from './components/CounselorOverview';
import ApplicationOfficerOverview from './components/ApplicationOfficerOverview';
import AllBranches from './components/AllBranches';
import PartnersPage from './components/PartnersPage';
import CommissionsPage from './components/CommissionsPage';
import ComingSoon from './components/ComingSoon';
import NewIntakeForm, { IntakeFormData } from './components/NewIntakeForm';
import StudentList from './components/StudentList';
import AssignCounselorPage from './components/AssignCounselorPage';
import AssignedClientsPage from './components/AssignedClientsPage';
import VisitorsPage from './components/VisitorsPage';
import EnrolledQueuePage from './components/EnrolledQueuePage';
import CounselorClientsPage from './components/CounselorClientsPage';
import ConsultationsPage from './components/ConsultationsPage';
import ApplicationsList from './components/ApplicationsList';
import StaffManagement from './components/StaffManagement';
import ArchivePage from './components/ArchivePage';
import FollowUpsPage from './components/FollowUpsPage';
import ReportsPage from './components/ReportsPage';
import MarketingOverview from './components/MarketingOverview';
import MarketingBroadcastPage from './components/MarketingBroadcastPage';
import MarketingClientsPage from './components/MarketingClientsPage';
import { MockUser, IntakeStudent, CounselorStudent, ApplicationRecord, OfferApplication, StaffMember, Branch, CommissionRecord, Partner, AppNotification, Counselor } from './types';
import { isStudyCase, getClientStatusLabel } from './clientPipeline';
import { clientIdFor, generateClientId } from './clientId';
import { NAV_CONFIG } from './mockData';
import { createIntakeNotification, createAssignmentNotification, createConsultationReadyNotification, createBranchManagerNotification, createLeadBroadcastNotification, createStatusUpdateNotification } from './notifications';
import { formatSubmittedAt } from './dateTime';
import { fetchNotifications, insertNotification, markNotificationRead, markNotificationsRead, fromRow as notificationFromRow, NotificationRow } from './lib/notificationsApi';
import { fetchCounselorStudents, updateCounselorStudent, upsertCounselorStudent, fromRow as counselorStudentFromRow, CounselorStudentRow } from './lib/counselorStudentsApi';
import { fetchStudents, insertStudent, updateStudent, fromRow as studentFromRow, StudentRow } from './lib/studentsApi';
import { isMarketingLead } from './marketing';
import { fetchCounselors, insertCounselor, deleteCounselor, fromRow as counselorFromRow, CounselorRow } from './lib/counselorsApi';
import { fetchApplications, updateApplication, insertApplication, fromRow as applicationFromRow, ApplicationRow } from './lib/applicationsApi';
import { fetchStaff, insertStaff, updateStaff, deleteStaff, fromRow as staffFromRow, StaffRow } from './lib/staffApi';
import { fetchBranches, insertBranch, updateBranch, deleteBranch, fromRow as branchFromRow, BranchRow } from './lib/branchesApi';
import { fetchCommissions, updateCommission, fromRow as commissionFromRow, CommissionRow } from './lib/commissionsApi';
import { fetchPartners, insertPartner, updatePartner, deletePartner, fromRow as partnerFromRow, PartnerRow } from './lib/partnersApi';
import { subscribeToTable, applyRealtimeChange } from './lib/realtimeSubscribe';

export default function App() {
  const isIntakeForm = window.location.pathname === '/intake';

  const [user, setUser] = useState<MockUser | null>(null);
  const [activeKey, setActiveKey] = useState<string>('overview');
  // Bumped on every sidebar click so the page remounts — this closes any open client
  // profile instead of leaving it on top of the newly selected page.
  const [navSeq, setNavSeq] = useState(0);
  const [lastLoginAt, setLastLoginAt] = useState<Date | null>(null);
  const [students, setStudents] = useState<IntakeStudent[]>([]);
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [counselorStudents, setCounselorStudents] = useState<CounselorStudent[]>([]);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [commissions, setCommissions] = useState<CommissionRecord[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Each table loads in full once on mount, then stays in sync via realtime — but instead of
  // refetching the whole table on every INSERT/UPDATE/DELETE (which used to mean one staff
  // member's status update made every other open tab re-download the entire table), each
  // change is applied to the local list in place via applyRealtimeChange. The `sortBy` passed
  // to each call re-applies the same ordering the initial fetch's `.order(...)` used, so lists
  // don't drift out of order as changes come in from other staff.
  useEffect(() => {
    fetchCounselorStudents()
      .then(setCounselorStudents)
      .catch((err) => console.error('Failed to fetch counselor_students from Supabase', err));
    return subscribeToTable<CounselorStudentRow>('counselor_students', (change) => {
      setCounselorStudents((prev) => applyRealtimeChange(prev, change, counselorStudentFromRow,
        (a, b) => (a.assignedDate < b.assignedDate ? -1 : a.assignedDate > b.assignedDate ? 1 : 0)));
    });
  }, []);

  useEffect(() => {
    fetchStudents()
      .then(setStudents)
      .catch((err) => console.error('Failed to fetch students from Supabase', err));
    return subscribeToTable<StudentRow>('students', (change) => {
      setStudents((prev) => applyRealtimeChange(prev, change, studentFromRow,
        (a, b) => (a.submittedAt < b.submittedAt ? 1 : a.submittedAt > b.submittedAt ? -1 : 0)));
    });
  }, []);

  useEffect(() => {
    fetchCounselors()
      .then(setCounselors)
      .catch((err) => console.error('Failed to fetch counselors from Supabase', err));
    return subscribeToTable<CounselorRow>('counselors', (change) => {
      setCounselors((prev) => applyRealtimeChange(prev, change, counselorFromRow,
        (a, b) => a.name.localeCompare(b.name)));
    });
  }, []);

  useEffect(() => {
    fetchApplications()
      .then(setApplications)
      .catch((err) => console.error('Failed to fetch applications from Supabase', err));
    return subscribeToTable<ApplicationRow>('applications', (change) => {
      setApplications((prev) => applyRealtimeChange(prev, change, applicationFromRow,
        (a, b) => (a.consultationDate < b.consultationDate ? 1 : a.consultationDate > b.consultationDate ? -1 : 0)));
    });
  }, []);

  useEffect(() => {
    fetchStaff()
      .then(setStaff)
      .catch((err) => console.error('Failed to fetch staff from Supabase', err));
    return subscribeToTable<StaffRow>('staff', (change) => {
      setStaff((prev) => applyRealtimeChange(prev, change, staffFromRow,
        (a, b) => a.name.localeCompare(b.name)));
    });
  }, []);

  useEffect(() => {
    fetchBranches()
      .then(setBranches)
      .catch((err) => console.error('Failed to fetch branches from Supabase', err));
    return subscribeToTable<BranchRow>('branches', (change) => {
      setBranches((prev) => applyRealtimeChange(prev, change, branchFromRow,
        (a, b) => a.name.localeCompare(b.name)));
    });
  }, []);

  useEffect(() => {
    fetchNotifications()
      .then(setNotifications)
      .catch((err) => console.error('Failed to fetch notifications from Supabase', err));
    return subscribeToTable<NotificationRow>('notifications', (change) => {
      setNotifications((prev) => applyRealtimeChange(prev, change, notificationFromRow,
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    });
  }, []);

  useEffect(() => {
    fetchCommissions()
      .then(setCommissions)
      .catch((err) => console.error('Failed to fetch commissions from Supabase', err));
    return subscribeToTable<CommissionRow>('commissions', (change) => {
      setCommissions((prev) => applyRealtimeChange(prev, change, commissionFromRow,
        (a, b) => a.studentName.localeCompare(b.studentName)));
    });
  }, []);

  useEffect(() => {
    fetchPartners()
      .then(setPartners)
      .catch((err) => console.error('Failed to fetch partners from Supabase', err));
    return subscribeToTable<PartnerRow>('partners', (change) => {
      setPartners((prev) => applyRealtimeChange(prev, change, partnerFromRow,
        (a, b) => a.name.localeCompare(b.name)));
    });
  }, []);

  const handleLogin = (mockUser: MockUser) => {
    setUser(mockUser);
    setActiveKey('overview');
    // Remember the previous sign-in so dashboards can flag what's new since then.
    const storageKey = `csc:lastLogin:${mockUser.email}`;
    try {
      const previous = window.localStorage.getItem(storageKey);
      setLastLoginAt(previous ? new Date(previous) : null);
      window.localStorage.setItem(storageKey, new Date().toISOString());
    } catch {
      setLastLoginAt(null);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setActiveKey('overview');
  };

  const handleNavigate = (key: string) => {
    setActiveKey(key);
    setNavSeq((seq) => seq + 1);
  };

  const handleAddStudent = (data: IntakeFormData) => {
    // A counselor adding their own client (Counselor's "Add Client") is already that
    // client's counselor — self-assign immediately instead of dropping them into the
    // unassigned pool, where a Receptionist/Branch Manager could hand them to someone else.
    const isCounselorAdding = user?.role === 'counselor';
    const stamp = formatSubmittedAt(new Date());
    const newStudent: IntakeStudent = {
      id: `s${Date.now()}`,
      ...data,
      submittedAt: stamp,
      addedBy: user?.name ?? 'Online Intake',
      visitDateTime: stamp,
      status: isCounselorAdding ? 'Assigned' : 'New',
      assignedCounselor: isCounselorAdding ? user!.name : null,
      branch: user?.branch ?? '',
    };
    setStudents((prev) => [newStudent, ...prev]);
    insertStudent(newStudent).catch((err) => console.error('Failed to insert student in Supabase', err));

    if (isCounselorAdding && user) {
      const newCounselorStudent: CounselorStudent = {
        id: newStudent.id,
        clientId: generateClientId(),
        name: newStudent.name,
        phone: newStudent.phone,
        email: newStudent.email,
        country: newStudent.country,
        purpose: newStudent.purpose,
        dob: newStudent.dob,
        gender: newStudent.gender,
        maritalStatus: newStudent.maritalStatus,
        academicQualification: newStudent.academicQualification,
        ieltsPte: newStudent.ieltsPte,
        workExperience: newStudent.workExperience,
        submittedAt: newStudent.submittedAt,
        addedBy: newStudent.addedBy,
        visitDateTime: newStudent.visitDateTime,
        assignedDate: new Date().toISOString().slice(0, 10),
        assignedCounselor: user.name,
        consultationStatus: 'Awaiting Consultation',
        consultationNotes: '',
        followUpDate: null,
        completedDate: null,
        outcome: 'Pending',
      };
      setCounselorStudents((prev) => [newCounselorStudent, ...prev]);
      upsertCounselorStudent(newCounselorStudent).catch((err) =>
        console.error('Failed to upsert counselor_students in Supabase', err)
      );
      return;
    }

    const notification = createIntakeNotification(newStudent.name, newStudent.country, newStudent.purpose, newStudent.branch);
    const managerNotification = createBranchManagerNotification(
      'new-intake', newStudent.name, 'New lead from ', ` — ${newStudent.country}, ${newStudent.purpose}`, newStudent.branch, 'students'
    );
    setNotifications((prev) => [managerNotification, notification, ...prev]);
    insertNotification(notification).catch((err) => console.error('Failed to insert notification in Supabase', err));
    insertNotification(managerNotification).catch((err) => console.error('Failed to insert notification in Supabase', err));
  };

  /** Marketing logs a campaign lead — it stays branch-less until it's broadcast and claimed. */
  const handleAddMarketingLead = (data: IntakeFormData) => {
    const stamp = formatSubmittedAt(new Date());
    const newLead: IntakeStudent = {
      id: `ml${Date.now()}`,
      ...data,
      referredThrough: 'Marketing',
      platformSource: data.platformSource || 'Others',
      submittedAt: stamp,
      addedBy: user?.name ?? 'Marketing',
      visitDateTime: stamp,
      status: 'New',
      assignedCounselor: null,
      broadcastBranch: null,
      claimedBy: null,
      branch: '',
    };
    setStudents((prev) => [newLead, ...prev]);
    insertStudent(newLead).catch((err) => console.error('Failed to insert student in Supabase', err));
  };

  /** Broadcast a raw marketing lead to a branch group — blind for every counselor there. */
  const handleBroadcastLead = (leadId: string, branch: string) => {
    const stamp = formatSubmittedAt(new Date());
    setStudents((prev) =>
      prev.map((s) => (s.id === leadId ? { ...s, broadcastBranch: branch, broadcastAt: stamp } : s))
    );
    updateStudent(leadId, { branch }).catch((err) => console.error('Failed to update student in Supabase', err));
    const lead = students.find((s) => s.id === leadId);
    if (lead) {
      const notification = createLeadBroadcastNotification(lead.id, lead.country, lead.purpose, branch);
      setNotifications((prev) => [notification, ...prev]);
      insertNotification(notification).catch((err) => console.error('Failed to insert notification in Supabase', err));
    }
  };

  /** First counselor to accept a broadcast lead claims it and unlocks the contact details. */
  const handleAcceptLead = (leadId: string) => {
    const lead = students.find((s) => s.id === leadId);
    if (!lead || lead.claimedBy || !user) return;
    const stamp = formatSubmittedAt(new Date());
    setStudents((prev) =>
      prev.map((s) =>
        s.id === leadId
          ? { ...s, claimedBy: user.name, claimedAt: stamp, branch: s.broadcastBranch || s.branch }
          : s
      )
    );
    handleAssign(leadId, user.name);
  };

  const handleAssign = (studentId: string, counselorName: string) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId
          ? { ...s, status: 'Assigned', assignedCounselor: counselorName }
          : s
      )
    );
    updateStudent(studentId, { status: 'Assigned', assignedCounselor: counselorName }).catch((err) =>
      console.error('Failed to update student in Supabase', err)
    );
    const student = students.find((s) => s.id === studentId);
    if (student) {
      const notification = createAssignmentNotification(student.name, student.country, student.purpose, counselorName);
      const managerNotification = createBranchManagerNotification(
        'assigned-to-counselor', student.name, '', ` assigned to ${counselorName} — ${student.country}, ${student.purpose}`, student.branch, 'students'
      );
      setNotifications((prev) => [managerNotification, notification, ...prev]);
      insertNotification(notification).catch((err) => console.error('Failed to insert notification in Supabase', err));
      insertNotification(managerNotification).catch((err) => console.error('Failed to insert notification in Supabase', err));

      const existingCs = counselorStudents.find((cs) => cs.id === student.id);
      const newCounselorStudent: CounselorStudent = existingCs
        ? { ...existingCs, assignedCounselor: counselorName, assignedDate: new Date().toISOString().slice(0, 10) }
        : {
            id: student.id,
            clientId: generateClientId(),
            name: student.name,
            phone: student.phone,
            email: student.email,
            country: student.country,
            purpose: student.purpose,
            dob: student.dob,
            gender: student.gender,
            maritalStatus: student.maritalStatus,
            academicQualification: student.academicQualification,
            ieltsPte: student.ieltsPte,
            workExperience: student.workExperience,
            submittedAt: student.submittedAt,
            addedBy: student.addedBy,
            platformSource: student.platformSource,
            visitDateTime: student.visitDateTime ?? formatSubmittedAt(new Date()),
            assignedDate: new Date().toISOString().slice(0, 10),
            assignedCounselor: counselorName,
            consultationStatus: 'Awaiting Consultation',
            consultationNotes: '',
            followUpDate: null,
            completedDate: null,
            outcome: 'Pending',
          };
      setCounselorStudents((prev) =>
        prev.some((cs) => cs.id === newCounselorStudent.id)
          ? prev.map((cs) => (cs.id === newCounselorStudent.id ? newCounselorStudent : cs))
          : [newCounselorStudent, ...prev]
      );
      upsertCounselorStudent(newCounselorStudent).catch((err) =>
        console.error('Failed to upsert counselor_students in Supabase', err)
      );

      // activeAssignments is now derived live from counselor_students — no DB write needed.
    }
  };

  /** Front desk logs a returning client's visit — stamped on whichever record(s) exist. */
  const handleLogRevisit = (clientId: string) => {
    const stamp = formatSubmittedAt(new Date());

    const student = students.find((s) => s.id === clientId);
    if (student) {
      // Push the visit being replaced onto history first, so logging a new visit never
      // erases the only record of when the client was last seen.
      const previousVisit = student.revisitedAt ?? student.visitDateTime ?? student.submittedAt;
      const updates = { revisitedAt: stamp, visitHistory: [...(student.visitHistory ?? []), previousVisit] };
      setStudents((prev) => prev.map((s) => (s.id === clientId ? { ...s, ...updates } : s)));
      updateStudent(clientId, updates).catch((err) => console.error('Failed to update student in Supabase', err));
    }

    const counselorStudent = counselorStudents.find((c) => c.id === clientId);
    if (counselorStudent) {
      const previousVisit = counselorStudent.revisitedAt ?? counselorStudent.visitDateTime ?? counselorStudent.submittedAt;
      const updates = { revisitedAt: stamp, visitHistory: [...(counselorStudent.visitHistory ?? []), previousVisit] };
      setCounselorStudents((prev) => prev.map((c) => (c.id === clientId ? { ...c, ...updates } : c)));
      updateCounselorStudent(clientId, updates).catch((err) => console.error('Failed to update counselor_students in Supabase', err));
    }
  };

  const handleUpdateCounselorStudent = (id: string, updates: Partial<CounselorStudent>) => {
    setCounselorStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
    updateCounselorStudent(id, updates).catch((err) =>
      console.error('Failed to update counselor_students in Supabase', err)
    );
    if (updates.outcome === 'Proceeding') {
      const student = counselorStudents.find((s) => s.id === id);
      if (student) {
        const notification = createConsultationReadyNotification(student.name, user?.branch ?? '');
        const managerNotification = createBranchManagerNotification(
          'consultation-ready', student.name, '', ' ready for application — consultation complete', user?.branch ?? '', 'applications'
        );
        setNotifications((prev) => [managerNotification, notification, ...prev]);
        insertNotification(notification).catch((err) => console.error('Failed to insert notification in Supabase', err));
        insertNotification(managerNotification).catch((err) => console.error('Failed to insert notification in Supabase', err));

        const now = new Date();
        const date = now.toISOString().slice(0, 10);
        // Each university the counselor entered becomes its own offer application, so a
        // client applying to three colleges shows as three rows on the Offer queue.
        const enrolments = updates.enrolments ?? student.enrolments ?? [];
        const offerApplications: OfferApplication[] = isStudyCase(student.purpose)
          ? enrolments.map((e, i) => ({
              id: `o${Date.now()}${i}`,
              institution: e.institution,
              course: e.program,
              intake: e.intake,
              status: 'Enrolled' as const,
              statusUpdatedAt: date,
              enrolledDate: date,
            }))
          : [];
        const newApplication: ApplicationRecord = {
          id: `a${Date.now()}`,
          clientId: student.clientId ?? clientIdFor(student),
          name: student.name,
          phone: student.phone,
          email: student.email,
          country: student.country,
          purpose: student.purpose,
          dob: student.dob,
          gender: student.gender,
          maritalStatus: student.maritalStatus,
          academicQualification: student.academicQualification,
          ieltsPte: student.ieltsPte,
          workExperience: student.workExperience,
          counselor: student.assignedCounselor,
          consultationDate: student.completedDate ?? now.toISOString().slice(0, 10),
          addedBy: student.addedBy,
          visitDateTime: student.visitDateTime ?? student.submittedAt,
          consultationNotes: student.consultationNotes,
          branch: user?.branch ?? '',
          offerApplications,
          visaApplication: null,
          withdrawn: false,
          notes: [],
        };
        setApplications((prev) => [newApplication, ...prev]);
        insertApplication(newApplication).catch((err) => console.error('Failed to insert application in Supabase', err));
      }
    }
  };

  const handleMarkNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    markNotificationRead(id).catch((err) => console.error('Failed to mark notification read in Supabase', err));
  };

  const handleMarkAllNotificationsRead = (ids: string[]) => {
    setNotifications((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    markNotificationsRead(ids).catch((err) => console.error('Failed to mark notifications read in Supabase', err));
  };

  const handleUpdateApplication = (id: string, updates: Partial<ApplicationRecord>) => {
    setApplications((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
    );
    updateApplication(id, updates).catch((err) =>
      console.error('Failed to update application in Supabase', err)
    );

    // Surface offer/visa status tracker moves to the branch manager's Today's Activity —
    // compare the unified status label before and after rather than diffing individual
    // fields, so unrelated edits (notes, checklist ticks, deferred intake) stay silent.
    const prevApp = applications.find((a) => a.id === id);
    if (prevApp) {
      const prevLabel = getClientStatusLabel(prevApp);
      const nextLabel = getClientStatusLabel({ ...prevApp, ...updates });
      if (nextLabel !== prevLabel) {
        const notification = createStatusUpdateNotification(prevApp.name, nextLabel, prevApp.branch);
        setNotifications((prev) => [notification, ...prev]);
        insertNotification(notification).catch((err) => console.error('Failed to insert notification in Supabase', err));
      }
    }
  };

  const handleAddStaff = (member: StaffMember, counselorCountries?: string[]) => {
    setStaff((prev) => [...prev, member]);
    insertStaff(member).catch((err) => console.error('Failed to insert staff in Supabase', err));
    if (member.role === 'Branch Manager') {
      setBranches((prev) =>
        prev.map((b) => (b.name === member.branch ? { ...b, manager: member.name } : b))
      );
      const target = branches.find((b) => b.name === member.branch);
      if (target) {
        updateBranch(target.id, { manager: member.name }).catch((err) =>
          console.error('Failed to update branch manager in Supabase', err)
        );
      }
    }
    if (member.role === 'Counselor') {
      const newCounselor: Counselor = {
        id: `c${Date.now()}`,
        name: member.name,
        countries: counselorCountries ?? [],
        activeAssignments: 0,
        availability: 'Available',
      };
      setCounselors((prev) => [...prev, newCounselor]);
      insertCounselor(newCounselor).catch((err) => console.error('Failed to insert counselor in Supabase', err));
    }
  };

  const handleUpdateStaff = (id: string, updates: Partial<StaffMember>) => {
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    updateStaff(id, updates).catch((err) => console.error('Failed to update staff in Supabase', err));
  };

  const handleRemoveStaff = (id: string) => {
    const target = staff.find((s) => s.id === id);
    setStaff((prev) => prev.filter((s) => s.id !== id));
    deleteStaff(id).catch((err) => console.error('Failed to delete staff in Supabase', err));
    if (target?.role === 'Branch Manager') {
      setBranches((prev) =>
        prev.map((b) => (b.manager === target.name ? { ...b, manager: null } : b))
      );
      const targetBranch = branches.find((b) => b.manager === target.name);
      if (targetBranch) {
        updateBranch(targetBranch.id, { manager: null }).catch((err) =>
          console.error('Failed to update branch manager in Supabase', err)
        );
      }
    }
    if (target?.role === 'Counselor') {
      const targetCounselor = counselors.find((c) => c.name === target.name);
      setCounselors((prev) => prev.filter((c) => c.name !== target.name));
      if (targetCounselor) {
        deleteCounselor(targetCounselor.id).catch((err) =>
          console.error('Failed to delete counselor in Supabase', err)
        );
      }
    }
  };

  const handleAddBranch = (branch: Branch) => {
    setBranches((prev) => [...prev, branch]);
    insertBranch(branch).catch((err) => console.error('Failed to insert branch in Supabase', err));
  };

  const handleDeleteBranch = (id: string) => {
    setBranches((prev) => prev.filter((b) => b.id !== id));
    deleteBranch(id).catch((err) => console.error('Failed to delete branch in Supabase', err));
  };

  const handleAddPartner = (partner: Partner) => {
    setPartners((prev) => [...prev, partner]);
    insertPartner(partner).catch((err) => console.error('Failed to insert partner in Supabase', err));
  };

  const handleUpdatePartner = (id: string, updates: Partial<Partner>) => {
    setPartners((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    updatePartner(id, updates).catch((err) => console.error('Failed to update partner in Supabase', err));
  };

  const handleDeletePartner = (id: string) => {
    setPartners((prev) => prev.filter((p) => p.id !== id));
    deletePartner(id).catch((err) => console.error('Failed to delete partner in Supabase', err));
  };

  const handleUpdateCommission = (id: string, updates: Partial<CommissionRecord>) => {
    setCommissions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
    updateCommission(id, updates).catch((err) => console.error('Failed to update commission in Supabase', err));
  };

  const branchNames = useMemo(() => branches.map((b) => b.name), [branches]);

  // Branch Manager's Staff page is scoped to their own branch and to branch-level roles —
  // company-wide roles (Super Admin/Marketing/Finance) never belong to a single branch, so
  // they're excluded even in the unlikely case their `branch` value collides with this one.
  const branchStaff = useMemo(() => {
    if (!user || user.role !== 'branch_manager') return staff;
    return staff.filter(
      (s) => s.branch === user.branch && s.role !== 'Super Admin' && s.role !== 'Marketing' && s.role !== 'Finance'
    );
  }, [staff, user]);

  // Every non-Super-Admin role's Students/Applications/Assign Counselor pages are scoped to
  // their own branch — StudentList and ApplicationsList only render a branch filter dropdown
  // for Super Admin (showBranchFilter), so without pre-filtering here a Branch Manager,
  // Front Desk Officer or V/A Officer would see every branch's data.
  const branchStudents = useMemo(() => {
    if (!user || user.role === 'super_admin') return students;
    return students.filter((s) => s.branch === user.branch);
  }, [students, user]);

  const branchApplications = useMemo(() => {
    if (!user || user.role === 'super_admin') return applications;
    return applications.filter((a) => a.branch === user.branch);
  }, [applications, user]);

  // A counselor reaching the Offer/Visa Applications queues only ever sees their own
  // assigned clients, still within their own branch.
  const stageScopedApplications = useMemo(() => {
    if (!user || user.role !== 'counselor') return branchApplications;
    return branchApplications.filter((a) => a.counselor === user.name);
  }, [branchApplications, user]);

  // Recompute activeAssignments live from counselor_students so the count always reflects
  // real data rather than the stale integer stored in the counselors table.
  const counselorsWithLiveCounts = useMemo(() => {
    return counselors.map((c) => ({
      ...c,
      activeAssignments: counselorStudents.filter(
        (s) => s.assignedCounselor === c.name && s.consultationStatus !== 'Consultation Complete'
      ).length,
    }));
  }, [counselors, counselorStudents]);

  // Counselor rows carry no `branch` of their own — resolved via their staff record
  // (matched by name), same technique used in computeBranchOverviewStats.
  const branchCounselors = useMemo(() => {
    if (!user || user.role === 'super_admin') return counselorsWithLiveCounts;
    const counselorBranchByName = new Map(staff.filter((s) => s.role === 'Counselor').map((s) => [s.name, s.branch]));
    return counselorsWithLiveCounts.filter((c) => counselorBranchByName.get(c.name) === user.branch);
  }, [counselorsWithLiveCounts, staff, user]);

  // Same branch resolution as branchCounselors, applied to counselor_students rows —
  // used wherever a branch-scoped role (Receptionist, Branch Manager) needs the raw list of
  // assigned clients rather than just aggregate counts, so no other branch's clients leak in.
  const branchCounselorStudents = useMemo(() => {
    if (!user || user.role === 'super_admin') return counselorStudents;
    const counselorBranchByName = new Map(staff.filter((s) => s.role === 'Counselor').map((s) => [s.name, s.branch]));
    return counselorStudents.filter((cs) => counselorBranchByName.get(cs.assignedCounselor) === user.branch);
  }, [counselorStudents, staff, user]);


  const upcomingConsultations = useMemo(() => {
    const pending = counselorStudents.filter((s) => s.consultationStatus !== 'Consultation Complete');
    if (user?.role === 'counselor') {
      return pending.filter((s) => s.assignedCounselor === user.name);
    }
    return pending;
  }, [counselorStudents, user]);

  // A counselor's Assigned Clients/Enrolled/Archive pages are scoped to their own clients —
  // without this, App.tsx would hand every counselor's full counselor_students list down.
  const myCounselorStudents = useMemo(() => {
    if (!user || user.role !== 'counselor') return counselorStudents;
    return counselorStudents.filter((s) => s.assignedCounselor === user.name);
  }, [counselorStudents, user]);

  // Marketing works across every branch, but strictly with leads its own team generated.
  const marketingLeads = useMemo(() => students.filter(isMarketingLead), [students]);

  if (isIntakeForm) {
    return <NewIntakeForm />;
  }

  if (!user) {
    return <Login staff={staff} onLogin={handleLogin} />;
  }

  const navItems = NAV_CONFIG[user.role];
  const activeItem = navItems.find((item) => item.key === activeKey);
  const isSuperAdmin = user.role === 'super_admin';

  const renderPage = () => {
    if (activeKey === 'overview') {
      if (isSuperAdmin)
        return (
          <SuperAdminOverview
            branches={branches}
            staff={staff}
            students={students}
            counselorStudents={counselorStudents}
            applications={applications}
          />
        );
      if (user.role === 'branch_manager')
        return (
          <BranchManagerOverview
            branch={user.branch}
            students={branchStudents}
            counselorStudents={branchCounselorStudents}
            applications={branchApplications}
            counselors={branchCounselors}
            staff={staff}
            notifications={notifications}
          />
        );
      if (user.role === 'receptionist')
        return (
          <ReceptionistOverview
            students={branchStudents}
            upcomingConsultations={upcomingConsultations}
            counselors={branchCounselors}
          />
        );
      if (user.role === 'counselor')
        return (
          <CounselorOverview
            counselorName={user.name}
            counselorStudents={counselorStudents}
            applications={applications}
            lastLoginAt={lastLoginAt}
          />
        );
      if (user.role === 'application_officer')
        return <ApplicationOfficerOverview branch={user.branch} applications={applications} />;
      if (user.role === 'marketing')
        return (
          <MarketingOverview
            students={marketingLeads}
            counselorStudents={counselorStudents}
            applications={applications}
          />
        );
      return <OverviewPage upcomingConsultations={upcomingConsultations} />;
    }
    if (activeKey === 'marketing-add-lead')
      return <NewIntakeForm embedded marketing onSubmit={handleAddMarketingLead} />;
    if (activeKey === 'marketing-broadcast')
      return (
        <MarketingBroadcastPage
          students={marketingLeads}
          branches={branchNames}
          onBroadcast={handleBroadcastLead}
        />
      );
    if (activeKey === 'marketing-clients')
      return (
        <MarketingClientsPage
          students={marketingLeads}
          counselorStudents={counselorStudents}
          applications={applications}
        />
      );
    if (activeKey === 'branches')
      return (
        <AllBranches
          branches={branches}
          staff={staff}
          students={students}
          applications={applications}
          onAddBranch={handleAddBranch}
          onDeleteBranch={handleDeleteBranch}
        />
      );
    if (activeKey === 'new-intake')
      return <NewIntakeForm embedded onSubmit={handleAddStudent} />;
    if (activeKey === 'students')
      return (
        <StudentList
          students={branchStudents}
          counselors={branchCounselors}
          counselorStudents={counselorStudents}
          onAssign={handleAssign}
          branches={branchNames}
          showBranchFilter={isSuperAdmin}
        />
      );
    if (activeKey === 'assign-counselor')
      return <AssignCounselorPage students={branchStudents} counselors={branchCounselors} onAssign={handleAssign} />;
    if (activeKey === 'assigned')
      return <AssignedClientsPage counselorStudents={branchCounselorStudents} />;
    if (activeKey === 'visitors')
      return <VisitorsPage students={branchStudents} counselorStudents={counselorStudents} onLogRevisit={handleLogRevisit} />;
    if (activeKey === 'partners')
      return (
        <PartnersPage
          partners={partners}
          onAddPartner={handleAddPartner}
          onUpdatePartner={handleUpdatePartner}
          onDeletePartner={handleDeletePartner}
        />
      );
    if (activeKey === 'my-students')
      return <CounselorClientsPage clients={myCounselorStudents} onUpdateClient={handleUpdateCounselorStudent} />;
    if (activeKey === 'consultations')
      return (
        <ConsultationsPage
          students={myCounselorStudents}
          applications={applications}
          partners={partners}
          currentUser={user}
          onUpdateStudent={handleUpdateCounselorStudent}
          onUpdateApplication={handleUpdateApplication}
        />
      );
    if (activeKey === 'follow-ups')
      return <FollowUpsPage students={myCounselorStudents} onUpdateStudent={handleUpdateCounselorStudent} />;
    if (activeKey === 'archive')
      return <ArchivePage students={myCounselorStudents} onUpdateStudent={handleUpdateCounselorStudent} />;
    if (activeKey === 'applications')
      return (
        <ApplicationsList
          applications={branchApplications}
          onUpdateApplication={handleUpdateApplication}
          branches={branchNames}
          showBranchFilter={isSuperAdmin}
          partners={partners}
          currentUser={user}
        />
      );
    if (activeKey === 'enrolled-queue')
      return (
        <EnrolledQueuePage
          applications={branchApplications}
          partners={partners}
          currentUser={user}
          onUpdateApplication={handleUpdateApplication}
        />
      );
    if (activeKey === 'offer-applications')
      return (
        <ApplicationsList
          applications={stageScopedApplications}
          onUpdateApplication={handleUpdateApplication}
          partners={partners}
          currentUser={user}
          stageScope="Offer"
          excludePendingOffers={user.role === 'application_officer'}
        />
      );
    if (activeKey === 'visa-applications')
      return (
        <ApplicationsList
          applications={stageScopedApplications}
          onUpdateApplication={handleUpdateApplication}
          partners={partners}
          currentUser={user}
          stageScope="Visa"
        />
      );
    if (activeKey === 'commissions')
      return (
        <CommissionsPage
          commissions={commissions}
          partners={partners}
          onUpdateCommission={handleUpdateCommission}
        />
      );
    if (activeKey === 'staff')
      return (
        <StaffManagement
          staff={branchStaff}
          onAddStaff={handleAddStaff}
          onUpdateStaff={handleUpdateStaff}
          onRemoveStaff={handleRemoveStaff}
          branches={branchNames}
          showBranchFilter={isSuperAdmin}
          currentUserEmail={user.email}
          counselorStudents={branchCounselorStudents}
          applications={branchApplications}
          showActivity={user.role === 'branch_manager'}
          partners={partners}
          currentUser={user}
          onUpdateApplication={handleUpdateApplication}
        />
      );
    if (activeKey === 'reports')
      return <ReportsPage branches={branchNames} showBranchFilter={isSuperAdmin} />;
    return <ComingSoon pageName={activeItem?.label || 'This page'} />;
  };

  return (
    <CurrentUserContext.Provider value={user}>
      <DashboardShell
        user={user}
        navItems={navItems}
        activeKey={activeKey}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        notifications={notifications}
        onMarkNotificationRead={handleMarkNotificationRead}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
        leads={students}
        onAcceptLead={handleAcceptLead}
      >
        <div key={`${activeKey}-${navSeq}`} className="dissolve-in">{renderPage()}</div>
      </DashboardShell>
    </CurrentUserContext.Provider>
  );
}
