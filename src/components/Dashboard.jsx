import React, { useState, useEffect, useRef } from 'react';
import { Layers, Activity, Zap, Play, AlertTriangle, Shapes, Trash2, Code, Github, FileCode, ChevronRight, ChevronDown, Eye, EyeOff, Lock, GitCommit, Move, GripHorizontal } from 'lucide-react';
import Scene from './Scene';
import { subscribeToSwarm } from '../lib/firebase';
import { APP_HOST, PORT } from '../constants';

// --- INITIAL DATA ---
const INITIAL_LAYOUT = [
  { id: 'nav-1', type: 'navbar', x: 0, y: 0, w: 450, h: 64, props: { color: '#ffffff', title: 'Startup.io' } },
  { id: 'hero-1', type: 'text', x: 40, y: 140, w: 350, h: 100, props: { text: 'Build Faster.', fontSize: '3.5rem', color: '#000' } },
  { id: 'btn-1', type: 'button', x: 40, y: 240, w: 140, h: 48, props: { text: 'Get Started', bg: '#000', radius: '8px' } }
];

// --- CANVAS ELEMENT ---
const CanvasElement = ({ item, isLocked, onUpdatePosition }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    if (isLocked) return; 
    e.preventDefault(); 
    setIsDragging(true);
    setDragOffset({ x: e.clientX - item.x, y: e.clientY - item.y });
  };

  const handleDragStart = (e) => {
    if (!isLocked) { e.preventDefault(); return; }
    const dragPayload = {
      label: item.props.title || item.props.text || 'Component',
      color: item.type === 'button' ? '#bc13fe' : item.type === 'navbar' ? '#00f3ff' : '#ffa500', 
      type: item.id
    };
    e.dataTransfer.setData('application/json', JSON.stringify(dragPayload));
    e.dataTransfer.effectAllowed = 'copy';
  };

  useEffect(() => {
    const handleMouseMove = (e) => { if (isDragging) onUpdatePosition(item.id, e.clientX - dragOffset.x, e.clientY - dragOffset.y); };
    const handleMouseUp = () => setIsDragging(false);
    if (isDragging) { window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp); }
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isDragging, dragOffset, item.id, onUpdatePosition]);

  const renderContent = () => {
    switch(item.type) {
      case 'navbar':
        return (
          <nav style={{ backgroundColor: item.props.color, width: '100%', height: '100%' }} className="flex items-center justify-between px-6 border-b border-black/5 shadow-sm select-none pointer-events-none">
             <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-gradient-to-br from-neon-blue to-neon-purple rounded-md shadow-sm"></div>
                <span className="font-bold text-gray-900 tracking-tight">{item.props.title}</span>
             </div>
             <div className="flex items-center gap-6 text-[11px] font-medium text-gray-500">
                <span>Product</span><span>Pricing</span><span>Login</span>
             </div>
          </nav>
        );
      case 'text': return <h1 style={{ fontSize: item.props.fontSize, color: item.props.color, lineHeight: 1 }} className="font-extrabold cursor-default select-none whitespace-nowrap pointer-events-none">{item.props.text}</h1>;
      case 'button': return <button style={{ backgroundColor: item.props.bg, borderRadius: item.props.radius, width: '100%', height: '100%' }} className="text-white font-bold shadow-lg flex items-center justify-center text-xs whitespace-nowrap pointer-events-none">{item.props.text}</button>;
      default: return null;
    }
  };

  return (
    <div
      draggable={isLocked}
      onDragStart={handleDragStart}
      onMouseDown={handleMouseDown}
      style={{ position: 'absolute', left: item.x, top: item.y, width: item.w, height: item.h, cursor: isLocked ? 'grab' : (isDragging ? 'grabbing' : 'move'), zIndex: isDragging ? 50 : 10 }}
      className={`group ${!isLocked ? 'hover:ring-1 hover:ring-neon-blue' : 'hover:scale-[1.02] active:scale-95 transition-transform'}`}
    >
      {!isLocked && <div className="absolute -top-3 -left-3 bg-neon-blue text-black p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-50"><Move size={8} /></div>}
      {isLocked && <div className="absolute -top-3 -left-3 bg-black text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-50 border border-white/20"><GripHorizontal size={8} /></div>}
      {renderContent()}
    </div>
  );
};

// --- PREVIEW PANEL ---
const CanvasPreview = ({ layout, onUpdateLayout, activeFeature, bubbles, demoMode, onCommit }) => {
  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] border-l border-white/10">
      <div className={`h-12 flex items-center justify-between px-4 shrink-0 transition-colors duration-300 ${demoMode ? 'bg-neon-blue text-black' : 'bg-red-600 text-white'}`}>
        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase select-none">
           {demoMode ? <Shapes size={14} /> : <Lock size={14} />}
           {demoMode ? 'Freeform Canvas' : 'Live Production'}
        </div>
        <div>{demoMode ? <button onClick={onCommit} className="flex items-center gap-2 px-3 py-1.5 bg-black/10 hover:bg-black/20 text-black rounded text-[10px] font-bold transition-all border border-black/5"><GitCommit size={12} /> COMMIT CHANGES</button> : <div className="flex items-center gap-2 px-3 py-1.5 bg-black/20 text-white rounded text-[10px] font-bold border border-white/10"><Lock size={12} /> READ ONLY</div>}</div>
      </div>
      <div className="flex-1 bg-white overflow-hidden relative shadow-inner">
        {demoMode && <div className="absolute inset-0 pointer-events-none opacity-10" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }} />}
        {layout.map((item) => <CanvasElement key={item.id} item={item} isLocked={!demoMode} onUpdatePosition={onUpdateLayout} />)}
      </div>
    </div>
  );
};

// --- VS CODE ---
const PROJECT_FILES = { 'site_config.json': `{\n  "theme": "dark",\n  "layout": "absolute",\n  "components": [\n    { "id": "nav", "x": 0, "y": 0 },\n    { "id": "hero", "x": 40, "y": 100 }\n  ]\n}`, 'App.jsx': `// Now rendering from JSON config\nimport Layout from './layout';\n\nexport default function App() {\n  return <Layout config={siteConfig} />;\n}` };
const FullCodeEditor = ({ isConnected, onConnect }) => {
  const [activeFile, setActiveFile] = useState('site_config.json');
  if (!isConnected) return <div className="w-full h-full bg-[#1e1e1e] flex flex-col items-center justify-center text-gray-400 font-mono"><button onClick={onConnect} className="px-8 py-3 bg-[#238636] hover:bg-[#2ea043] text-white font-bold rounded-md flex items-center gap-2 transition-all mt-4"><Github size={20} /> Connect Main Branch</button></div>;
  return <div className="w-full h-full bg-[#1e1e1e] flex font-mono text-sm overflow-hidden"><div className="w-64 bg-[#252526] border-r border-black/50 flex flex-col shrink-0"><div className="p-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Explorer</div><div className="flex-1 overflow-y-auto px-2"><div className="cursor-pointer text-gray-300"><div className="pl-2 border-l border-white/5 ml-2">{Object.keys(PROJECT_FILES).map(file => (<div key={file} onClick={() => setActiveFile(file)} className={`flex items-center gap-1 py-1 cursor-pointer ${activeFile === file ? 'bg-[#37373d] text-white' : 'hover:bg-[#2a2d2e] text-gray-400'}`}><FileCode size={14} /> {file}</div>))}</div></div></div></div><div className="flex-1 flex flex-col min-w-0"><div className="bg-[#2d2d2d] flex overflow-x-auto"><div className="px-4 py-2 bg-[#1e1e1e] border-t-2 border-neon-blue text-white flex items-center gap-2 min-w-[120px]"><FileCode size={14} className="text-react-blue" /> {activeFile}</div></div><div className="flex-1 p-4 overflow-auto text-gray-300"><pre className="font-mono"><code>{PROJECT_FILES[activeFile]}</code></pre></div></div></div>;
};

// --- MAIN DASHBOARD ---
export default function Dashboard() {
  const [viewMode, setViewMode] = useState('simulation'); 
  const [isConnected, setIsConnected] = useState(false);
  const [activeFeature, setActiveFeature] = useState(null); 
  
  // START EMPTY (Grey Crowd only)
  const [bubbles, setBubbles] = useState([]); 
  
  const [totalUsers, setTotalUsers] = useState(0);
  const [aiLog, setAiLog] = useState([{ role: 'system', text: 'Darwin System initialized.' }]);
  const [demoMode, setDemoMode] = useState(true);
  const [showProperties, setShowProperties] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(0);
  const [rightPanelWidth, setRightPanelWidth] = useState(450);
  const [isResizing, setIsResizing] = useState(false);
  const [numUsers, setNumUsers] = useState({});
  const [liveLayout, setLiveLayout] = useState(INITIAL_LAYOUT);
  const [demoLayout, setDemoLayout] = useState(INITIAL_LAYOUT);

  const handleUpdateDemoLayout = (id, newX, newY) => {
    
    setDemoLayout(prev => prev.map(item => item.id === id ? { ...item, x: newX, y: newY } : item)); 
  
    console.log("Updating position...")

    const fetchBackendCount = async () => {
      console.log("Calling backend")
      try {
        const resp = await fetch(APP_HOST + PORT + '/api/get_hit_count', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ x: 0, y: 0, div_id: id })
        });
        if (!resp.ok) return;
        const json = await resp.json();
        console.log("Got", json.count)
        if (mounted && typeof json?.count === 'number') 
          setBubbles(prevBubbles =>
            prevBubbles.map(bubble =>
              bubble.id === id ? { ...bubble, count : json?.count} : 
              bubble 
            )
          )
        console.log(bubbles);
      } catch (e) {
        // ignore network errors during development
      }
    };

    if (demoMode) {
      fetchBackendCount();
      // intervalId = setInterval(fetchBackendCount, 1500);
    } 
  };

  const handleCommit = () => { setAiLog(prev => [...prev, { role: 'system', text: 'Pushing changes to production...' }]); setTimeout(() => { setLiveLayout([...demoLayout]); setAiLog(prev => [...prev, { role: 'success', text: 'DEPLOYMENT SUCCESSFUL: Live Updated.' }]); }, 1500); };
  
  const handleApplyFix = () => { 
    setAiLog(prev => [...prev, { role: 'system', text: 'APPLYING UX PATCH v4.2...' }]);
    setTimeout(() => {
        setBubbles(prev => prev.map(b => b.id === 'btn-1' ? { ...b, color: '#10b981', label: 'Converted' } : b));
        setDemoLayout(prev => prev.map(item => item.type === 'button' ? { ...item, y: 200, props: { ...item.props, bg: '#10b981', text: 'Converted!', radius: '99px' } } : item));
        setAiLog(prev => [...prev, { role: 'success', text: 'OPTIMIZATION COMPLETE. (Commit to Live)' }]);
    }, 1500);
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/json');
    if (!data) return;
    const parsed = JSON.parse(data);
    if (parsed.label) {
        const { label, color, type } = parsed;
        if (bubbles.some(b => b.id === type)) { setAiLog(prev => [...prev, { role: 'error', text: `REDUNDANT: '${label}' is already being monitored.` }]); return; }
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const worldX = (x - rect.width / 2) * 0.03; 
        const worldZ = (y - rect.height / 2) * 0.03; 
        
        // Start with 0 clicks when dropped
        setBubbles(prev => [...prev, { id: type, position: [worldX, 1.5, worldZ], color, label, visible: true, count: 0 }]);
        setAiLog(prev => [...prev, { role: 'success', text: `MONITORING: ${label} added to 3D view.` }]);
    }
  };

  useEffect(() => { const h = (e) => { if (isResizing) setRightPanelWidth(window.innerWidth - e.clientX); }; const u = () => setIsResizing(false); if (isResizing) { window.addEventListener('mousemove', h); window.addEventListener('mouseup', u); } return () => { window.removeEventListener('mousemove', h); window.removeEventListener('mouseup', u); }; }, [isResizing]);
  const toggleProperties = () => { if (showProperties) { setShowProperties(false); setLeftPanelWidth(0); } else { setShowProperties(true); setLeftPanelWidth(250); } };
  const toggleVisibility = (id) => { setBubbles(prev => prev.map(b => b.id === id ? { ...b, visible: !b.visible } : b)); };
  const handleConnect = () => { setAiLog(prev => [...prev, { role: 'system', text: 'Connecting Repo...' }]); setTimeout(() => setIsConnected(true), 1000); };
  
  useEffect(() => { try { subscribeToSwarm((type, data) => { if (type === 'users') setTotalUsers(data); }, demoMode); } catch (e) {} }, [demoMode]);

  // --- TRAFFIC SIMULATION (Click Distribution) ---
  useEffect(() => {
    if (!demoMode) return;
    const interval = setInterval(() => {
       setBubbles(prevBubbles => {
          if (prevBubbles.length === 0) return [];
          return prevBubbles.map(b => {
             // Randomly fluctuate click counts
             const change = Math.floor(Math.random() * 5) - 2; // -2 to +2 change
             let newCount = (b.count || 0) + change;
             if (newCount < 0) newCount = 0;
             if (newCount > 50) newCount = 50; // Cap per feature
             return { ...b, count: newCount };
          });
       });
    }, 1000);
    return () => clearInterval(interval);
  }, [demoMode]);

  return (
    <div className={`h-screen w-screen bg-tech-black text-white flex overflow-hidden font-sans ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
      <div className="w-16 border-r border-white/10 flex flex-col items-center py-6 gap-6 z-30 bg-tech-black/90 backdrop-blur shrink-0">
        <div className="w-10 h-10 bg-gradient-to-tr from-neon-blue to-neon-purple rounded-lg flex items-center justify-center font-bold text-xl">D</div>
        <div className="flex flex-col gap-4 mt-4 w-full px-2"><button onClick={() => setViewMode('simulation')} className={`p-3 rounded-xl transition-all ${viewMode === 'simulation' ? 'bg-neon-blue text-black shadow-[0_0_15px_rgba(0,243,255,0.5)]' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}><Layers size={20} /></button><button onClick={() => setViewMode('code')} className={`p-3 rounded-xl transition-all ${viewMode === 'code' ? 'bg-neon-purple text-white shadow-[0_0_15px_rgba(188,19,254,0.5)]' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}><Code size={20} /></button><button onClick={toggleProperties} className={`p-3 rounded-xl transition-all ${showProperties ? 'bg-white/20 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}><Shapes size={20} /></button></div>
        <div className="mt-auto flex flex-col gap-4 items-center w-full px-2"><button onClick={() => window.location.reload()} className="p-3 hover:bg-red-500/20 rounded-xl text-red-500 transition-colors"><Activity size={20} className="rotate-180" /></button></div>
      </div>
      <div style={{ width: leftPanelWidth }} className="bg-black/90 border-r border-white/10 backdrop-blur-xl z-20 transition-all duration-300 ease-out overflow-hidden flex flex-col shrink-0"><div className="p-4 border-b border-white/10 font-bold text-xs text-gray-400 uppercase">Properties</div><div className="flex-1 overflow-y-auto p-2 space-y-2">{bubbles.map(b => (<div key={b.id} className="bg-white/5 rounded-lg p-3 border border-white/5 flex items-center justify-between"><div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full transition-all ${b.visible ? '' : 'opacity-20'}`} style={{ backgroundColor: b.color }} /><span className={`text-sm font-bold ${b.visible ? 'text-white' : 'text-gray-500'}`}>{b.label}</span></div><div className="flex items-center gap-1"><button onClick={() => toggleVisibility(b.id)} className="p-2 text-gray-500 hover:text-white transition-colors">{b.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button><button onClick={() => setBubbles(prev => prev.filter(x => x.id !== b.id))} className="p-2 text-gray-500 hover:text-red-400 transition-colors"><Trash2 size={14}/></button></div></div>))}</div></div>
      <div className={`flex-1 relative bg-gradient-to-b from-tech-black to-tech-gray min-w-0 flex flex-col ${isResizing ? 'pointer-events-none' : ''}`} onDrop={handleDrop} onDragOver={e => e.preventDefault()}>
        {viewMode === 'simulation' && (<div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-start pointer-events-none"><div><h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Active Swarm</h2><div className="text-3xl font-mono text-neon-blue animate-pulse">{totalUsers > 0 ? totalUsers : 'CONNECTING...'}</div></div><div className="pointer-events-auto bg-black/50 backdrop-blur rounded-full p-1 border border-white/10 flex items-center gap-2"><button onClick={() => setDemoMode(true)} className={`px-4 py-1 rounded-full text-xs font-bold transition-all ${demoMode ? 'bg-neon-blue text-black' : 'text-gray-400'}`}>DEMO</button><button onClick={() => setDemoMode(false)} className={`px-4 py-1 rounded-full text-xs font-bold transition-all ${!demoMode ? 'bg-red-500 text-white' : 'text-gray-400'}`}>LIVE</button></div></div>)}
        <div className="flex-1 relative overflow-hidden">{viewMode === 'simulation' ? <Scene bubbles={bubbles} activeId={activeFeature} setActiveId={setActiveFeature} /> : <FullCodeEditor isConnected={isConnected} onConnect={handleConnect} />}</div>
      </div>
      <div onMouseDown={() => setIsResizing(true)} className={`w-1 cursor-col-resize z-50 flex items-center justify-center transition-colors ${isResizing ? 'bg-neon-blue' : 'bg-white/5 hover:bg-neon-blue'}`}><div className="h-8 w-1 bg-white/20 rounded-full" /></div>
      <div style={{ width: rightPanelWidth }} className="flex flex-col bg-tech-gray shadow-2xl z-20 shrink-0 border-l border-white/10">
         <div className="h-[60%] relative overflow-hidden"><CanvasPreview layout={demoMode ? demoLayout : liveLayout} onUpdateLayout={handleUpdateDemoLayout} activeFeature={activeFeature} bubbles={bubbles} demoMode={demoMode} onCommit={handleCommit} /></div>
         <div className="h-[40%] flex flex-col bg-black/40 backdrop-blur border-t border-white/10"><div className="p-3 border-b border-white/10 flex gap-2 items-center bg-white/5"><Zap className="text-yellow-400 w-4 h-4" /> <span className="text-xs text-yellow-400 font-mono">GEMINI AGENT</span></div><div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-2">{aiLog.map((log, i) => (<div key={i} className={`p-2 rounded border-l-2 ${log.role === 'success' ? 'border-green-500 bg-green-900/20 text-green-400' : log.role === 'error' ? 'border-red-500 bg-red-900/20 text-red-400' : 'border-gray-600 bg-white/5 text-gray-400'}`}>{log.role === 'error' && <AlertTriangle size={12} className="inline mr-2 mb-0.5" />}{log.text}</div>))}</div><div className="p-4 border-t border-white/10 bg-black/20"><button onClick={handleApplyFix} disabled={!demoMode} className={`w-full font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all ${demoMode ? 'bg-gradient-to-r from-neon-blue to-neon-purple text-white hover:opacity-90 shadow-[0_0_20px_rgba(188,19,254,0.3)]' : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5'}`}>{demoMode ? <Play size={16} fill="white" /> : <Lock size={16} />} {demoMode ? 'AUTO-OPTIMIZE' : 'OPTIMIZATION LOCKED'}</button></div></div>
      </div>
    </div>
  );
}