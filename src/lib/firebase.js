import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GithubAuthProvider, 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  onAuthStateChanged 
} from "firebase/auth";
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

// --- UPDATED SUBSCRIPTION FUNCTION ---
export const subscribeToSwarm = (repoId, callback, demoMode = false) => {
  if (demoMode || !repoId) return () => {}; 
  
  // 1. Force lowercase to match your Test Site ID
  const safeRepoId = repoId.replace('/', '_').toLowerCase();
  
  // 2. Define References
  const sessionsRef = ref(db, `swarm/${safeRepoId}/active_sessions`);
  const clicksRef = ref(db, `swarm/${safeRepoId}/clicks`);

  // 3. Listen for Active Users
  const unsubscribeSessions = onValue(sessionsRef, (snapshot) => {
    const count = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
    callback('users', count);
  });

  // 4. Listen for Clicks (NEW)
  const unsubscribeClicks = onValue(clicksRef, (snapshot) => {
    if (snapshot.exists()) {
      // Returns object like: { "btn-cta": 12, "hero-text": 5 }
      callback('clicks', snapshot.val());
    }
  });

  // Return a cleanup function that stops BOTH listeners
  return () => {
    unsubscribeSessions();
    unsubscribeClicks();
  };
};