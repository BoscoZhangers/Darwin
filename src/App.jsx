import React, { useState, useEffect } from 'react';
import { Github, LogOut, Command, Heart, Sparkles } from 'lucide-react'; 
import { subscribeToAuth, signInWithGithub, signOut } from './lib/firebase';
import Dashboard from './components/Dashboard';
import RepoSelector from './components/RepoSelector';
import { Analytics } from "@vercel/analytics/next"

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

  const GeminiLogo = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-opacity">
      <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="white" />
    </svg>
  );

  const CSSLogo = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-opacity">
      <path d="M5 3L4.35 6.15H17.65L17.1 9.15H4.1L3.45 12.3H16.45L15.65 16.35L10 18L4.35 16.35L4.7 14.65H1.55L0.75 19.35L10 22.15L19.25 19.35L21.25 3H5Z" fill="#1572B6" />
    </svg>
  );

  const techStack = [
    { name: "Gemini", logo: <GeminiLogo /> },
    { name: "React", logo: <img src="https://cdn.simpleicons.org/react/61DAFB" className="w-4 h-4" /> },
    { name: "Tailwind", logo: <img src="https://cdn.simpleicons.org/tailwindcss/06B6D4" className="w-4 h-4" /> },
    { name: "JavaScript", logo: <img src="https://cdn.simpleicons.org/javascript/F7DF1E" className="w-4 h-4" /> },
    { name: "CSS", logo: <CSSLogo /> },
    { name: "Python", logo: <img src="https://cdn.simpleicons.org/python/3776AB" className="w-4 h-4" /> },
    { name: "Three.js", logo: <img src="https://cdn.simpleicons.org/three.js/ffffff" className="w-4 h-4" /> },
    { name: "PyTorch", logo: <img src="https://cdn.simpleicons.org/pytorch/EE4C2C" className="w-4 h-4" /> },
    { name: "FastAPI", logo: <img src="https://cdn.simpleicons.org/fastapi/05998B" className="w-4 h-4" /> },
    { name: "Firebase", logo: <img src="https://cdn.simpleicons.org/firebase/FFCA28" className="w-4 h-4" /> },
  ];

  if (!user) {
    return (
      <div className="h-screen w-screen bg-[#050505] text-white flex flex-col items-center justify-center relative overflow-hidden font-sans selection:bg-purple-500/30">
        
        <style>
          {`
            @keyframes marquee {
              from { transform: translateX(0); }
              to { transform: translateX(-50%); }
            }
            @keyframes pulse-glow {
              0%, 100% { 
                transform: scale(1); 
                filter: blur(20px); 
                opacity: 0.8; 
              }
              50% { 
                transform: scale(1.15); 
                filter: blur(28px); 
                opacity: 1; 
              }
            }
            .animate-marquee {
              display: flex;
              width: max-content;
              animation: marquee 30s linear infinite;
            }
            .animate-pulse-glow {
              animation: pulse-glow 4s ease-in-out infinite;
            }
            .conveyor-spotlight {
              mask-image: radial-gradient(circle at center, black 0%, rgba(0,0,0,0.4) 40%, transparent 100%), 
                          linear-gradient(to right, transparent, black 20%, black 80%, transparent);
              mask-composite: intersect;
              -webkit-mask-image: radial-gradient(circle at center, black 0%, rgba(0,0,0,0.4) 40%, transparent 100%), 
                                  linear-gradient(to right, transparent, black 20%, black 80%, transparent);
              -webkit-mask-composite: source-in;
            }
          `}
        </style>

        <div className="absolute inset-0 pointer-events-none">
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-900/20 rounded-full blur-[100px]" />
           <div className="absolute top-0 left-0 w-full h-full opacity-20" 
                style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
           </div>
        </div>

        <div className="z-10 flex flex-col items-center gap-8">
          <div className="relative group cursor-default">
            {/* Pulsing Outer Glow */}
            <div className="absolute -inset-2 bg-gradient-to-r from-cyan-400 to-purple-600 rounded-2xl animate-pulse-glow shadow-[0_0_35px_rgba(34,211,238,0.5)]"></div>
            
            {/* Static Sharp Inner Glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 to-purple-600 rounded-2xl blur-md opacity-80"></div>

            <div className="relative w-24 h-24 bg-[#111] rounded-2xl flex items-center justify-center border border-white/20 shadow-2xl">
              <span className="text-5xl font-bold bg-gradient-to-tr from-cyan-400 to-purple-500 bg-clip-text text-transparent">D</span>
            </div>
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-6xl font-extrabold tracking-[0.06em] text-white mr-[-0.2em]">Darwin</h1>
            <div className="flex items-center justify-center gap-2 text-gray-400 text-sm uppercase tracking-widest">
                <Command size={14} /> 
                <span>UI Development Reimagined</span>
            </div>
          </div>

          <button onClick={handleLogin} className="group relative mt-4 px-8 py-3.5 bg-white text-black font-bold text-sm rounded-full flex items-center gap-3 transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]">
            <Github size={18} />
            <span>Connect GitHub</span>
            <div className="absolute inset-0 rounded-full border border-black/10" />
          </button>
        </div>

        <div className="absolute bottom-0 w-full py-8 overflow-hidden">
          <div className="flex items-center justify-center gap-2 text-[10px] text-gray-500 uppercase tracking-[0.3em] mb-4 opacity-50">
            <Sparkles size={10} />
            <span className="flex items-center gap-1.5">
              Built with 
              <Heart size={10} className="text-red-500 fill-red-500 animate-pulse" /> 
              Using
            </span>
          </div>
          
          <div className="conveyor-spotlight relative flex overflow-hidden">
            <div className="animate-marquee whitespace-nowrap flex items-center">
              {[...techStack, ...techStack].map((tech, i) => (
                <div key={i} className="flex items-center gap-3 mx-10 group cursor-default">
                  <div className="w-4 h-4 flex items-center justify-center object-contain">
                    {tech.logo}
                  </div>
                  <span className="text-xs font-bold text-white transition-colors">
                    {tech.name}
                  </span>
                  <div className="ml-10 w-1 h-1 bg-white/10 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedRepo) return <RepoSelector user={user} token={token} onSelect={setSelectedRepo} onLogout={handleLogout} />;
  return <Dashboard user={user} token={token} repo={selectedRepo} onBack={() => setSelectedRepo(null)} />;
}