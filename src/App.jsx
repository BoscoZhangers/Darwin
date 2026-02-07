import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import RepoSelector from './components/RepoSelector';
import { signInWithGithub, logout } from './lib/firebase';
import { Github } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [repo, setRepo] = useState(null);

  const handleLogin = async () => {
    try {
      const { user, token } = await signInWithGithub();
      setUser(user);
      setToken(token);
    } catch (e) {
      alert("Login Failed: " + e.message);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setRepo(null);
  };

  // 1. NOT LOGGED IN? SHOW LOGIN SCREEN
  if (!user) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#222_0%,#000_100%)]" />
        <div className="z-10 text-center space-y-6">
           <div className="w-20 h-20 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-2xl mx-auto flex items-center justify-center text-4xl font-bold shadow-2xl mb-4">D</div>
           <h1 className="text-5xl font-bold tracking-tighter">Darwin</h1>
           <p className="text-gray-400 max-w-md mx-auto">The spatial interface for your codebase. Visualize, edit, and deploy react components in 3D.</p>
           
           <button 
             onClick={handleLogin}
             className="px-8 py-4 bg-white text-black font-bold rounded-full flex items-center gap-3 mx-auto hover:scale-105 transition-transform hover:shadow-[0_0_20px_white]"
           >
             <Github size={24} /> Sign in with GitHub
           </button>
        </div>
      </div>
    );
  }

  // 2. LOGGED IN BUT NO REPO? SHOW SELECTOR
  if (!repo) {
    return (
      <RepoSelector 
        user={user} 
        token={token} 
        onSelectRepo={setRepo} 
        onLogout={handleLogout} 
      />
    );
  }

  // 3. REPO SELECTED? SHOW DASHBOARD
  return (
    <Dashboard 
      user={user}
      token={token}
      repo={repo}
      onBack={() => setRepo(null)} // Add a back button in dashboard if needed
    />
  );
}