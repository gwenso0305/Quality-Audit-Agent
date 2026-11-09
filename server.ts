import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { adminAuth } from './server/firebaseAdmin.ts';
import { getDocumentRest, runQueryRest } from './server/firestoreRest.ts';
import { generateContentWithFallback, logStartupModelSwitch } from './server/geminiLadder.ts';
import { checkRateLimit } from './server/rateLimiter.ts';
import { PROMPT_A, PROMPT_B, PROMPT_C } from './server/prompts.ts';

dotenv.config();

// Startup logging for fallback test switch
logStartupModelSwitch();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Order guarantee: Payload decoding middleware mounted before routes
app.use(express.json({ limit: '10mb' }));

interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    name?: string;
  };
  token?: string;
}

// Authentication middleware using Firebase Admin SDK
async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Missing or malformed Authorization header.',
      code: 'UNAUTHENTICATED',
      requestId: crypto.randomUUID(),
    });
    return;
  }

  const token = authHeader.split('Bearer ')[1].trim();

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
    };
    req.token = token;
    next();
  } catch (err: any) {
    console.error('Firebase token verification failed:', err.message);
    res.status(401).json({
      error: 'Invalid or expired Firebase ID token.',
      code: 'INVALID_TOKEN',
      requestId: crypto.randomUUID(),
    });
  }
}

// Helper to determine if user is admin according to Directive 8
async function checkAdminStatus(uid: string, email: string | undefined, userToken: string) {
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const userEmail = (email || '').trim().toLowerCase();

  // Fail closed if ADMIN_EMAIL is not set
  if (!adminEmail || !userEmail || adminEmail !== userEmail) {
    return { isAdmin: false, adminSetupNeeded: false };
  }

  // Check /admins/{uid} document via Firestore REST API with user token
  try {
    const adminDoc = await getDocumentRest(`admins/${uid}`, userToken);
    if (adminDoc && adminDoc.role === 'superadmin') {
      return { isAdmin: true, adminSetupNeeded: false };
    }
    // Email matches, but /admins/{uid} doc does not exist yet
    return { isAdmin: false, adminSetupNeeded: true };
  } catch (err) {
    console.warn(`Could not verify admin doc for ${uid}:`, err);
    return { isAdmin: false, adminSetupNeeded: true };
  }
}

// Valid issue categories for TQM Audit
const ALLOWED_CATEGORIES = [
  'Instruction & Learning Materials',
  'Assessment & Grading',
  'Laboratory & Equipment',
  'Records & Documentation',
  'Communication & Coordination',
  'Policies & Procedures',
  'Workload & Staffing',
  'Student Support',
];

// Extract standard codes from baseline text (INS-*, PRG-*, OFF-*, DCE-*)
function extractBaselineCodes(baselineText: string): Set<string> {
  const codes = new Set<string>();
  const matches = baselineText.match(/\b(?:INS|PRG|OFF|DCE)-[0-9]+(?:\.[0-9]+)?\b/gi);
  if (matches) {
    matches.forEach((c) => codes.add(c.toUpperCase()));
  }
  return codes;
}

// --- API ROUTES ---

// GET /api/me: Returns user information, superadmin status, and setup note flag
app.get('/api/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.user!.uid;
    const email = req.user!.email;
    const token = req.token!;

    const { isAdmin, adminSetupNeeded } = await checkAdminStatus(uid, email, token);

    res.json({
      uid,
      displayName: req.user!.name || '',
      email: email || '',
      isAdmin,
      adminSetupNeeded,
    });
  } catch (error: any) {
    console.error('Error in /api/me:', error);
    res.status(500).json({
      error: 'Failed to retrieve user profile.',
      code: 'SERVER_ERROR',
      requestId: crypto.randomUUID(),
    });
  }
});

// POST /api/chat: Interview multi-turn interaction with Audit Agent
app.post('/api/chat', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const uid = req.user!.uid;
  const token = req.token!;

  // Rate limit: 30 calls per user per 10 minutes
  const rate = checkRateLimit(uid);
  if (!rate.allowed) {
    res.status(429).json({
      error: 'Too many requests. Please wait a few minutes and try again.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfterSeconds: rate.retryAfterSeconds,
      requestId: crypto.randomUUID(),
    });
    return;
  }

  // Defensive payload ingestion
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const { sessionId, clientMessageId, message } = body;

  // Validation
  if (!sessionId || typeof sessionId !== 'string' || !/^[a-zA-Z0-9_\-]{1,128}$/.test(sessionId)) {
    res.status(400).json({
      error: 'Invalid sessionId. Allowed characters are letters, numbers, hyphens, and underscores (max 128 chars).',
      code: 'INVALID_SESSION_ID',
      requestId: crypto.randomUUID(),
    });
    return;
  }

  if (!clientMessageId || typeof clientMessageId !== 'string' || clientMessageId.length > 128) {
    res.status(400).json({
      error: 'Invalid clientMessageId.',
      code: 'INVALID_CLIENT_MESSAGE_ID',
      requestId: crypto.randomUUID(),
    });
    return;
  }

  if (!message || typeof message !== 'string' || message.trim().length === 0 || message.length > 2000) {
    res.status(400).json({
      error: 'Chat message must be between 1 and 2,000 characters.',
      code: 'INVALID_MESSAGE_LENGTH',
      requestId: crypto.randomUUID(),
    });
    return;
  }

  try {
    // 1. Read user profile from Firestore REST
    const userProfile = (await getDocumentRest(`users/${uid}`, token)) || {};

    // 2. Read baseline from settings/baseline
    const baselineDoc = await getDocumentRest('settings/baseline', token);
    let baselineText = '';
    if (baselineDoc && Array.isArray(baselineDoc.documents)) {
      baselineText = baselineDoc.documents.map((d: any) => `### ${d.title}\n${d.text}`).join('\n\n');
    }

    // 3. Read session interactions (equality filter on sessionId, sorted in code)
    const interactionQuery = {
      from: [{ collectionId: 'interactions' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'sessionId' },
          op: 'EQUAL',
          value: { stringValue: sessionId },
        },
      },
    };

    const rawInteractions = await runQueryRest(`users/${uid}`, interactionQuery, token);

    // Sort in code by timestamp
    const sortedInteractions = rawInteractions.sort((a, b) => {
      const tA = new Date(a.timestamp || 0).getTime();
      const tB = new Date(b.timestamp || 0).getTime();
      return tA - tB;
    });

    // Populate PROMPT A system instruction
    const today = new Date().toISOString().split('T')[0];
    const systemInstruction = PROMPT_A.replace('{today}', today)
      .replace('{displayName}', userProfile.displayName || req.user!.name || 'Colleague')
      .replace('{department}', userProfile.department || 'Department of Computing Education')
      .replace('{roleCategory}', userProfile.roleCategory || 'Faculty')
      .replace('{position}', userProfile.position || 'Staff')
      .replace('{jobFunction}', userProfile.jobFunction || 'Academic and operational support')
      .replace('{yearsInRole}', String(userProfile.yearsInRole ?? 0))
      .replace('{baselineText}', baselineText || 'None uploaded. Proceed with standard TQM interview.');

    // Build multi-turn contents for Gemini
    const contents: any[] = [];
    for (const item of sortedInteractions) {
      if (item.content) {
        contents.push({
          role: item.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: item.content }],
        });
      }
    }
    // Append current user message
    contents.push({
      role: 'user',
      parts: [{ text: message.trim() }],
    });

    // Call Gemini with Directive 6 fallback ladder
    const { text: rawReply, modelUsed } = await generateContentWithFallback({
      contents,
      systemInstruction,
    });

    // Parse [PART:n] tag from start of reply
    let part = 1;
    let cleanedReply = rawReply.trim();
    const partMatch = cleanedReply.match(/^\[PART:([1-4])\]/i);
    if (partMatch) {
      part = parseInt(partMatch[1], 10);
      cleanedReply = cleanedReply.replace(/^\[PART:[1-4]\]\s*/i, '').trim();
    }

    res.json({
      reply: cleanedReply,
      part,
      modelUsed,
    });
  } catch (error: any) {
    console.error('Error during /api/chat execution:', error);
    const status = error.status || 500;
    res.status(status).json({
      error: error.message || 'The AI service encountered an error processing your message.',
      code: error.code || 'AI_GENERATION_FAILED',
      requestId: crypto.randomUUID(),
    });
  }
});

// POST /api/analyze: Generate Audit Card in JSON mode
app.post('/api/analyze', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const uid = req.user!.uid;
  const token = req.token!;

  // Rate limit
  const rate = checkRateLimit(uid);
  if (!rate.allowed) {
    res.status(429).json({
      error: 'Too many requests. Please wait a few minutes and try again.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfterSeconds: rate.retryAfterSeconds,
      requestId: crypto.randomUUID(),
    });
    return;
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const { sessionId } = body;

  if (!sessionId || typeof sessionId !== 'string' || !/^[a-zA-Z0-9_\-]{1,128}$/.test(sessionId)) {
    res.status(400).json({
      error: 'Invalid sessionId.',
      code: 'INVALID_SESSION_ID',
      requestId: crypto.randomUUID(),
    });
    return;
  }

  try {
    // 1. Read profile
    const userProfile = (await getDocumentRest(`users/${uid}`, token)) || {};

    // 2. Read baseline
    const baselineDoc = await getDocumentRest('settings/baseline', token);
    let baselineText = '';
    if (baselineDoc && Array.isArray(baselineDoc.documents)) {
      baselineText = baselineDoc.documents.map((d: any) => `### ${d.title}\n${d.text}`).join('\n\n');
    }
    const validBaselineCodes = extractBaselineCodes(baselineText);

    // 3. Read interactions for this session
    const interactionQuery = {
      from: [{ collectionId: 'interactions' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'sessionId' },
          op: 'EQUAL',
          value: { stringValue: sessionId },
        },
      },
    };

    const rawInteractions = await runQueryRest(`users/${uid}`, interactionQuery, token);
    const sortedInteractions = rawInteractions.sort((a, b) => {
      const tA = new Date(a.timestamp || 0).getTime();
      const tB = new Date(b.timestamp || 0).getTime();
      return tA - tB;
    });

    if (sortedInteractions.length === 0) {
      res.status(400).json({
        error: 'No interview transcript found for this session.',
        code: 'EMPTY_TRANSCRIPT',
        requestId: crypto.randomUUID(),
      });
      return;
    }

    const transcript = sortedInteractions
      .map((item) => `${item.role === 'assistant' ? 'Audit Agent' : 'Employee'}: ${item.content}`)
      .join('\n\n');

    const profileText = `Name: ${userProfile.displayName || req.user!.name || 'Colleague'}, Department: ${
      userProfile.department || 'DCE'
    }, Role: ${userProfile.roleCategory || 'Faculty'}, Position: ${userProfile.position || 'Staff'}, Job Function: ${
      userProfile.jobFunction || 'N/A'
    }, Years: ${userProfile.yearsInRole ?? 0}`;

    const promptText = PROMPT_B.replace('{profile}', profileText)
      .replace('{baselineText}', baselineText || 'None uploaded.')
      .replace('{transcript}', transcript)
      .replace('{sessionDate}', new Date().toISOString().split('T')[0]);

    // JSON Schema for PROMPT B Audit Card
    const auditCardSchema = {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        processDescribed: { type: 'string' },
        strengths: {
          type: 'array',
          items: { type: 'string' },
        },
        issues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              category: {
                type: 'string',
                enum: ALLOWED_CATEGORIES,
              },
              impact: {
                type: 'string',
                enum: ['Low', 'Medium', 'High'],
              },
              relatedStandard: { type: 'string' },
              employeeQuote: { type: 'string' },
              whyChain: {
                type: 'array',
                items: { type: 'string' },
              },
              rootCause: { type: 'string' },
              suggestedAction: { type: 'string' },
            },
            required: ['title', 'category', 'impact', 'relatedStandard', 'employeeQuote', 'whyChain', 'rootCause', 'suggestedAction'],
          },
        },
        overallObservation: { type: 'string' },
      },
      required: ['summary', 'processDescribed', 'strengths', 'issues', 'overallObservation'],
    };

    const { text: rawJson, modelUsed } = await generateContentWithFallback({
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      responseMimeType: 'application/json',
      responseSchema: auditCardSchema,
    });

    let auditCard: any;
    try {
      auditCard = JSON.parse(rawJson);
    } catch (parseErr) {
      console.error('Failed to parse Audit Card JSON:', rawJson);
      throw new Error('AI output did not return valid JSON.');
    }

    // Strict validation and sanitization of Audit Card
    if (!auditCard.summary || typeof auditCard.summary !== 'string') {
      auditCard.summary = 'Summary not available.';
    }
    if (!auditCard.processDescribed || typeof auditCard.processDescribed !== 'string') {
      auditCard.processDescribed = 'Process description not specified.';
    }
    if (!Array.isArray(auditCard.strengths)) {
      auditCard.strengths = [];
    }
    auditCard.strengths = auditCard.strengths.slice(0, 3);

    if (!Array.isArray(auditCard.issues)) {
      auditCard.issues = [];
    }

    auditCard.issues = auditCard.issues.slice(0, 6).map((issue: any) => {
      // Validate category
      let category = ALLOWED_CATEGORIES.includes(issue.category) ? issue.category : 'Policies & Procedures';
      // Validate impact
      let impact = ['Low', 'Medium', 'High'].includes(issue.impact) ? issue.impact : 'Medium';
      // Validate relatedStandard: must exist in baseline, else 'None'
      let standard = typeof issue.relatedStandard === 'string' ? issue.relatedStandard.trim().toUpperCase() : 'NONE';
      if (!validBaselineCodes.has(standard)) {
        standard = 'None';
      }

      return {
        title: String(issue.title || 'Untitled Issue').slice(0, 100),
        category,
        impact,
        relatedStandard: standard,
        employeeQuote: String(issue.employeeQuote || '').slice(0, 300),
        whyChain: Array.isArray(issue.whyChain) ? issue.whyChain.slice(0, 5).map(String) : [],
        rootCause: String(issue.rootCause || 'Root cause not determined.').slice(0, 300),
        suggestedAction: String(issue.suggestedAction || 'Action to be identified.').slice(0, 400),
      };
    });

    res.json({
      auditCard,
      modelUsed,
    });
  } catch (error: any) {
    console.error('Error in /api/analyze:', error);
    res.status(error.status || 500).json({
      error: error.message || 'Failed to complete interview analysis.',
      code: error.code || 'ANALYSIS_FAILED',
      requestId: crypto.randomUUID(),
    });
  }
});

// POST /api/admin/report: Generate Consolidated Quality Audit Report (admin only)
app.post('/api/admin/report', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const uid = req.user!.uid;
  const token = req.token!;

  // Admin access validation
  const { isAdmin } = await checkAdminStatus(uid, req.user!.email, token);
  if (!isAdmin) {
    res.status(403).json({
      error: 'Access denied. Administrator privileges required.',
      code: 'FORBIDDEN',
      requestId: crypto.randomUUID(),
    });
    return;
  }

  try {
    // 1. Read all completed sessions via collection-group runQuery
    const sessionsQuery = {
      from: [{ collectionId: 'sessions', allDescendants: true }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'status' },
          op: 'EQUAL',
          value: { stringValue: 'completed' },
        },
      },
    };

    const completedSessions = await runQueryRest('', sessionsQuery, token);

    // 2. Compute exact statistics on the server
    const roleCounts: Record<string, number> = {
      Faculty: 0,
      'Program Head': 0,
      'Administrative Staff': 0,
    };

    // Category x Role Category Check Sheet matrix
    const checkSheet: Record<string, Record<string, number>> = {};
    ALLOWED_CATEGORIES.forEach((cat) => {
      checkSheet[cat] = { Faculty: 0, 'Program Head': 0, 'Administrative Staff': 0 };
    });

    const uniqueInterviewees = new Set<string>();
    const allIssues: any[] = [];
    const allStrengths: string[] = [];
    const standardCodeCounts: Record<string, number> = {};
    const impactCounts: Record<string, number> = { High: 0, Medium: 0, Low: 0 };

    for (const session of completedSessions) {
      if (session.userId) uniqueInterviewees.add(session.userId);

      const roleCat = session.profileSnapshot?.roleCategory || 'Faculty';
      if (roleCat in roleCounts) {
        roleCounts[roleCat]++;
      } else {
        roleCounts['Faculty']++;
      }

      if (session.auditCard) {
        if (Array.isArray(session.auditCard.strengths)) {
          session.auditCard.strengths.forEach((s: string) => allStrengths.push(s));
        }

        if (Array.isArray(session.auditCard.issues)) {
          for (const issue of session.auditCard.issues) {
            allIssues.push(issue);

            // Tally into checkSheet
            const cat = ALLOWED_CATEGORIES.includes(issue.category) ? issue.category : 'Policies & Procedures';
            if (checkSheet[cat]) {
              const matchedRole = roleCat in checkSheet[cat] ? roleCat : 'Faculty';
              checkSheet[cat][matchedRole]++;
            }

            // Impact tally
            if (issue.impact && issue.impact in impactCounts) {
              impactCounts[issue.impact]++;
            }

            // Standard code tally
            if (issue.relatedStandard && issue.relatedStandard !== 'None') {
              standardCodeCounts[issue.relatedStandard] = (standardCodeCounts[issue.relatedStandard] || 0) + 1;
            }
          }
        }
      }
    }

    // 3. Read baseline to list known standard codes
    const baselineDoc = await getDocumentRest('settings/baseline', token);
    let baselineText = '';
    if (baselineDoc && Array.isArray(baselineDoc.documents)) {
      baselineText = baselineDoc.documents.map((d: any) => d.text).join('\n');
    }
    const baselineCodes = Array.from(extractBaselineCodes(baselineText)).join(', ');

    const stats = {
      completedSessionsCount: completedSessions.length,
      intervieweesCount: uniqueInterviewees.size,
      roleCounts,
      checkSheet,
      totalIssuesCount: allIssues.length,
      impactCounts,
      standardCodeCounts,
    };

    // Replace prompt placeholders
    const promptText = PROMPT_C.replace('{statsJson}', JSON.stringify(stats, null, 2))
      .replace('{issuesJson}', JSON.stringify(allIssues, null, 2))
      .replace('{strengthsJson}', JSON.stringify(allStrengths.slice(0, 10), null, 2))
      .replace('{baselineCodes}', baselineCodes || 'None')
      .replace('{today}', new Date().toISOString().split('T')[0]);

    // Call Gemini with fallback ladder
    const { text: markdown, modelUsed } = await generateContentWithFallback({
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
    });

    res.json({
      markdown,
      stats,
      modelUsed,
    });
  } catch (error: any) {
    console.error('Error generating consolidated report:', error);
    res.status(500).json({
      error: error.message || 'Failed to generate consolidated audit report.',
      code: 'REPORT_GENERATION_FAILED',
      requestId: crypto.randomUUID(),
    });
  }
});

// --- CLIENT STATIC ASSET SERVING & VITE DEV SERVER ---

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Dynamic import in development so production prune of devDependencies doesn't fail
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Quality Audit Agent server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
