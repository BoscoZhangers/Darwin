import React, { useState, useEffect, useRef } from 'react';
import { Layers, Activity, Zap, Code, Play, Plus, AlertTriangle, GripVertical } from 'lucide-react';
import Scene from './Scene';
import { subscribeToSwarm } from '../lib/firebase';

// --- DRAGGABLE COMPONENT WRAPPER ---
const DraggableItem = ({ label, color, type, children }) => {
  const handleDragStart = (e) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ label, color, type }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div 
      draggable 
      onDragStart={handleDragStart}
      className="cursor-grab active:cursor-grabbing hover:scale-[1.02] transition-transform"
    >
      {children}
    </div>
  );
};

// --- PREVIEW PANEL ---
const LivePreviewPlaceholder = ({ styles, activeFeature, bubbles }) => {
  const isActive = (id) => activeFeature === id;
  const isDropped = (id) => bubbles.some(b => b.id === id);

  return (
    <div className="w-full h-full bg-white relative overflow-y-auto font-sans text-black select-none">
      <div className="absolute top-2 left-2 bg-black/80 text-white text-[10px] px-2 py-1 rounded font-mono z-10">
        LIVE PREVIEW (Drag Items Left!)
      </div>
      
      {/* NAVBAR */}
      <div className={isDropped('navbar') ? 'opacity-50 grayscale' : ''}>
        <DraggableItem label="Navbar" color="#00f3ff" type="navbar">
          <nav 
            style={{ backgroundColor: isActive('navbar') ? '#e0f2fe' : styles.navColor }} 
            className={`p-4 flex justify-between items-center border-b border-gray-200 cursor-grab ${isActive('navbar') ? 'border-l-4 border-neon-blue' : ''}`}
          >
            <div className="font-bold text-xl">Startup.io</div>
            <div className="space-x-4 text-sm opacity-80">
              <span>Product</span>
              <span>Pricing</span>
            </div>
          </nav>
        </DraggableItem>
      </div>

      {/* HERO SECTION */}
      <div className="p-12 text-center">
        <div className={isDropped('hero') ? 'opacity-50 grayscale' : ''}>
          <DraggableItem label="Hero Text" color="#ffa500" type="hero">
             <h1 className="text-5xl font-extrabold mb-6 cursor-grab hover:text-orange-500 transition-colors">Build Faster.</h1>
          </DraggableItem>
        </div>
        
        <p className="text-gray-600 mb-8">The AI-powered platform.</p>
        
        <div className={isDropped('signup') ? 'opacity-50 grayscale' : ''}>
          <DraggableItem label="Signup" color="#bc13fe" type="signup">
            <button 
              style={{ padding: styles.btnPadding, borderRadius: styles.btnRadius }} 
              className={`font-bold shadow-lg text-white transition-all ${isActive('signup') ? 'bg-neon-purple ring-4 ring-purple-200 scale-110' : 'bg-black'}`}
            >
              Get Started
            </button>
          </DraggableItem>
        </div>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const [activeFeature, setActiveFeature] = useState(null);
  const [siteStyles, setSiteStyles] = useState({ navColor: '#f3f4f6', btnPadding: '0.75rem 1.5rem', btnRadius: '0.5rem' });
  const [aiLog, setAiLog] = useState([{ role: 'system', text: 'Darwin System initialized.' }]);
  const [totalUsers, setTotalUsers] = useState(1); 
  const [bubbles, setBubbles] = useState([
    { id: 'signup', position: [5, 1.5, 4], color: '#bc13fe', label: 'Signup', crowdCount: 40 },
  ]);

  // --- RESIZE LOGIC ---
  const [rightPanelWidth, setRightPanelWidth] = useState(450);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      // Calculate new width based on mouse position from right edge
      const newWidth = window.innerWidth - e.clientX;
      // Clamp width: Min 300px, Max 800px
      if (newWidth > 300 && newWidth < 800) {
        setRightPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);


  // --- FIREBASE & LOGIC ---
  const handleRealTimePulse = (data) => console.log("Pulse:", data);

  useEffect(() => {
    try {
        subscribeToSwarm((type, data) => {
            if (type === 'users') setTotalUsers(data);
            if (type === 'events') handleRealTimePulse(data);
        });
    } catch (err) { console.warn("Firebase warning:", err); }
  }, []);

  const handleApplyFix = () => {
    setAiLog(prev => [...prev, { role: 'system', text: 'APPLYING UX PATCH v4.2...' }]);
    setTimeout(() => {
        setSiteStyles({ navColor: '#ffffff', btnPadding: '1.2rem 3rem', btnRadius: '9999px' });
        setBubbles(prev => prev.map(b => {
            if (b.id === 'signup') return { ...b, color: '#10b981', label: 'Converted' }; 
            return b;
        }));
        setAiLog(prev => [...prev, { role: 'success', text: 'OPTIMIZATION COMPLETE. Friction reduced by 85%.' }]);
    }, 1500);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/json');
    if (!data) return;
    const { label, color, type } = JSON.parse(data);
    
    if (bubbles.some(b => b.id === type)) {
        setAiLog(prev => [...prev, { role: 'error', text: `REDUNDANT: '${label}' is already being monitored.` }]);
        return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const worldX = (x - rect.width / 2) * 0.03; 
    const worldZ = (y - rect.height / 2) * 0.03; 

    setBubbles(prev => [...prev, {
      id: type, position: [worldX, 1.5, worldZ], color, label, crowdCount: Math.floor(Math.random() * 20) + 5,
    }]);
    setAiLog(prev => [...prev, { role: 'success', text: `NEW CLUSTER: ${label} added.` }]);
  };

  return (
    // Add cursor-col-resize when resizing so the cursor doesn't flicker
    <div className={`h-screen w-screen bg-tech-black text-white flex overflow-hidden font-sans ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
      
      {/* Sidebar */}
      <div className="w-16 border-r border-white/10 flex flex-col items-center py-6 gap-6 z-20 bg-tech-black/50 backdrop-blur">
        <div className="w-10 h-10 bg-gradient-to-tr from-neon-blue to-neon-purple rounded-lg flex items-center justify-center font-bold text-xl">D</div>
        <div className="flex flex-col gap-4 mt-4">
            <Layers className="text-neon-blue" />
            <Activity className="text-gray-500" />
        </div>
        <button onClick={() => window.location.reload()} className="p-3 hover:bg-red-500/20 rounded-xl text-red-500 transition-colors mt-auto mb-6">
            <Activity size={20} className="rotate-180" /> 
        </button>
      </div>

      {/* --- 3D DROP ZONE (Takes Remaining Space) --- */}
      <div 
        className="flex-1 relative bg-gradient-to-b from-tech-black to-tech-gray min-w-0"
        onDragOver={(e) => e.preventDefault()} 
        onDrop={handleDrop}
      >
        <div className="absolute top-4 left-4 z-10 pointer-events-none">
          <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Active Swarm</h2>
          <div className="text-3xl font-mono text-neon-blue animate-pulse">
             {totalUsers > 0 ? totalUsers : 'CONNECTING...'} 
          </div>
        </div>
        {/* We disable pointer events on the canvas WHILE resizing to prevent lag/swallowing events */}
        <div className={`w-full h-full ${isResizing ? 'pointer-events-none' : ''}`}>
           <Scene bubbles={bubbles} activeId={activeFeature} setActiveId={setActiveFeature} />
        </div>
      </div>

      {/* --- RESIZER HANDLE --- */}
      <div 
        onMouseDown={() => setIsResizing(true)}
        className={`w-1 cursor-col-resize z-50 flex items-center justify-center transition-colors
          ${isResizing ? 'bg-neon-blue' : 'bg-white/10 hover:bg-neon-blue'}
        `}
      >
         {/* Little Grip Icon for affordance */}
         <div className="h-8 w-1 bg-white/20 rounded-full" />
      </div>

      {/* --- RIGHT PANEL (Dynamic Width) --- */}
      <div 
        style={{ width: rightPanelWidth }}
        className="flex flex-col bg-tech-gray shadow-2xl z-20 border-l border-white/10 shrink-0"
      >
        <div className="h-[55%] border-b border-white/10 relative">
          <LivePreviewPlaceholder styles={siteStyles} activeFeature={activeFeature} bubbles={bubbles} />
        </div>
        <div className="h-[45%] flex flex-col bg-black/40 backdrop-blur">
           <div className="p-3 border-b border-white/10 flex gap-2 items-center bg-white/5">
             <Zap className="text-yellow-400 w-4 h-4" /> 
             <span className="text-xs text-yellow-400 font-mono">GEMINI AGENT</span>
           </div>
           <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-3">
            {aiLog.map((log, i) => (
                <div key={i} className={`p-2 rounded border-l-2 ${
                    log.role === 'success' ? 'border-green-500 bg-green-900/20 text-green-400' : 
                    log.role === 'error' ? 'border-red-500 bg-red-900/20 text-red-400' :
                    'border-gray-600 bg-white/5 text-gray-400'
                }`}>
                    {log.role === 'error' && <AlertTriangle size={12} className="inline mr-2 mb-0.5" />}
                    {log.text}
                </div>
            ))}
           </div>
           <div className="p-4 border-t border-white/10 bg-black/20">
            <button 
              onClick={handleApplyFix}
              className="w-full bg-gradient-to-r from-neon-blue to-neon-purple text-white font-bold py-4 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-[0_0_20px_rgba(188,19,254,0.3)]"
            >
              <Play size={16} fill="white" /> AUTO-OPTIMIZE SITE
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}