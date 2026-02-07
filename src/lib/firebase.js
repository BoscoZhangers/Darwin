import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GithubAuthProvider, 
  signInWithPopup, 
  signOut as firebaseSignOut, // Rename native function to avoid conflict
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

// Request full repo access so we can read/write files
provider.addScope('repo'); 

// 1. Sign In
export const signInWithGithub = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GithubAuthProvider.credentialFromResult(result);
    const token = credential.accessToken;
    
    // Save token to localStorage so it persists on refresh
    if (token) localStorage.setItem('gh_token', token);
    
    return { user: result.user, token };
  } catch (error) {
    console.error("Error signing in:", error);
    throw error;
  }
};

// 2. Sign Out (THIS WAS MISSING)
export const signOut = async () => {
  localStorage.removeItem('gh_token');
  return firebaseSignOut(auth);
};

// 3. Auth Listener
export const subscribeToAuth = (callback) => {
  return onAuthStateChanged(auth, (user) => {
    // Retrieve the token we saved earlier
    const token = localStorage.getItem('gh_token');
    callback(user, token);
  });
};

// 4. Swarm/Database Subscription
export const subscribeToSwarm = (callback, demoMode = false) => {
  if (demoMode) return; 
  
  const swarmRef = ref(db, 'swarm/users');
  return onValue(swarmRef, (snapshot) => {
    const data = snapshot.val();
    callback('users', data || 0);
  });
};