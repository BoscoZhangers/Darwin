import React, { useState, useEffect, useRef } from 'react';
import { Octokit } from "@octokit/rest"; 
import { Layers, Activity, Zap, Play, AlertTriangle, Shapes, Trash2, Code, Github, FileCode, ChevronRight, ChevronDown, Eye, EyeOff, Lock, GitCommit, Move, GripHorizontal, ArrowLeft, RotateCcw, MousePointer2, Globe } from 'lucide-react';
import Scene from './Scene';
import { subscribeToSwarm } from '../lib/firebase';

// --- THE ROBUST ENGINE (Indexed Logic) ---
const IframeRenderer = ({ code, onUpdateCode }) => {
  const iframeRef = useRef(null);

  // 1. LISTEN FOR DRAG EVENTS
  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data.type === 'UPDATE_POS') {
        const { index, x, y } = e.data;

        // SMART REWRITE: Only update the specific element by index
        let matchCount = 0;
        
        // We scan the code for tags. When we find the Nth tag (matching the index),
        // we strictly update that specific string match.
        const newCode = code.replace(
          /<(nav|button|h1|div)\b([^>]*)>/g, 
          (fullMatch, tag, props) => {
            if (matchCount === index) {
               // FOUND IT! This is the element user dragged.
               let newProps = props;
               
               // Regex to update Left
               if (newProps.match(/left:\s*\d+/)) {
                 newProps = newProps.replace(/left:\s*(\d+)/, `left: ${Math.round(x)}`);
               }
               
               // Regex to update Top
               if (newProps.match(/top:\s*\d+/)) {
                 newProps = newProps.replace(/top:\s*(\d+)/, `top: ${Math.round(y)}`);
               }

               matchCount++;
               return `<${tag}${newProps}>`;
            }
            matchCount++;
            return fullMatch; // Return other elements unchanged
          }
        );

        onUpdateCode(newCode);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [code, onUpdateCode]);

  // 2. PREPARE THE CODE
  // We inject a unique `_darwinIndex` into every element so we can track it.
  const prepareTransformedCode = () => {
    try {
      let count = 0;
      return code
        .replace(/import.*?;/g, '')
        .replace(/export default function/, 'function')
        .replace(/export default/, '')
        // Inject Index: <div ...> -> <InteractiveElement _tag="div" _darwinIndex={0} ...>
        .replace(
          /<(nav|button|h1|div)\b([^>]*)>/g, 
          (match, tag, props) => {
             const currentIndex = count++;
             return `<InteractiveElement _tag="${tag}" _darwinIndex={${currentIndex}}${props}>`;
          }
        )
        .replace(
          /<\/(nav|button|h1|div)>/g, 
          '</InteractiveElement>'
        );
    } catch (e) {
      return "";
    }
  };

  const transformedCode = prepareTransformedCode();

  // 3. CONSTRUCT THE RUNTIME HARNESS
  const srcDoc = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
        <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
        <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
        <style>
          body { margin: 0; overflow: hidden; background: #fff; }
          .darwin-draggable:hover { outline: 2px solid #00f3ff; cursor: grab; z-index: 1000; }
          .darwin-draggable:active { outline: 2px solid #bc13fe; cursor: grabbing; }
        </style>
      </head>
      <body>
        <div id="root"></div>
        <script type="text/babel">
          const { useState, useEffect, useRef } = React;

          const InteractiveElement = ({ _tag: Tag, _darwinIndex, children, style, ...props }) => {
            
            const isAbsolute = style && style.position === 'absolute';
            
            // If not absolute, render normally
            if (!isAbsolute) {
               return <Tag style={style} {...props}>{children}</Tag>;
            }

            // Drag Logic
            const [pos, setPos] = useState({ 
              x: parseInt(style.left || 0), 
              y: parseInt(style.top || 0) 
            });
            const [isDragging, setIsDragging] = useState(false);
            const dragOffset = useRef({ x: 0, y: 0 });

            const handleMouseDown = (e) => {
              e.stopPropagation();
              setIsDragging(true);
              dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
            };

            useEffect(() => {
              if (!isDragging) return;
              
              const handleMove = (e) => {
                setPos({
                  x: e.clientX - dragOffset.current.x,
                  y: e.clientY - dragOffset.current.y
                });
              };
              
              const handleUp = () => {
                setIsDragging(false);
                // Send INDEX back to Dashboard so we know WHICH element moved
                window.parent.postMessage({ 
                  type: 'UPDATE_POS', 
                  index: _darwinIndex,
                  x: pos.x, 
                  y: pos.y
                }, '*');
              };

              window.addEventListener('mousemove', handleMove);
              window.addEventListener('mouseup', handleUp);
              return () => {
                window.removeEventListener('mousemove', handleMove);
                window.removeEventListener('mouseup', handleUp);
              };
            }, [isDragging, pos]);

            return (
              <Tag 
                style={{ ...style, left: pos.x, top: pos.y }} 
                className={(props.className || '') + ' darwin-draggable'}
                onMouseDown={handleMouseDown}
                {...props}
              >
                {children}
              </Tag>
            );
          };

          // --- EXECUTE ---
          try {
            ${transformedCode}
            const root = ReactDOM.createRoot(document.getElementById('root'));
            root.render(<App />);
          } catch (err) {
            document.body.innerHTML = '<div style="color:red; font-family:monospace; padding:20px">Preview Error: ' + err.message + '</div>';
          }
        </script>
      </body>
    </html>
  `;

  return (
    <iframe 
      ref={iframeRef}
      srcDoc={srcDoc}
      title="Live Preview"
      className="w-full h-full border-none bg-white"
      sandbox="allow-scripts allow-same-origin"
    />
  );
};

// --- PREVIEW PANEL ---
const CanvasPreview = ({ code, onUpdateCode, demoMode, onCommit, isCommitting, productionUrl, setProductionUrl }) => {
  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] border-l border-white/10">
      <div className={`h-12 flex items-center justify-between px-4 shrink-0 transition-colors duration-300 ${demoMode ? 'bg-neon-blue text-black' : 'bg-red-600 text-white'}`}>
        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase select-none">
           {demoMode ? <Shapes size={14} /> : <Globe size={14} />}
           {demoMode ? 'Live Editor (Drag Enabled)' : 'Live Production'}
        </div>
        <div>
           {demoMode ? (
             <button 
               onClick={onCommit} 
               disabled={isCommitting}
               className="flex items-center gap-2 px-3 py-1.5 bg-black/10 hover:bg-black/20 text-black rounded text-[10px] font-bold border border-black/5"
             >
                <GitCommit size={12} /> {isCommitting ? 'PUSHING...' : 'COMMIT'}
             </button>
           ) : (
             <div className="text-[10px] font-bold bg-black/20 px-2 py-1 rounded">READ ONLY</div>
           )}
        </div>
      </div>

      <div className="flex-1 bg-white overflow-hidden relative shadow-inner">
        {demoMode ? (
          <div className="w-full h-full relative">
             <IframeRenderer code={code} onUpdateCode={onUpdateCode} />
          </div>
        ) : (
          <div className="w-full h-full flex flex-col">
            <div className="bg-[#f0f0f0] border-b border-gray-300 p-2 flex gap-2">
               <input 
                  type="text" 
                  value={productionUrl} 
                  onChange={(e) => setProductionUrl(e.target.value)}
                  placeholder="https://your-site.vercel.app"
                  className="flex-1 text-[10px] px-2 py-1 border border-gray-300 rounded text-black font-mono focus:outline-none"
               />
            </div>
            {productionUrl ? (
               <iframe src={productionUrl} className="w-full h-full border-none" title="Live Site" />
            ) : (
               <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-10 text-center gap-4">
                  <Globe size={40} className="opacity-20" />
                  <p className="text-xs">Paste Vercel URL to compare.</p>
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// --- VS CODE EDITOR ---
const FullCodeEditor = ({ code }) => {
  return (
    <div className="w-full h-full bg-[#1e1e1e] flex font-mono text-sm overflow-hidden">
      <div className="w-56 bg-[#252526] border-r border-black/50 flex flex-col shrink-0">
        <div className="p-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Explorer</div>
        <div className="px-4 py-2 text-white bg-[#37373d] flex items-center gap-2 cursor-pointer border-l-2 border-neon-blue">
           <FileCode size={14} className="text-blue-400" /> App.jsx
        </div>
      </div>
      <div className="flex-1 flex flex-col min-w-0">
         <div className="bg-[#2d2d2d] flex border-b border-black/20">
           <div className="px-4 py-2 bg-[#1e1e1e] text-white flex items-center gap-2 border-t-2 border-neon-blue text-xs">
              <FileCode size={12} className="text-blue-400" /> App.jsx
           </div>
         </div>
         <div className="flex-1 p-4 overflow-auto text-gray-400">
            <pre className="text-xs leading-relaxed"><code>{code}</code></pre>
         </div>
      </div>
    </div>
  );
};

// --- MAIN DASHBOARD ---
export default function Dashboard({ user, token, repo, onBack }) {
  const [viewMode, setViewMode] = useState('simulation'); 
  const [totalUsers, setTotalUsers] = useState(0);
  const [aiLog, setAiLog] = useState([{ role: 'system', text: `Syncing ${repo?.name}...` }]);
  const [rawCode, setRawCode] = useState(''); 
  const [fileSha, setFileSha] = useState(null);
  const [demoMode, setDemoMode] = useState(true);
  const [rightPanelWidth, setRightPanelWidth] = useState(480);
  const [isResizing, setIsResizing] = useState(false);
  const [productionUrl, setProductionUrl] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [bubbles, setBubbles] = useState([]);

  // --- FETCH REPO CODE ---
  useEffect(() => {
    async function initSync() {
      if (!token || !repo) return;
      const octokit = new Octokit({ auth: token });
      try {
        const { data } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
          owner: repo.owner.login,
          repo: repo.name,
          path: 'src/App.jsx' 
        });
        setFileSha(data.sha);
        setRawCode(atob(data.content));
        setAiLog(prev => [...prev, { role: 'success', text: 'SYNCED: Rendering code exactly as committed.' }]);
      } catch (err) {
        setAiLog(prev => [...prev, { role: 'error', text: 'src/App.jsx not found in root.' }]);
      }
    }
    initSync();

    async function run_pipeline() {
      const resp = await fetch(APP_HOST + PORT + "/api/run_pipeline", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html: rawCode })
      });

      if (!resp.ok) return;
      const json = await resp.json();
    }

    run_pipeline();
  }, [token, repo]);

  // --- 2. LAYOUT HANDLERS ---
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
        console.log(resp);
        if (!resp.ok) return;
        const json = await resp.json();
        console.log("Got", json?.count)
        if (typeof json?.count === 'number') 
          setBubbles(prevBubbles =>
            prevBubbles.map(bubble =>
              bubble.id === id ? { ...bubble, count : json?.count} : 
              bubble 
            )
          )
        console.log(bubbles);
      } catch (e) {
        // ignore network errors during development
        console.error(e);
      }
    };

    if (demoMode) {
      fetchBackendCount();
      // intervalId = setInterval(fetchBackendCount, 1500);
    } 
  };


  // --- 3. COMMIT HANDLER ---
  const handleCommit = async () => {
    if (!token || !repo) return;
    setIsCommitting(true);
    setAiLog(prev => [...prev, { role: 'system', text: 'Pushing changes to GitHub...' }]);
    
    const octokit = new Octokit({ auth: token });
    try {
      const { data } = await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
        owner: repo.owner.login,
        repo: repo.name,
        path: 'src/App.jsx',
        message: 'Update layout via Darwin Drag & Drop 🚀',
        content: btoa(rawCode),
        sha: fileSha
      });
      setFileSha(data.content.sha);
      setAiLog(prev => [...prev, { role: 'success', text: 'DEPLOY SUCCESSFUL: GitHub Updated.' }]);
    } catch (err) {
      console.error(err);
      setAiLog(prev => [...prev, { role: 'error', text: 'Commit Failed.' }]);
    } finally {
      setIsCommitting(false);
    }
  };

  // Handle Resize
  useEffect(() => {
    const handleMove = (e) => { if (isResizing) setRightPanelWidth(window.innerWidth - e.clientX); };
    const handleUp = () => setIsResizing(false);
    if (isResizing) { window.addEventListener('mousemove', handleMove); window.addEventListener('mouseup', handleUp); }
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
  }, [isResizing]);

  return (
    <div className={`h-screen w-screen bg-black text-white flex overflow-hidden font-sans ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
      {/* SIDEBAR */}
      <div className="w-16 border-r border-white/5 flex flex-col items-center py-6 gap-6 z-30 bg-[#0a0a0a] shrink-0">
        <div className="w-10 h-10 bg-gradient-to-tr from-neon-blue to-neon-purple rounded-lg flex items-center justify-center font-bold text-xl">D</div>
        <div className="flex flex-col gap-4">
            <button onClick={() => setViewMode('simulation')} className={`p-3 rounded-xl transition-all ${viewMode === 'simulation' ? 'text-neon-blue' : 'text-gray-500 hover:text-white'}`}><Layers size={20} /></button>
            <button onClick={() => setViewMode('code')} className={`p-3 rounded-xl transition-all ${viewMode === 'code' ? 'text-neon-purple' : 'text-gray-500'}`}><Code size={20} /></button>
        </div>
        <button onClick={onBack} className="mt-auto p-3 text-gray-600 hover:text-red-500 transition-colors"><ArrowLeft size={20} /></button>
      </div>
      
      {/* MAIN VIEWPORT */}
      <div className="flex-1 relative bg-[#0a0a0a] overflow-hidden flex flex-col">
        {viewMode === 'simulation' ? (
          <div className="relative w-full h-full">
             <div className="absolute top-6 left-6 z-10">
                <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Active Swarm</h2>
                <div className="text-4xl font-mono text-neon-blue drop-shadow-[0_0_10px_rgba(0,243,255,0.3)]">92</div>
             </div>
             
             {/* TOGGLE */}
             <div className="absolute top-6 right-6 z-20 bg-black/40 backdrop-blur-md p-1 rounded-full border border-white/10 flex">
                <button onClick={() => setDemoMode(true)} className={`px-5 py-1.5 rounded-full text-[10px] font-bold transition-all ${demoMode ? 'bg-neon-blue text-black' : 'text-gray-400'}`}>REPO</button>
                <button onClick={() => setDemoMode(false)} className={`px-5 py-1.5 rounded-full text-[10px] font-bold transition-all ${!demoMode ? 'bg-red-500 text-white' : 'text-gray-400'}`}>LIVE</button>
             </div>

             <Scene bubbles={bubbles} totalUsers={totalUsers} />
             
             {/* RESET DOCK */}
             <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 bg-black/60 backdrop-blur-xl border border-white/10 px-6 py-3 rounded-full flex items-center gap-6">
                <button onClick={() => window.location.reload()} className="flex items-center gap-2 text-[10px] font-bold text-gray-400 hover:text-white transition-all"><RotateCcw size={14}/> RESET</button>
                <div className="w-px h-4 bg-white/10" />
                <span className="text-[10px] text-gray-600 font-mono tracking-tighter uppercase">Simulation: Idle</span>
             </div>
          </div>
        ) : (
          <FullCodeEditor code={rawCode} />
        )}
      </div>

      <div onMouseDown={() => setIsResizing(true)} className={`w-1 cursor-col-resize transition-colors ${isResizing ? 'bg-neon-blue' : 'bg-white/5 hover:bg-neon-blue/40'}`} />

      {/* THE PREVIEW CHANNEL */}
      <div style={{ width: rightPanelWidth }} className="flex flex-col bg-[#111] shrink-0 border-l border-white/5">
         <div className="h-[75%]">
           <CanvasPreview 
             code={rawCode} 
             onUpdateCode={handleUpdateCode} // Passes rewrites back up
             demoMode={demoMode} 
             productionUrl={productionUrl} 
             setProductionUrl={setProductionUrl} 
             onCommit={handleCommit} 
             isCommitting={isCommitting} 
           />
         </div>
         <div className="h-[25%] border-t border-white/10 flex flex-col bg-black/40">
            <div className="p-3 bg-white/5 border-b border-white/10 flex items-center gap-2 text-yellow-500">
               <Zap size={14} /> <span className="text-[10px] font-bold uppercase font-mono">System Logs</span>
            </div>
            <div className="flex-1 p-4 overflow-y-auto font-mono text-[10px] space-y-2">
               {aiLog.map((log, i) => (
                 <div key={i} className={`p-2 rounded border-l-2 ${log.role === 'success' ? 'border-green-500 bg-green-500/5 text-green-400' : 'border-gray-700 bg-white/5 text-gray-500'}`}>
                    {log.text}
                 </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
}