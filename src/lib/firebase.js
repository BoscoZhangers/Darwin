import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue } from "firebase/database"; // Removed 'set' if unused
import { getAuth, signInWithPopup, GithubAuthProvider, signOut } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  // Add this line below:
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app); 
export const auth = getAuth(app);
const provider = new GithubAuthProvider();

provider.addScope('repo'); 

// --- AUTH FUNCTIONS ---
export const signInWithGithub = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GithubAuthProvider.credentialFromResult(result);
    const token = credential.accessToken;
    const user = result.user;
    return { user, token };
  } catch (error) {
    console.error("Auth Error:", error);
    throw error;
  }
};

export const logout = () => signOut(auth);

// --- SWARM FUNCTIONS ---
export const subscribeToSwarm = (callback, isDemoMode) => {
  if (isDemoMode) {
    return () => {}; 
  }

  // Use the 'db' instance created above
  const countRef = ref(db, 'site_analytics/active_users');
  
  const unsubscribe = onValue(countRef, (snapshot) => {
    const data = snapshot.val() || 0;
    callback('users', data);
  });

  return unsubscribe;
};