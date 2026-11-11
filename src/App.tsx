import React, { useState, useEffect, useRef } from 'react';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  collectionGroup,
  serverTimestamp,
  deleteDoc,
} from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
import {
  UserProfile,
  AuditSession,
  AuditInteraction,
  BaselineDoc,
  BaselineSettings,
  ImprovementAction,
  AuditReportDoc,
  MeResponse,
  PDCAColumn,
} from './types';
import { ChatInterface } from './components/ChatInterface';
import { AuditCardView } from './components/AuditCardView';
import { CheckSheetTable } from './components/CheckSheetTable';
import { PDCABoard } from './components/PDCABoard';
import { BaselineManager } from './components/BaselineManager';
import { ConsolidatedReportView } from './components/ConsolidatedReportView';
import { ProfileModal } from './components/ProfileModal';
import { HistoryView } from './components/HistoryView';
import { AdminSetupBanner } from './components/AdminSetupBanner';
import {
  LayoutDashboard,
  MessageSquare,
  History,
  FileText,
  TableProperties,
  Kanban,
  FileBarChart,
  LogOut,
  UserCheck,
  ShieldCheck,
  PlusCircle,
  Menu,
  X,
  AlertCircle,
  Building2,
  Users,
  CheckCircle2,
  ListTodo,
} from 'lucide-react';

// Utility to strip all undefined values before passing to Firestore
function sanitizePayload<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_, v) => (v === undefined ? null : v))
  );
}

type InteractionWithMeta = AuditInteraction & { hasPendingWrites?: boolean };

export default function App() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [meData, setMeData] = useState<MeResponse | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sessions and Chat State
  const [userSessions, setUserSessions] = useState<AuditSession[]>([]);
  const [activeSession, setActiveSession] = useState<AuditSession | null>(null);
  const [sessionInteractions, setSessionInteractions] = useState<InteractionWithMeta[]>([]);
  const [allInteractionsMap, setAllInteractionsMap] = useState<Record<string, InteractionWithMeta[]>>({});

  // Admin Data State
  const [adminAllSessions, setAdminAllSessions] = useState<AuditSession[]>([]);
  const [baselineSettings, setBaselineSettings] = useState<BaselineSettings>({ documents: [] });
  const [improvementActions, setImprovementActions] = useState<ImprovementAction[]>([]);
  const [auditReports, setAuditReports] = useState<AuditReportDoc[]>([]);

  // Navigation & Drilldown states
  const [prefilledPdcIssue, setPrefilledPdcIssue] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Firestore listeners unsubscribe references
  const unsubsRef = useRef<(() => void)[]>([]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // 1. Auth state observer
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      // Unsubscribe all active listeners on user change
      unsubsRef.current.forEach((unsub) => unsub());
      unsubsRef.current = [];

      setCurrentUser(user);
      if (!user) {
        setMeData(null);
        setUserProfile(null);
        setUserSessions([]);
        setActiveSession(null);
        setSessionInteractions([]);
        setAdminAllSessions([]);
        setImprovementActions([]);
        setAuditReports([]);
        setAuthLoading(false);
        return;
      }

      try {
        // Fetch token and verify /api/me
        const token = await user.getIdToken();
        const meRes = await fetch('/api/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (meRes.ok) {
          const data: MeResponse = await meRes.json();
          setMeData(data);
        } else {
          console.warn('Failed to fetch /api/me:', meRes.status);
        }

        // Attach user-specific listeners
        attachUserListeners(user.uid);
      } catch (err: any) {
        console.error('Error in auth setup:', err);
        showToast('Authentication check encountered an issue.');
      } finally {
        setAuthLoading(false);
      }
    });

    return () => {
      unsubAuth();
      unsubsRef.current.forEach((unsub) => unsub());
    };
  }, []);

  // 2. Attach Firestore Listeners
  const attachUserListeners = (uid: string) => {
    // A. Profile listener
    const profileRef = doc(db, 'users', uid);
    const unsubProfile = onSnapshot(
      profileRef,
      (snap) => {
        if (snap.exists()) {
          setUserProfile(snap.data() as UserProfile);
        } else {
          setUserProfile(null);
          setIsProfileModalOpen(true); // First-time profile setup
        }
      },
      (error) => {
        console.warn('Profile listener error:', error.message);
        showToast('Could not load user profile.');
      }
    );
    unsubsRef.current.push(unsubProfile);

    // B. User sessions listener
    const sessionsCol = collection(db, 'users', uid, 'sessions');
    const unsubSessions = onSnapshot(
      sessionsCol,
      (snap) => {
        const list: AuditSession[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as AuditSession);
        });
        // Sort in code by createdAt desc
        list.sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        setUserSessions(list);
      },
      (error) => {
        console.warn('Sessions listener error:', error.message);
      }
    );
    unsubsRef.current.push(unsubSessions);

    // C. Baseline settings listener (accessible by all signed-in users)
    const baselineRef = doc(db, 'settings', 'baseline');
    const unsubBaseline = onSnapshot(
      baselineRef,
      (snap) => {
        if (snap.exists()) {
          setBaselineSettings(snap.data() as BaselineSettings);
        } else {
          setBaselineSettings({ documents: [] });
        }
      },
      (error) => {
        console.warn('Baseline listener error:', error.message);
      }
    );
    unsubsRef.current.push(unsubBaseline);
  };

  // 3. Attach Admin Listeners when isAdmin is confirmed
  useEffect(() => {
    if (!currentUser || !meData?.isAdmin) return;

    // A. Collection-group sessions listener for admin
    const cgQuery = query(collectionGroup(db, 'sessions'));
    const unsubCgSessions = onSnapshot(
      cgQuery,
      (snap) => {
        const list: AuditSession[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as AuditSession);
        });
        list.sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        setAdminAllSessions(list);
      },
      (error) => {
        console.warn('Admin collection-group sessions listener error:', error.message);
      }
    );
    unsubsRef.current.push(unsubCgSessions);

    // B. Improvement Actions listener
    const actionsCol = collection(db, 'improvementActions');
    const unsubActions = onSnapshot(
      actionsCol,
      (snap) => {
        const list: ImprovementAction[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as ImprovementAction);
        });
        setImprovementActions(list);
      },
      (error) => {
        console.warn('Improvement actions listener error:', error.message);
      }
    );
    unsubsRef.current.push(unsubActions);

    // C. Audit Reports listener
    const reportsCol = collection(db, 'auditReports');
    const unsubReports = onSnapshot(
      reportsCol,
      (snap) => {
        const list: AuditReportDoc[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as AuditReportDoc);
        });
        list.sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        setAuditReports(list);
      },
      (error) => {
        console.warn('Audit reports listener error:', error.message);
      }
    );
    unsubsRef.current.push(unsubReports);
  }, [currentUser, meData?.isAdmin]);

  // 4. Attach Interactions Listener for active session
  useEffect(() => {
    if (!currentUser || !activeSession) {
      setSessionInteractions([]);
      return;
    }

    const interactionsCol = collection(
      db,
      'users',
      currentUser.uid,
      'interactions'
    );
    const q = query(
      interactionsCol,
      where('sessionId', '==', activeSession.sessionId)
    );

    const unsubInteractions = onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snap) => {
        const list: InteractionWithMeta[] = [];
        snap.forEach((d) => {
          list.push({
            id: d.id,
            ...d.data(),
            hasPendingWrites: d.metadata.hasPendingWrites,
          } as InteractionWithMeta);
        });
        // Sort in code by timestamp
        list.sort(
          (a, b) =>
            new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
        );
        setSessionInteractions(list);

        // Also cache in allInteractionsMap
        setAllInteractionsMap((prev) => ({
          ...prev,
          [activeSession.sessionId]: list,
        }));
      },
      (error) => {
        console.warn('Interactions listener error:', error.message);
      }
    );

    return () => unsubInteractions();
  }, [currentUser, activeSession?.sessionId]);

  // Handle Google Login
  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      showToast(err.message || 'Failed to sign in with Google.');
    }
  };

  // Handle Sign Out
  const handleSignOut = async () => {
    // Unsubscribe all active listeners prior to sign out
    unsubsRef.current.forEach((unsub) => unsub());
    unsubsRef.current = [];
    await signOut(auth);
  };

  // Save profile
  const handleSaveProfile = async (profileData: UserProfile) => {
    if (!currentUser) return;
    const payload = sanitizePayload({
      ...profileData,
      displayName: currentUser.displayName || 'Faculty Member',
      photoURL: currentUser.photoURL || '',
      updatedAt: new Date().toISOString(),
    });

    await setDoc(doc(db, 'users', currentUser.uid), payload, { merge: true });
    setUserProfile(payload as UserProfile);
    setIsProfileModalOpen(false);
    showToast('Profile saved successfully.');
  };

  // Start a new Audit Session
  const handleStartInterview = async () => {
    if (!currentUser) return;
    if (!userProfile) {
      setIsProfileModalOpen(true);
      return;
    }

    const sessionId = crypto.randomUUID();
    const newSession: Omit<AuditSession, 'id'> = {
      sessionId,
      userId: currentUser.uid,
      status: 'in_progress',
      part: 1,
      profileSnapshot: userProfile,
      createdAt: new Date().toISOString(),
    };

    // Save session in browser with client SDK
    await setDoc(
      doc(db, 'users', currentUser.uid, 'sessions', sessionId),
      sanitizePayload(newSession)
    );

    setActiveSession({ id: sessionId, ...newSession });
    setActiveTab('interview');
  };

  // Send message to Audit Agent
  const handleSendMessage = async ({
    message,
    clientMessageId,
    part,
  }: {
    message: string;
    clientMessageId: string;
    part: number;
  }) => {
    if (!currentUser || !activeSession) throw new Error('No active session.');

    // 1) Fail immediately if offline
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error(
        'You appear to be offline. Your message was not sent; click Retry Save when you are back online.'
      );
    }

    const token = await currentUser.getIdToken();

    // 1. Idempotently persist user message to Firestore
    const userInteraction: AuditInteraction = {
      id: clientMessageId,
      interactionId: clientMessageId,
      sessionId: activeSession.sessionId,
      userId: currentUser.uid,
      role: 'user',
      content: message,
      clientMessageId,
      timestamp: new Date().toISOString(),
    };

    // 2) Race user-message setDoc against a 15-second timeout
    let timeoutId: any;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new Error(
            'Unable to confirm save with the server within 15 seconds. Please check your connection and click Retry Save.'
          )
        );
      }, 15000);
    });

    try {
      await Promise.race([
        setDoc(
          doc(db, 'users', currentUser.uid, 'interactions', clientMessageId),
          sanitizePayload(userInteraction)
        ),
        timeoutPromise,
      ]);
    } finally {
      clearTimeout(timeoutId);
    }

    // 2. Call server /api/chat (only reachable if write was confirmed within 15s)
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        sessionId: activeSession.sessionId,
        clientMessageId,
        message,
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const err: any = new Error(errJson.error || 'Chat request failed');
      err.status = res.status;
      err.code = errJson.code;
      throw err;
    }

    const data = await res.json();
    const assistantMsgId = crypto.randomUUID();

    // 3. Persist assistant reply
    const assistantInteraction: AuditInteraction = {
      id: assistantMsgId,
      interactionId: assistantMsgId,
      sessionId: activeSession.sessionId,
      userId: currentUser.uid,
      role: 'assistant',
      content: data.reply,
      modelUsed: data.modelUsed,
      timestamp: new Date().toISOString(),
    };

    await setDoc(
      doc(db, 'users', currentUser.uid, 'interactions', assistantMsgId),
      sanitizePayload(assistantInteraction)
    );

    // 4. Update session part (indicator only moves forward)
    const newPart = Math.max(activeSession.part || 1, data.part || 1);
    await updateDoc(
      doc(db, 'users', currentUser.uid, 'sessions', activeSession.sessionId),
      sanitizePayload({ part: newPart })
    );

    setActiveSession((prev) => (prev ? { ...prev, part: newPart } : null));

    return { reply: data.reply, part: newPart, modelUsed: data.modelUsed };
  };

  // Finish session and generate Audit Card
  const handleFinishAndAnalyze = async () => {
    if (!currentUser || !activeSession) throw new Error('No active session');

    const token = await currentUser.getIdToken();
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ sessionId: activeSession.sessionId }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Analysis generation failed');
    }

    const { auditCard } = await res.json();

    // Save auditCard to session in Firestore and mark completed
    const updates = {
      status: 'completed' as const,
      auditCard,
      completedAt: new Date().toISOString(),
    };

    await updateDoc(
      doc(db, 'users', currentUser.uid, 'sessions', activeSession.sessionId),
      sanitizePayload(updates)
    );

    setActiveSession((prev) => (prev ? { ...prev, ...updates } : null));
    showToast('Audit interview completed and Audit Card recorded.');
    return auditCard;
  };

  // Baseline Save (Admin only)
  const handleSaveBaseline = async (newDocuments: BaselineDoc[]) => {
    const payload = sanitizePayload({
      documents: newDocuments,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'settings', 'baseline'), payload);
    showToast('Department quality baseline saved successfully.');
  };

  // PDCA Board actions (Admin only)
  const handleAddPdcAction = async (
    action: Omit<ImprovementAction, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    const id = crypto.randomUUID();
    const payload = sanitizePayload({
      ...action,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'improvementActions', id), payload);
    showToast('Improvement action recorded on PDCA Board.');
  };

  const handleMovePdcAction = async (id: string, newColumn: PDCAColumn) => {
    await updateDoc(
      doc(db, 'improvementActions', id),
      sanitizePayload({
        column: newColumn,
        updatedAt: new Date().toISOString(),
      })
    );
  };

  const handleDeletePdcAction = async (id: string) => {
    await deleteDoc(doc(db, 'improvementActions', id));
  };

  // Admin Generate Report
  const handleGenerateReport = async () => {
    if (!currentUser) throw new Error('Unauthenticated');
    const token = await currentUser.getIdToken();
    const res = await fetch('/api/admin/report', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to generate report');
    }
    return await res.json();
  };

  const handleSaveReport = async (
    report: Omit<AuditReportDoc, 'id' | 'createdAt'>
  ) => {
    const id = crypto.randomUUID();
    const payload = sanitizePayload({
      ...report,
      createdAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'auditReports', id), payload);
  };

  // Export all transcripts into single .md file
  const handleExportTranscripts = async () => {
    if (adminAllSessions.length === 0) {
      showToast('No audit sessions available to export.');
      return;
    }

    const parseDate = (val: any) => {
      if (!val) return new Date();
      if (typeof val.toDate === 'function') return val.toDate();
      return new Date(val);
    };

    // 2) List the sessions oldest first
    const sortedSessions = [...adminAllSessions].sort(
      (a, b) =>
        parseDate(a.createdAt).getTime() - parseDate(b.createdAt).getTime()
    );

    // 1) Read messages for each session in parallel with Promise.all
    const sessionDataList = await Promise.all(
      sortedSessions.map(async (sess) => {
        try {
          const q = query(
            collection(db, 'users', sess.userId, 'interactions'),
            where('sessionId', '==', sess.sessionId)
          );
          const snap = await getDocs(q);
          const messages: AuditInteraction[] = [];
          snap.forEach((d) => {
            messages.push({ id: d.id, ...(d.data() as any) });
          });
          // Sort messages by timestamp in code (oldest first)
          messages.sort(
            (a, b) =>
              parseDate(a.timestamp).getTime() -
              parseDate(b.timestamp).getTime()
          );
          return { sess, messages, error: null };
        } catch (err: any) {
          // 4) If one session's messages cannot be read, record error and continue with others
          return {
            sess,
            messages: [] as AuditInteraction[],
            error: err?.message || String(err),
          };
        }
      })
    );

    let md = `# Department of Computing Education - TQM Process Audit Transcripts
University of Mindanao - Visayan Campus • BSIT Quality Assessment
Export Date: ${new Date().toISOString().split('T')[0]}
Total Sessions Documented: ${adminAllSessions.length}

---
`;

    for (let i = 0; i < sessionDataList.length; i++) {
      const { sess, messages, error } = sessionDataList[i];
      const p = sess.profileSnapshot;
      const createdDateObj = parseDate(sess.createdAt);

      md += `\n## Session ${i + 1}: ${p?.position || 'Staff'} (${p?.roleCategory || 'Faculty'})
- Session ID: ${sess.sessionId}
- Department: ${p?.department || 'Department of Computing Education'}
- Years in Role: ${p?.yearsInRole ?? 'N/A'}
- Primary Function: ${p?.jobFunction || 'N/A'}
- Audit Status: ${sess.status}
- Date: ${createdDateObj.toLocaleDateString()}
- Start Date and Time: ${createdDateObj.toLocaleString()}
- Message Count: ${messages.length}

### Transcript (${messages.length} messages, path /users/${sess.userId}/interactions)
`;

      if (error) {
        md += `\nTranscript could not be loaded: ${error}\n`;
      } else if (messages.length === 0) {
        md += `\n*No messages recorded for this session.*\n`;
      } else {
        md += `\n`;
        for (const msg of messages) {
          const isUser = msg.role === 'user';
          const timeStr = msg.timestamp
            ? parseDate(msg.timestamp).toLocaleString()
            : 'N/A';
          let content = msg.content || '';
          if (!isUser) {
            content = content.replace(/^\[PART:[^\]]+\]\s*/i, '');
            const modelInfo = msg.modelUsed ? ` - ${msg.modelUsed}` : '';
            md += `**Audit Agent** (${timeStr}${modelInfo})\n${content}\n\n`;
          } else {
            md += `**Employee** (${timeStr})\n${content}\n\n`;
          }
        }
      }

      md += `\n### Synthesized Audit Card\n`;

      if (sess.auditCard) {
        md += `- **Process Described:** ${sess.auditCard.processDescribed}
- **Executive Summary:** ${sess.auditCard.summary}
- **Strengths:** ${(sess.auditCard.strengths || []).join('; ') || 'None noted'}
- **Identified Issues (${sess.auditCard.issues?.length || 0}):**
`;
        sess.auditCard.issues?.forEach((issue, idx) => {
          md += `\n  ${idx + 1}. **${issue.title}** (${issue.category} | ${issue.impact} Impact | Standard: ${issue.relatedStandard})
     - Quote: "${issue.employeeQuote}"
     - 5 Whys Chain: ${(issue.whyChain || []).join(' -> ')}
     - Root Cause: ${issue.rootCause}
     - Suggested Action: ${issue.suggestedAction}
`;
        });
      } else {
        md += `*Audit Card not generated for this session.*\n`;
      }

      md += `\n---\n`;
    }

    // Trigger download
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DCE_Audit_Transcripts_${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Helper for clicking "Create improvement action" on an issue
  const handleTriggerActionFromIssue = (issue: any) => {
    setPrefilledPdcIssue(issue);
    setActiveTab('pdca');
  };

  // Loading spinner during auth check
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-full border-4 border-[#7A1F2B] border-t-transparent animate-spin mx-auto" />
          <h3 className="font-serif font-bold text-base text-[#7A1F2B]">Quality Audit Agent</h3>
          <p className="text-xs text-slate-500">Connecting to University of Mindanao DCE Services...</p>
        </div>
      </div>
    );
  }

  // 1. Landing Page (When signed out)
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex flex-col justify-between">
        {/* Top Header */}
        <header className="border-b border-[#E7DECD] bg-white/80 backdrop-blur-xs px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#7A1F2B] text-[#C9A227] flex items-center justify-center font-bold font-serif text-lg shadow-sm">
              Q
            </div>
            <div>
              <h1 className="font-serif font-bold text-base text-[#7A1F2B] leading-tight">
                Quality Audit Agent
              </h1>
              <p className="text-[11px] text-slate-500">
                Department of Computing Education • University of Mindanao Visayan Campus
              </p>
            </div>
          </div>
          <button
            onClick={handleGoogleSignIn}
            className="px-4 py-2 bg-[#7A1F2B] hover:bg-[#601822] text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer transition-colors"
          >
            Sign in with Google
          </button>
        </header>

        {/* Hero Section */}
        <main className="max-w-4xl mx-auto px-6 py-16 text-center space-y-8 flex-1 flex flex-col justify-center items-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
            <Building2 className="w-4 h-4 text-[#7A1F2B]" />
            <span>Total Quality Management (TQM) • BSIT Process Audit</span>
          </div>

          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#7A1F2B] tracking-tight leading-tight max-w-3xl">
            Continuous Quality Audits for DCE Academic & Operational Excellence
          </h2>

          <p className="text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
            The Quality Audit Agent engages faculty, the program head, and office staff in structured, four-part interviews using the 5 Whys technique. It compares real workplace practices against institutional standards and transforms identified root causes into actionable PDCA improvement cycles.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center gap-4 justify-center">
            <button
              onClick={handleGoogleSignIn}
              className="w-full sm:w-auto px-8 py-3.5 bg-[#7A1F2B] hover:bg-[#601822] text-[#FDFBF7] font-semibold text-sm rounded-xl shadow-md cursor-pointer transition-all hover:scale-102 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#C9A227"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Sign in with Google</span>
            </button>
          </div>

          {/* Pillars Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-8 text-left w-full max-w-3xl">
            <div className="p-4 bg-white border border-[#E7DECD] rounded-xl shadow-2xs">
              <h4 className="font-serif font-bold text-xs text-[#7A1F2B] mb-1">
                1. 4-Part Structured Interview
              </h4>
              <p className="text-[11px] text-slate-500">
                Walkthrough, difficulties, 5 Whys root cause exploration, and practical suggestions.
              </p>
            </div>
            <div className="p-4 bg-white border border-[#E7DECD] rounded-xl shadow-2xs">
              <h4 className="font-serif font-bold text-xs text-[#7A1F2B] mb-1">
                2. Standard Conformance
              </h4>
              <p className="text-[11px] text-slate-500">
                Evaluates tasks directly against uploaded standards (INS-*, PRG-*, OFF-*, DCE-*).
              </p>
            </div>
            <div className="p-4 bg-white border border-[#E7DECD] rounded-xl shadow-2xs">
              <h4 className="font-serif font-bold text-xs text-[#7A1F2B] mb-1">
                3. PDCA Improvement Board
              </h4>
              <p className="text-[11px] text-slate-500">
                Converts interview observations directly into monitored Deming cycle action items.
              </p>
            </div>
          </div>
        </main>

        <footer className="border-t border-[#E7DECD] py-4 text-center text-[11px] text-slate-400">
          Quality Audit Agent • Total Quality Management System • University of Mindanao Visayan Campus
        </footer>
      </div>
    );
  }

  // 2. Main Authenticated Application
  const isSuperAdmin = Boolean(meData?.isAdmin);
  const showAdminSetup = Boolean(meData?.adminSetupNeeded);

  // Statistics for admin cards
  const completedSessionsCount = adminAllSessions.filter((s) => s.status === 'completed').length;
  const uniqueIntervieweesCount = new Set(adminAllSessions.map((s) => s.userId)).size;
  let totalIssuesFound = 0;
  adminAllSessions.forEach((s) => {
    if (s.auditCard?.issues) totalIssuesFound += s.auditCard.issues.length;
  });
  const openActionsCount = improvementActions.filter((a) => a.column !== 'Act').length;

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col md:flex-row">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-[#7A1F2B] text-white px-4 py-2.5 rounded-xl shadow-lg text-xs flex items-center gap-2 animate-bounce">
          <AlertCircle className="w-4 h-4 text-[#C9A227]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Mobile Header */}
      <div className="md:hidden border-b border-[#E7DECD] bg-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#7A1F2B] text-[#C9A227] flex items-center justify-center font-serif font-bold">
            Q
          </div>
          <div>
            <h1 className="font-serif font-bold text-xs text-[#7A1F2B]">Quality Audit Agent</h1>
            <p className="text-[10px] text-slate-400">DCE • UM Visayan Campus</p>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 text-slate-700 cursor-pointer"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Left Sidebar Navigation */}
      <aside
        className={`w-full md:w-64 bg-white border-r border-[#E7DECD] flex flex-col justify-between shrink-0 ${
          mobileMenuOpen ? 'block' : 'hidden md:flex'
        }`}
      >
        <div>
          {/* Brand header */}
          <div className="p-5 border-b border-[#E7DECD] hidden md:flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#7A1F2B] text-[#C9A227] flex items-center justify-center font-serif font-bold text-xl shadow-sm">
              Q
            </div>
            <div>
              <h1 className="font-serif font-bold text-sm text-[#7A1F2B] leading-tight">
                Quality Audit Agent
              </h1>
              <p className="text-[10px] text-slate-500 leading-tight">
                Dept. of Computing Education
              </p>
              <p className="text-[9px] text-[#C9A227] font-semibold">UM Visayan Campus</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 text-xs font-medium">
            <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Auditor Menu
            </div>

            <button
              onClick={() => {
                setActiveTab('dashboard');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-[#7A1F2B] text-white font-semibold shadow-xs'
                  : 'text-slate-700 hover:bg-[#FAF7F2]'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-[#C9A227]" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => {
                if (!activeSession) {
                  handleStartInterview();
                } else {
                  setActiveTab('interview');
                }
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                activeTab === 'interview'
                  ? 'bg-[#7A1F2B] text-white font-semibold shadow-xs'
                  : 'text-slate-700 hover:bg-[#FAF7F2]'
              }`}
            >
              <MessageSquare className="w-4 h-4 text-[#C9A227]" />
              <span>Audit Interview</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('history');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-[#7A1F2B] text-white font-semibold shadow-xs'
                  : 'text-slate-700 hover:bg-[#FAF7F2]'
              }`}
            >
              <History className="w-4 h-4 text-[#C9A227]" />
              <span>Session History</span>
            </button>

            <button
              onClick={() => {
                setIsProfileModalOpen(true);
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-slate-700 hover:bg-[#FAF7F2] transition-colors cursor-pointer"
            >
              <UserCheck className="w-4 h-4 text-slate-500" />
              <span>Edit Profile</span>
            </button>

            {/* Super Admin Section (Shown only when verified by server) */}
            {isSuperAdmin && (
              <>
                <div className="pt-4 px-3 py-1.5 text-[10px] uppercase font-bold text-[#7A1F2B] tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#C9A227]" />
                  <span>Super Admin</span>
                </div>

                <button
                  onClick={() => {
                    setActiveTab('adminOverview');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                    activeTab === 'adminOverview'
                      ? 'bg-[#7A1F2B] text-white font-semibold shadow-xs'
                      : 'text-slate-700 hover:bg-[#FAF7F2]'
                  }`}
                >
                  <TableProperties className="w-4 h-4 text-[#C9A227]" />
                  <span>Admin Overview</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('baseline');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                    activeTab === 'baseline'
                      ? 'bg-[#7A1F2B] text-white font-semibold shadow-xs'
                      : 'text-slate-700 hover:bg-[#FAF7F2]'
                  }`}
                >
                  <FileText className="w-4 h-4 text-[#C9A227]" />
                  <span>Quality Baseline</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('checkSheet');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                    activeTab === 'checkSheet'
                      ? 'bg-[#7A1F2B] text-white font-semibold shadow-xs'
                      : 'text-slate-700 hover:bg-[#FAF7F2]'
                  }`}
                >
                  <TableProperties className="w-4 h-4 text-[#C9A227]" />
                  <span>TQM Check Sheet</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('pdca');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                    activeTab === 'pdca'
                      ? 'bg-[#7A1F2B] text-white font-semibold shadow-xs'
                      : 'text-slate-700 hover:bg-[#FAF7F2]'
                  }`}
                >
                  <Kanban className="w-4 h-4 text-[#C9A227]" />
                  <span>PDCA Board</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('reports');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                    activeTab === 'reports'
                      ? 'bg-[#7A1F2B] text-white font-semibold shadow-xs'
                      : 'text-slate-700 hover:bg-[#FAF7F2]'
                  }`}
                >
                  <FileBarChart className="w-4 h-4 text-[#C9A227]" />
                  <span>Consolidated Reports</span>
                </button>
              </>
            )}
          </nav>
        </div>

        {/* User Card at bottom of sidebar */}
        <div className="p-3 border-t border-[#E7DECD] bg-[#FAF7F2]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || ''}
                  className="w-8 h-8 rounded-full border border-[#C9A227] shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#7A1F2B] text-[#C9A227] flex items-center justify-center font-bold text-xs shrink-0">
                  {(currentUser.displayName || 'U')[0]}
                </div>
              )}
              <div className="overflow-hidden">
                <p className="font-semibold text-xs text-slate-800 truncate">
                  {currentUser.displayName || 'Faculty Member'}
                </p>
                <p className="text-[10px] text-slate-500 truncate">
                  {userProfile?.position || userProfile?.roleCategory || 'Auditor'}
                </p>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              title="Sign Out"
              className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-white rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content View */}
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto overflow-y-auto w-full">
        {/* Setup Banner if user is admin email but role doc is missing in Firestore */}
        {showAdminSetup && (
          <AdminSetupBanner uid={currentUser.uid} email={currentUser.email || ''} />
        )}

        {/* TAB 1: User Private Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Welcome banner */}
            <div className="bg-gradient-to-r from-[#7A1F2B] to-[#55141E] text-white rounded-2xl p-6 md:p-8 shadow-sm relative overflow-hidden">
              <div className="relative z-10 space-y-3 max-w-2xl">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-amber-200 text-xs font-semibold backdrop-blur-xs">
                  <span>Department of Computing Education</span>
                  <span>•</span>
                  <span>BSIT Program Quality Audit</span>
                </div>

                <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#FDFBF7]">
                  Welcome, {userProfile?.displayName || currentUser.displayName || 'Faculty Colleague'}
                </h2>

                <p className="text-xs md:text-sm text-slate-200 leading-relaxed">
                  The Audit Agent is ready to explore your daily operational routines, identify process obstacles, perform root cause analysis with 5 Whys, and help synthesize actionable improvement cards.
                </p>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleStartInterview}
                    className="px-5 py-2.5 bg-[#C9A227] hover:bg-[#b08d20] text-slate-900 font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-transform hover:scale-102 flex items-center gap-2"
                  >
                    <PlusCircle className="w-4 h-4 text-slate-900" />
                    <span>Start New Audit Interview</span>
                  </button>

                  <button
                    onClick={() => setIsProfileModalOpen(true)}
                    className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-medium text-xs rounded-xl border border-white/20 cursor-pointer transition-colors"
                  >
                    Update Profile Details
                  </button>
                </div>
              </div>
            </div>

            {/* Profile Summary Card */}
            <div className="bg-white border border-[#E7DECD] rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-serif text-sm font-bold text-[#7A1F2B] flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#C9A227]" />
                  <span>Your Auditor Profile</span>
                </h3>
                <button
                  onClick={() => setIsProfileModalOpen(true)}
                  className="text-xs text-[#7A1F2B] font-semibold hover:underline cursor-pointer"
                >
                  Edit Profile
                </button>
              </div>

              {userProfile ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div className="p-3 bg-[#FAF7F2] rounded-lg border border-[#EFE8DA]">
                    <span className="text-slate-500 block text-[11px]">Role Category</span>
                    <span className="font-semibold text-slate-800">{userProfile.roleCategory}</span>
                  </div>
                  <div className="p-3 bg-[#FAF7F2] rounded-lg border border-[#EFE8DA]">
                    <span className="text-slate-500 block text-[11px]">Position / Title</span>
                    <span className="font-semibold text-slate-800">{userProfile.position}</span>
                  </div>
                  <div className="p-3 bg-[#FAF7F2] rounded-lg border border-[#EFE8DA]">
                    <span className="text-slate-500 block text-[11px]">Experience</span>
                    <span className="font-semibold text-slate-800">
                      {userProfile.yearsInRole} years in role
                    </span>
                  </div>
                  <div className="p-3 bg-[#FAF7F2] rounded-lg border border-[#EFE8DA]">
                    <span className="text-slate-500 block text-[11px]">Department</span>
                    <span className="font-semibold text-slate-800 truncate block">
                      {userProfile.department}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 rounded-lg text-xs text-amber-900 border border-amber-200">
                  Profile setup incomplete. Please click 'Complete Profile' to configure your position and job duties.
                </div>
              )}
            </div>

            {/* Recent Sessions list */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-base font-bold text-[#7A1F2B]">
                  Your Recent Audit Sessions ({userSessions.length})
                </h3>
                {userSessions.length > 0 && (
                  <button
                    onClick={() => setActiveTab('history')}
                    className="text-xs text-[#7A1F2B] font-semibold hover:underline cursor-pointer"
                  >
                    View All History
                  </button>
                )}
              </div>

              {userSessions.length === 0 ? (
                <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-400">
                  You haven't conducted any TQM interviews yet. Click "Start New Audit Interview" above to begin.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userSessions.slice(0, 4).map((sess) => {
                    const isCompleted = sess.status === 'completed';
                    return (
                      <div
                        key={sess.id}
                        onClick={() => {
                          setActiveSession(sess);
                          setActiveTab('interview');
                        }}
                        className="bg-white border border-[#E7DECD] rounded-xl p-4 shadow-xs hover:border-[#C9A227] transition-all cursor-pointer space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`px-2 py-0.5 text-[11px] font-bold rounded ${
                              isCompleted
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isCompleted ? 'Completed Audit' : `Part ${sess.part || 1} in Progress`}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(sess.createdAt || Date.now()).toLocaleDateString()}
                          </span>
                        </div>

                        <h4 className="font-serif font-bold text-xs text-slate-900">
                          {sess.auditCard?.processDescribed || 'TQM Process Exploration'}
                        </h4>

                        {isCompleted && sess.auditCard?.issues && (
                          <div className="text-[11px] text-amber-900 bg-amber-50/70 p-2 rounded border border-amber-200">
                            {sess.auditCard.issues.length} process challenges & root causes identified
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Interview Chat */}
        {activeTab === 'interview' && (
          <div>
            {activeSession && userProfile ? (
              <ChatInterface
                session={activeSession}
                profile={userProfile}
                interactions={sessionInteractions}
                onSendMessage={handleSendMessage}
                onFinishAndAnalyze={handleFinishAndAnalyze}
              />
            ) : (
              <div className="bg-white border border-[#E7DECD] rounded-xl p-8 text-center space-y-4">
                <MessageSquare className="w-10 h-10 text-[#7A1F2B] mx-auto" />
                <h3 className="font-serif font-bold text-base text-[#7A1F2B]">
                  No Active Interview Session
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Start a new interview session to converse with the Audit Agent and analyze workplace processes.
                </p>
                <button
                  onClick={handleStartInterview}
                  className="px-5 py-2.5 bg-[#7A1F2B] hover:bg-[#601822] text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer"
                >
                  Start New Interview
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: User Session History */}
        {activeTab === 'history' && (
          <HistoryView
            sessions={userSessions}
            interactions={allInteractionsMap}
            isAdminView={false}
          />
        )}

        {/* TAB 4: Admin Overview Dashboard (Admin Only) */}
        {activeTab === 'adminOverview' && isSuperAdmin && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl font-bold text-[#7A1F2B]">
                  Department Quality Administration Dashboard
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cross-user read-only audit insights for the Department of Computing Education.
                </p>
              </div>

              <button
                onClick={handleExportTranscripts}
                className="px-4 py-2 bg-[#7A1F2B] hover:bg-[#601822] text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer transition-colors"
              >
                Export All Transcripts (.md)
              </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-[#E7DECD] rounded-xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500">Interviewees</span>
                  <Users className="w-4 h-4 text-[#7A1F2B]" />
                </div>
                <div className="text-2xl font-bold font-serif text-[#7A1F2B]">
                  {uniqueIntervieweesCount}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Unique faculty & staff</p>
              </div>

              <div className="bg-white border border-[#E7DECD] rounded-xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500">Completed Sessions</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold font-serif text-emerald-700">
                  {completedSessionsCount}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Full 4-part audits</p>
              </div>

              <div className="bg-white border border-[#E7DECD] rounded-xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500">Issues Found</span>
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-2xl font-bold font-serif text-amber-700">
                  {totalIssuesFound}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Bottlenecks & defects</p>
              </div>

              <div className="bg-white border border-[#E7DECD] rounded-xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500">Open PDCA Actions</span>
                  <ListTodo className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-2xl font-bold font-serif text-purple-700">
                  {openActionsCount}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Plan, Do, or Check stage</p>
              </div>
            </div>

            {/* Check Sheet preview */}
            <CheckSheetTable
              sessions={adminAllSessions}
              onCreateAction={handleTriggerActionFromIssue}
            />

            {/* All sessions list */}
            <HistoryView
              sessions={adminAllSessions}
              interactions={allInteractionsMap}
              isAdminView={true}
            />
          </div>
        )}

        {/* TAB 5: Baseline Management (Admin Only) */}
        {activeTab === 'baseline' && isSuperAdmin && (
          <BaselineManager
            baseline={baselineSettings}
            onSaveBaseline={handleSaveBaseline}
          />
        )}

        {/* TAB 6: Check Sheet Full View (Admin Only) */}
        {activeTab === 'checkSheet' && isSuperAdmin && (
          <CheckSheetTable
            sessions={adminAllSessions}
            onCreateAction={handleTriggerActionFromIssue}
          />
        )}

        {/* TAB 7: PDCA Board (Admin Only) */}
        {activeTab === 'pdca' && isSuperAdmin && (
          <PDCABoard
            actions={improvementActions}
            onAddAction={handleAddPdcAction}
            onMoveAction={handleMovePdcAction}
            onDeleteAction={handleDeletePdcAction}
            prefilledIssue={prefilledPdcIssue}
            onClearPrefilled={() => setPrefilledPdcIssue(null)}
          />
        )}

        {/* TAB 8: Consolidated Reports (Admin Only) */}
        {activeTab === 'reports' && isSuperAdmin && (
          <ConsolidatedReportView
            pastReports={auditReports}
            allSessions={adminAllSessions}
            onGenerateReport={handleGenerateReport}
            onSaveReport={handleSaveReport}
            onExportTranscripts={handleExportTranscripts}
          />
        )}
      </main>

      {/* User Profile Setup Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        initialProfile={userProfile || undefined}
        onSave={handleSaveProfile}
        onClose={() => setIsProfileModalOpen(false)}
        isFirstTime={!userProfile}
      />
    </div>
  );
}
