# Quality Audit Agent (Total Quality Management System)
### Department of Computing Education (DCE) • University of Mindanao - Visayan Campus (BSIT)

Quality Audit Agent is a production-grade, user-authenticated web application engineered to conduct Total Quality Management (TQM) process audits for the Department of Computing Education (DCE). By pairing an AI interviewer ("Audit Agent") with root cause analysis (5 Whys) and Deming's Plan-Do-Check-Act (PDCA) framework, the system translates operational realities into measurable educational quality improvements.

---

## Architecture Overview & Directive 8 Implementation

- **Client-Driven Persistence**: The browser writes and reads the signed-in user's data directly using the Firebase Client SDK, strictly isolated by Cloud Firestore Security Rules.
- **Stateless Server Proxy**: The Express backend verifies Firebase ID tokens using the Firebase Admin SDK (`adminAuth.verifyIdToken`), reads necessary baseline and session context via the Firestore REST API using the user's ID token, and proxies calls to the Gemini API using the Directive 6 Resilient Model Fallback Ladder. The server **never writes** to Firestore.
- **Single Super Administrator**: Designates `gwenso0305@gmail.com` as the super administrator, requiring both verified Google email matching `ADMIN_EMAIL` and the existence of `/admins/{uid}` with `role = "superadmin"`.

---

## 1. Prerequisites & GCP APIs

Ensure the Google Cloud SDK (`gcloud`) is installed and configured:

```bash
# Login and set project
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Enable essential GCP services
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  identitytoolkit.googleapis.com
```

---

## 2. Secret Management Setup

Store the Gemini API key in Google Cloud Secret Manager and grant the default Cloud Run runtime service account accessor privileges:

```bash
# Create and populate the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# Grant the Cloud Run service account access to read the secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 3. Database Security Configuration (`firestore.rules`)

Deploy the following owner-isolated, attribute-based access control rules to Cloud Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    function isAdmin() {
      return isSignedIn() && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }

    // Role check collection: users can only check their own admin doc; never write from app
    match /admins/{uid} {
      allow get: if isSignedIn() && request.auth.uid == uid;
      allow list, write: if false;
    }

    // Baseline settings: read by any authenticated user; modified only by superadmin
    match /settings/baseline {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }

    // User profile: owner read/write; admin read-only
    match /users/{userId} {
      allow read: if isOwner(userId) || isAdmin();
      allow write: if isOwner(userId);

      // Sessions subcollection: owner read/write; admin read-only
      match /sessions/{sessionId} {
        allow read: if isOwner(userId) || isAdmin();
        allow write: if isOwner(userId);
      }

      // Interactions subcollection: owner read/write; admin read-only
      match /interactions/{interactionId} {
        allow read: if isOwner(userId) || isAdmin();
        allow write: if isOwner(userId);
      }
    }

    // Collection group queries for admin reporting & aggregation
    match /{path=**}/sessions/{sessionId} {
      allow read: if isAdmin();
    }

    match /{path=**}/interactions/{interactionId} {
      allow read: if isAdmin();
    }

    // PDCA Improvement actions: admin only
    match /improvementActions/{actionId} {
      allow read, write: if isAdmin();
    }

    // Consolidated audit reports: admin only
    match /auditReports/{reportId} {
      allow read, write: if isAdmin();
    }

    // Global default deny
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Deploy the rules via Firebase CLI:

```bash
firebase deploy --only firestore:rules
```

---

## 4. Google Cloud Run Deployment Flow

Build and deploy the unified container application directly to Google Cloud Run:

```bash
gcloud run deploy quality-audit-agent \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --set-env-vars="ADMIN_EMAIL=gwenso0305@gmail.com,NODE_ENV=production,FORCE_MODEL_FAILURE=false" \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest"
```

---

## 5. Required Campaign Labeling

Apply the mandatory challenge verification label to register the Cloud Run deployment:

```bash
gcloud run services update quality-audit-agent \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=asia-southeast1
```

---

## 6. Manual Setup Steps for Super Administrator

1. **Sign In**: Navigate to the deployed application URL and click **Sign in with Google** using `gwenso0305@gmail.com`.
2. **Observe Setup Banner**: The app automatically recognizes your email as the designated administrator and displays the setup note containing your Firebase Auth UID.
3. **Create Firestore Admin Document**:
   - Open the [Firebase Console](https://console.firebase.google.com).
   - Go to **Firestore Database** -> **Start collection** -> Collection ID: `admins`.
   - Document ID: `<YOUR_UID>` (copied from the banner).
   - Field: `role` (type string) = `"superadmin"`.
4. **Refresh**: Refresh the web application to unlock the full Admin Overview, Quality Baseline Manager, TQM Check Sheet, PDCA Board, and Consolidated Reports.
