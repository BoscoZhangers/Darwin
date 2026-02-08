import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GithubAuthProvider, 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { getDatabase, ref, onValue, query, limitToLast } from "firebase/database";

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
    const token = credential.accessToken;
    if (token) localStorage.setItem('gh_token', token);
    return { user: result.user, token };
  } catch (error) {
    console.error("Error signing in:", error);
    throw error;
  }
};

export const signOut = async () => {
  localStorage.removeItem('gh_token');
  return firebaseSignOut(auth);
};

export const subscribeToAuth = (callback) => {
  return onAuthStateChanged(auth, (user) => {
    const token = localStorage.getItem('gh_token');
    callback(user, token);
  });
};

// --- SUBSCRIPTION FUNCTION ---
export const subscribeToSwarm = (repoId, callback, demoMode = false) => {
  if (demoMode || !repoId) return () => {}; 
  
  const safeRepoId = repoId.replace('/', '_').toLowerCase();
  
  const sessionsRef = ref(db, `swarm/${safeRepoId}/active_sessions`);
  const clicksRef = ref(db, `swarm/${safeRepoId}/clicks`);
  const eventsRef = query(ref(db, `swarm/${safeRepoId}/events`), limitToLast(1));

  // 1. LISTEN FOR FULL USER DATA (Required for Analytics & Counts)
  const unsubscribeSessions = onValue(sessionsRef, (snapshot) => {
    const data = snapshot.val();
    // We send 'users_full' because Dashboard expects the object to calculate duration
    callback('users_full', data || {}); 
  });

  // 2. LISTEN FOR CLICKS (For Bubble Sizes)
  const unsubscribeClicks = onValue(clicksRef, (snapshot) => {
    if (snapshot.exists()) callback('clicks', snapshot.val());
  });

  // 3. LISTEN FOR EVENTS (Real-time pulses)
  const unsubscribeEvents = onValue(eventsRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const latestKey = Object.keys(data)[0];
      callback('event', data[latestKey]);
    }
  });

  return () => {
    unsubscribeSessions();
    unsubscribeClicks();
    unsubscribeEvents();
  };
};