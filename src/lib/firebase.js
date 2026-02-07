import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, onDisconnect, set, push, serverTimestamp } from "firebase/database";

// --- CONFIGURATION ---
// In a real app, these would come from an environment variable or user input.
const firebaseConfig = {
  // Paste your REAL config here if you want Live Mode to actually work
  apiKey: "AIzaSy...", 
  authDomain: "hackathon.firebaseapp.com",
  databaseURL: "https://hackathon-default-rtdb.firebaseio.com",
};

let db;
try {
  const app = initializeApp(firebaseConfig);
  db = getDatabase(app);
} catch (e) {
  console.warn("Firebase not connected (Demo Mode Only).");
}

// --- HYBRID SUBSCRIPTION ---
let simulationInterval;

export const subscribeToSwarm = (callback, demoMode = true) => {
  // 1. CLEANUP: Stop any previous listeners
  if (simulationInterval) clearInterval(simulationInterval);

  // 2. DEMO MODE (Synthesized Data) 🤖
  if (demoMode) {
    console.log("Switched to DEMO MODE");
    let fakeCount = 124;
    
    // Immediate initial data
    callback('users', fakeCount);

    simulationInterval = setInterval(() => {
      // Fluctuate users
      const change = Math.floor(Math.random() * 5) - 2;
      fakeCount = Math.max(50, fakeCount + change);
      callback('users', fakeCount);

      // Random fake clicks
      if (Math.random() > 0.6) {
        callback('events', { type: 'click', feature: 'signup' });
      }
    }, 1500);
    return;
  }

  // 3. LIVE MODE (Real Data) 🔴
  console.log("Switched to LIVE MODE");
  if (!db) {
    console.error("No Firebase Config found!");
    return;
  }

  const usersRef = ref(db, 'active_users');
  onValue(usersRef, (snapshot) => {
    const count = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
    callback('users', count);
  });
  
  // Real events listener would go here...
};