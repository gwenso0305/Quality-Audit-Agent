export type RoleCategory = 'Faculty' | 'Program Head' | 'Administrative Staff';

export interface UserProfile {
  department: string;
  roleCategory: RoleCategory;
  position: string;
  jobFunction: string;
  yearsInRole: number;
  displayName?: string;
  photoURL?: string;
  updatedAt?: string;
}

export interface AuditIssue {
  title: string;
  category: string;
  impact: 'Low' | 'Medium' | 'High';
  relatedStandard: string;
  employeeQuote: string;
  whyChain: string[];
  rootCause: string;
  suggestedAction: string;
}

export interface AuditCard {
  summary: string;
  processDescribed: string;
  strengths: string[];
  issues: AuditIssue[];
  overallObservation: string;
}

export interface AuditSession {
  id: string;
  sessionId: string;
  userId: string;
  status: 'in_progress' | 'completed';
  part: number;
  profileSnapshot?: UserProfile;
  auditCard?: AuditCard;
  createdAt: any;
  completedAt?: any;
}

export interface AuditInteraction {
  id: string;
  interactionId: string;
  sessionId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  modelUsed?: string;
  clientMessageId?: string;
  timestamp: string;
}

export interface BaselineDoc {
  id: string;
  title: string;
  text: string;
  sizeChars: number;
  uploadedAt: string;
}

export interface BaselineSettings {
  documents: BaselineDoc[];
  updatedAt?: string;
}

export type PDCAColumn = 'Plan' | 'Do' | 'Check' | 'Act';

export interface ImprovementAction {
  id: string;
  title: string;
  owner: string;
  targetDate: string;
  notes: string;
  category: string;
  standardCode: string;
  column: PDCAColumn;
  createdAt: any;
  updatedAt?: any;
}

export interface AuditReportDoc {
  id: string;
  title: string;
  markdown: string;
  stats: any;
  modelUsed?: string;
  createdAt: any;
}

export interface MeResponse {
  uid: string;
  displayName: string;
  email: string;
  isAdmin: boolean;
  adminSetupNeeded: boolean;
}
