import fs from 'fs';
import path from 'path';

let projectId = 'default-project';
let firestoreDatabaseId = '(default)';

try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed.projectId) projectId = parsed.projectId;
    if (parsed.firestoreDatabaseId) firestoreDatabaseId = parsed.firestoreDatabaseId;
  }
} catch (err) {
  console.warn('Could not read firebase config for firestore REST:', err);
}

const getBaseUrl = () => {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents`;
};

/**
 * Decode a Firestore REST value object into a native JavaScript value.
 */
export function decodeRestValue(valObj: any): any {
  if (!valObj || typeof valObj !== 'object') return null;

  if ('stringValue' in valObj) return valObj.stringValue;
  if ('integerValue' in valObj) return Number(valObj.integerValue);
  if ('doubleValue' in valObj) return Number(valObj.doubleValue);
  if ('booleanValue' in valObj) return Boolean(valObj.booleanValue);
  if ('timestampValue' in valObj) return valObj.timestampValue;
  if ('nullValue' in valObj) return null;

  if ('mapValue' in valObj) {
    const fields = valObj.mapValue.fields || {};
    const res: Record<string, any> = {};
    for (const k of Object.keys(fields)) {
      res[k] = decodeRestValue(fields[k]);
    }
    return res;
  }

  if ('arrayValue' in valObj) {
    const values = valObj.arrayValue.values || [];
    return values.map(decodeRestValue);
  }

  return null;
}

/**
 * Decode a complete Firestore REST document.
 */
export function decodeRestDocument(docObj: any): any {
  if (!docObj || !docObj.fields) return null;
  const res: Record<string, any> = {};
  for (const k of Object.keys(docObj.fields)) {
    res[k] = decodeRestValue(docObj.fields[k]);
  }
  if (docObj.name) {
    const parts = docObj.name.split('/');
    res.id = parts[parts.length - 1];
    res._fullPath = docObj.name;
  }
  return res;
}

/**
 * Fetch a single document via Firestore REST documents.get method.
 * Never uses ListDocuments. Uses user's ID token.
 */
export async function getDocumentRest(docPath: string, userToken: string): Promise<any | null> {
  const cleanPath = docPath.startsWith('/') ? docPath.slice(1) : docPath;
  const url = `${getBaseUrl()}/${cleanPath}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${userToken}`,
      Accept: 'application/json',
    },
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Firestore REST documents.get failed (${res.status}):`, errText);
    throw new Error(`Firestore read failed with status ${res.status}`);
  }

  const json = await res.json();
  return decodeRestDocument(json);
}

/**
 * Execute a structured query via Firestore REST runQuery method.
 * Uses equality filters only; sorting is done in code.
 * Never uses ListDocuments. Uses user's ID token.
 */
export async function runQueryRest(
  parentPath: string, // e.g. "users/abc" or "" for root collection group
  structuredQuery: any,
  userToken: string
): Promise<any[]> {
  const cleanParent = parentPath.startsWith('/') ? parentPath.slice(1) : parentPath;
  const url = cleanParent ? `${getBaseUrl()}/${cleanParent}:runQuery` : `${getBaseUrl()}:runQuery`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ structuredQuery }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Firestore REST runQuery failed (${res.status}):`, errText);
    throw new Error(`Firestore query failed with status ${res.status}`);
  }

  const json = await res.json();
  const results: any[] = [];

  if (Array.isArray(json)) {
    for (const item of json) {
      if (item.document) {
        const decoded = decodeRestDocument(item.document);
        if (decoded) results.push(decoded);
      }
    }
  }

  return results;
}
