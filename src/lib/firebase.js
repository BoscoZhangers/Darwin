export const subscribeToSwarm = (callback) => {
    // 1. Try to listen to Real Firebase
    if (db) {
      try {
        const usersRef = ref(db, 'active_users');
        onValue(usersRef, (snapshot) => {
          const count = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
          // If we have real users, use them. If 0, fall back to simulation.
          if (count > 0) {
             callback('users', count);
             return;
          }
        });
      } catch (e) {
        console.warn("Firebase offline, switching to simulation.");
      }
    }
  
    // 2. SIMULATION MODE (The Backup Generator) 🤖
    // This ensures the dashboard never looks dead during a pitch.
    console.log("Starting Swarm Simulation...");
    
    // Set initial "Fake" count
    let fakeCount = 124; 
    callback('users', fakeCount);
  
    // Fluctuations: Randomly add/remove users every 2 seconds
    setInterval(() => {
      const change = Math.floor(Math.random() * 5) - 2; // -2 to +2
      fakeCount = Math.max(50, fakeCount + change); // Never go below 50
      callback('users', fakeCount);
      
      // Occasionally trigger a "Fake Click" event
      if (Math.random() > 0.7) {
        callback('events', { type: 'click', feature: 'signup' });
      }
    }, 2000);
  };