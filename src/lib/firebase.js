import { initializeApp } from "firebase/app";
import { getAuth, GithubAuthProvider, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import { getDatabase, ref, onValue } from "firebase/database";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const provider = new GithubAuthProvider();
provider.addScope('repo'); 

export const signInWithGithub = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GithubAuthProvider.credentialFromResult(result);
    if (credential.accessToken) localStorage.setItem('gh_token', credential.accessToken);
    return { user: result.user, token: credential.accessToken };
  } catch (error) { console.error("Error signing in:", error); throw error; }
};

export const signOut = async () => { localStorage.removeItem('gh_token'); return firebaseSignOut(auth); };
export const subscribeToAuth = (callback) => { return onAuthStateChanged(auth, (user) => { const token = localStorage.getItem('gh_token'); callback(user, token); }); };

export const subscribeToSwarm = (repoId, callback, demoMode = false) => {
  if (demoMode || !repoId) return () => {}; 
  const safeRepoId = repoId.replace('/', '_').toLowerCase();
  
  const sessionsRef = ref(db, `swarm/${safeRepoId}/active_sessions`);
  const clicksRef = ref(db, `swarm/${safeRepoId}/clicks`);

  // 1. Send Active User Count
  const unsubscribeSessions = onValue(sessionsRef, (snapshot) => {
    const count = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
    callback('users', count);
  });

  // 2. Send Click Data
  const unsubscribeClicks = onValue(clicksRef, (snapshot) => {
    if (snapshot.exists()) callback('clicks', snapshot.val());
  });

  return () => { unsubscribeSessions(); unsubscribeClicks(); };
};