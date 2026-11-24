import type { Backend } from "../types";

// Placeholder for the Firebase adapter. The `firebase` package is not
// installed yet, so this file must not import it.
//
// To activate (full checklist in docs/PLAN.md, "Phase 4: Move to Firebase"):
//   1. npm install firebase
//   2. Fill NEXT_PUBLIC_FIREBASE_* in .env.local (see .env.example)
//   3. Implement createFirebaseBackend() against the interfaces in ../types.ts:
//        AuthService.signIn          → signInWithEmailAndPassword
//        AuthService.signUp          → createUserWithEmailAndPassword + setDoc(users/{uid})
//        AuthService.onAuthStateChanged → onAuthStateChanged
//        DataService.listSessions    → query(users/{id}/sessions, orderBy(startedAt, desc), limit)
//        DataService.getWaveform     → getBytes(ref(storage, session.waveformPath)) + gunzip
//        DataService.redeemInvite    → httpsCallable("redeemInvite")   (Cloud Function)
//        DataService.getCoachLink / setCoachScope → getDoc / updateDoc(coachLinks/{coachId}_{athleteId})
//        DataService.listAssignments → query(users/{id}/assignments, orderBy(createdAt, desc))
//        DataService.listComments    → users/{id}/sessions/{sid}/comments, or
//                                      collectionGroup("comments") where athleteId == id
//        DataService.listSeenSessions / markSessionSeen → coaches/{uid}/seen/{athleteId_sessionId}
//        DataService.getCoachNote / saveCoachNote       → coaches/{uid}/athleteNotes/{athleteId}
//        DataService.joinWaitlist    → addDoc(waitlist)
//      Map Firebase error codes to BackendError codes (auth/invalid-credential
//      → "invalid-credentials", permission-denied → "permission-denied", …).
//   4. Set NEXT_PUBLIC_BACKEND=firebase
//
// The local adapter's tests (../local/local.test.ts) describe the behaviour
// this adapter has to match; run them against the Firebase emulators.

export function createFirebaseBackend(): Backend {
  throw new Error(
    "NEXT_PUBLIC_BACKEND=firebase, but the Firebase adapter isn't implemented yet. " +
      "See src/lib/backend/firebase/index.ts.",
  );
}
