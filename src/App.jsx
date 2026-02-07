import React, { useState, useEffect } from 'react';
import { Github, LogOut, Command, Sparkles } from 'lucide-react'; 
import { subscribeToAuth, signInWithGithub, signOut } from './lib/firebase';
import Dashboard from './components/Dashboard';
import RepoSelector from './components/RepoSelector';

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [selectedRepo, setSelectedRepo] = useState(null);

  useEffect(() => {
    return subscribeToAuth((u, t) => {
      setUser(u);
      setToken(t);
    });
  }, []);

  const handleLogin = async () => {
    try {
      const res = await signInWithGithub();
      // If signIn returns a result, set user/token immediately to avoid timing issues
      if (res) {
        setUser(res.user);
        setToken(res.token);
      }
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setUser(null);
    setToken(null);
    setSelectedRepo(null);
  };

  // --- SCENE 1: LOGIN SCREEN (Styled) ---
  if (!user) {
    return (
      <div className="h-screen w-screen bg-[#050505] text-white flex flex-col items-center justify-center relative overflow-hidden font-sans selection:bg-purple-500/30">
        
        {/* Ambient Background Effects */}
        <div className="absolute inset-0 pointer-events-none">
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-900/20 rounded-full blur-[100px]" />
           <div className="absolute top-0 left-0 w-full h-full opacity-20" 
                style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
           </div>
        </div>

        <div className="z-10 flex flex-col items-center gap-8">
          
          {/* Logo Block */}
          <div className="relative group cursor-default">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000"></div>
            <div className="relative w-24 h-24 bg-[#111] rounded-2xl flex items-center justify-center border border-white/10 shadow-2xl">
              <span className="text-5xl font-bold bg-gradient-to-tr from-cyan-400 to-purple-500 bg-clip-text text-transparent">D</span>
            </div>
          </div>

          {/* Title & Tagline */}
          <div className="text-center space-y-2">
             <h1 className="text-6xl font-extrabold tracking-tighter text-white">Darwin</h1>
             <div className="flex items-center justify-center gap-2 text-gray-400 text-sm uppercase tracking-widest">
                <Command size={14} /> 
                <span>Spatial Development Environment</span>
             </div>
          </div>

          {/* Login Button */}
          <button 
            onClick={handleLogin}
            className="group relative mt-4 px-8 py-3.5 bg-white text-black font-bold text-sm rounded-full flex items-center gap-3 transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]"
          >
            <Github size={18} />
            <span>Connect GitHub</span>
            <div className="absolute inset-0 rounded-full border border-black/10" />
          </button>

          {/* Footer Text */}
          <div className="absolute bottom-8 text-xs text-gray-600 flex items-center gap-1.5">
             <Sparkles size={10} /> 
             <span>Powered by React & Gemini 2.0</span>
          </div>

        </div>
      </div>
    );
  }

  // --- SCENE 2: REPO SELECTOR ---
  if (!selectedRepo) {
    return (
      <RepoSelector 
        user={user} 
        token={token} 
        onSelect={setSelectedRepo} 
        onLogout={handleLogout} // Passed the handleLogout wrapper
      />
    );
  }

  // --- SCENE 3: DASHBOARD ---
  return (
    <Dashboard 
      user={user} 
      token={token} 
      repo={selectedRepo} 
      onBack={() => setSelectedRepo(null)} 
    />
  );
}