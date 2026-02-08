import React, { useState, useEffect, useRef } from 'react';
import { Octokit } from "@octokit/rest"; 
import { Layers, Zap, Shapes, Code, FileCode, GitCommit, ArrowLeft, RotateCcw, Globe, Folder, File, X, ChevronRight, ChevronDown, Loader2, Trash2, Camera, Users, Radio, MousePointer2, Plus, Eye, EyeOff } from 'lucide-react';
import Scene from './Scene';
import { getDatabase, ref, onValue } from "firebase/database";
import {APP_HOST, PORT} from "../constants";

// --- VIBRANT PALETTE ---
const NEON_PALETTE = [
  "#00f3ff", // Cyan
  "#bc13fe", // Neon Purple
  "#ff0055", // Hot Pink
  "#ccff00", // Lime
  "#ffaa00", // Bright Orange
  "#00ff99", // Spring Green
  "#ff00ff", // Magenta
  "#0099ff"  // Electric Blue
];

// --- 1. RUNTIME RENDERER (UNTOUCHED) ---
const IframeRenderer = ({ code, onUpdateCode, handleUpdateLayout, mode, onExtractStart }) => {
  const iframeRef = useRef(null);

  useEffect(() => {
    const handleMessage = (e) => {
      // HANDLE: CSS Layout Dragging (Repo Mode)
      if (e.data.type === 'UPDATE_POS') {
        const { index, x, y } = e.data;
        let matchCount = 0;
        const newCode = code.replace(
          /<(nav|button|h1|div)\b([^>]*)>/g, 
          (fullMatch, tag, props) => {
            if (matchCount === index) {
               let newProps = props;
               if (newProps.match(/left:\s*\d+/)) newProps = newProps.replace(/left:\s*(\d+)/, `left: ${Math.round(x)}`);
               if (newProps.match(/top:\s*\d+/)) newProps = newProps.replace(/top:\s*(\d+)/, `top: ${Math.round(y)}`);
               matchCount++;
               return `<${tag}${newProps}>`;
            }
            matchCount++;
            return fullMatch; 
          }
        );
        if (newCode !== code) onUpdateCode(newCode);
        handleUpdateLayout(index, x, y);
      }

      // HANDLE: Extraction Dragging (Live Mode)
      if (e.data.type === 'EXTRACT_COMPONENT') {
         onExtractStart(e.data.tag, e.data.id, e.data.clientX, e.data.clientY);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [code, onUpdateCode, onExtractStart]);

  const prepareTransformedCode = () => {
    try {
      let count = 0;
      return code
        .replace(/import.*?;/g, '') 
        .replace(/export default function/, 'function')
        .replace(/export default/, '')
        .replace(
          /<(nav|button|h1|div)\b([^>]*)>/g, 
          (match, tag, props) => {
             const currentIndex = count++;
             return `<InteractiveElement _tag="${tag}" _darwinIndex={${currentIndex}}${props}>`;
          }
        )
        .replace(/<\/(nav|button|h1|div)>/g, '</InteractiveElement>');
    } catch (e) {
      return "";
    }
  };

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
           .mode-edit .darwin-draggable:hover { outline: 2px solid #00f3ff; cursor: move; z-index: 1000; }
           .mode-live .darwin-draggable:hover { outline: 2px dashed #bc13fe; cursor: alias; z-index: 1000; }
        </style>
      </head>
      <body class="mode-${mode}">
        <div id="root"></div>
        <script type="text/babel">
          const { useState, useEffect, useRef } = React;
          const DarwinTracker = () => null;

          const InteractiveElement = ({ _tag: Tag, _darwinIndex, children, style, ...props }) => {
            const isAbsolute = style && style.position === 'absolute';
            const hasId = props['data-darwin-id'] || props.id;
            const canInteract = isAbsolute || ('${mode}' === 'live' && hasId);

            if (!canInteract) return <Tag style={style} {...props}>{children}</Tag>;

            const [pos, setPos] = useState({ x: parseInt(style?.left || 0), y: parseInt(style?.top || 0) });
            const [isDragging, setIsDragging] = useState(false);
            const dragOffset = useRef({ x: 0, y: 0 });

            const handleMouseDown = (e) => {
              e.stopPropagation();
              e.preventDefault(); 

              if ('${mode}' === 'live') {
                 window.parent.postMessage({ 
                    type: 'EXTRACT_COMPONENT', 
                    tag: '${mode}' === 'live' ? (props['data-darwin-id'] || props.id || _tag) : _tag,
                    id: _darwinIndex,
                    clientX: e.clientX,
                    clientY: e.clientY
                 }, '*');
                 return;
              }

              setIsDragging(true);
              dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
            };

            useEffect(() => {
              if (!isDragging || '${mode}' === 'live') return;
              
              const handleMove = (e) => {
                let newX = e.clientX - dragOffset.current.x;
                let newY = e.clientY - dragOffset.current.y;
                if (newX < 0) newX = 0;
                if (newY < 0) newY = 0;
                const maxX = window.innerWidth - 50; 
                const maxY = window.innerHeight - 20;
                if (newX > maxX) newX = maxX;
                if (newY > maxY) newY = maxY;
                setPos({ x: newX, y: newY });
              };
              
              const handleUp = () => { setIsDragging(false); window.parent.postMessage({ type: 'UPDATE_POS', index: _darwinIndex, x: pos.x, y: pos.y }, '*'); };
              window.addEventListener('mousemove', handleMove); window.addEventListener('mouseup', handleUp);
              return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
            }, [isDragging, pos]);

            return <Tag style={{ ...style, left: pos.x, top: pos.y }} className="darwin-draggable" onMouseDown={handleMouseDown} {...props}>{children}</Tag>;
          };

          try { ${prepareTransformedCode()} const root = ReactDOM.createRoot(document.getElementById('root')); root.render(<App />); } 
          catch (err) { document.body.innerHTML = '<div style="color:red; padding:20px">Preview Error: ' + err.message + '</div>'; }
        </script>
      </body>
    </html>
  `;
  return <iframe ref={iframeRef} srcDoc={srcDoc} title="Live Preview" className="w-full h-full border-none bg-white" sandbox="allow-scripts allow-same-origin" />;
};

// --- 2. EDITOR (UNTOUCHED) ---
const highlightSyntax = (line) => {
  const parts = line.split(/(\s+|[{}();,<>=]|'[^']*'|"[^"]*")/g).filter(Boolean);
  return parts.map((part, i) => {
    if (['import', 'from', 'const', 'let', 'var', 'function', 'return', 'export', 'default', 'class', 'if', 'else', 'true', 'false', 'null', 'undefined', 'await', 'async'].includes(part)) return <span key={i} className="text-pink-400">{part}</span>;
    if (part.startsWith("'") || part.startsWith('"')) return <span key={i} className="text-yellow-300">{part}</span>;
    if (part.match(/^[A-Z][a-zA-Z0-9]*$/)) return <span key={i} className="text-blue-300">{part}</span>;
    if (part.match(/<[^>]+>/)) return <span key={i} className="text-blue-400">{part}</span>;
    return <span key={i} className="text-gray-300">{part}</span>;
  });
};

const EditorWorkspace = ({ fileTree, openTabs, activeTab, fileContents, onFileSelect, onTabClose, onTabClick, loadingFile }) => {
  const [expandedFolders, setExpandedFolders] = useState(new Set(['src', 'components']));
  const [selectedLine, setSelectedLine] = useState(null);
  const toggleFolder = (path) => { const next = new Set(expandedFolders); if (next.has(path)) next.delete(path); else next.add(path); setExpandedFolders(next); };
  
  const renderTree = (items) => {
    if (!items) return null;
    return items.map((item) => {
      if (item.type === 'dir') {
        const isExpanded = expandedFolders.has(item.path);
        return (
          <div key={item.path}>
            <div onClick={() => toggleFolder(item.path)} className="flex items-center gap-1 py-1 px-2 text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer select-none text-xs">
              {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />} <Folder size={12} className="text-blue-400 shrink-0" /> <span className="truncate">{item.name}</span>
            </div>
            {isExpanded && item.children && <div className="pl-3 border-l border-white/5 ml-2">{renderTree(item.children)}</div>}
          </div>
        );
      }
      return (
        <div key={item.path} onClick={() => onFileSelect(item)} className={`flex items-center gap-2 py-1 px-2 cursor-pointer text-xs transition-colors ${activeTab === item.path ? 'bg-blue-500/20 text-blue-400 border-r-2 border-blue-500' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
           <FileCode size={12} className="shrink-0" /> <span className="truncate">{item.name}</span>
        </div>
      );
    });
  };

  const renderCodeLines = () => {
    if (!activeTab || !fileContents[activeTab]) return null;
    return fileContents[activeTab].split('\n').map((line, index) => (
        <div key={index} onClick={() => setSelectedLine(index + 1)} className={`flex text-xs leading-relaxed font-mono hover:bg-white/5 cursor-text ${selectedLine === index + 1 ? 'bg-[#264f78]/50' : ''}`}>
          <div className="w-12 shrink-0 text-right pr-4 text-gray-600 select-none border-r border-white/5 bg-[#1e1e1e]">{index + 1}</div>
          <div className="pl-4 whitespace-pre pr-4">{highlightSyntax(line)}</div>
        </div>
    ));
  };

  return (
    <div className="w-full h-full bg-[#1e1e1e] flex font-mono text-sm overflow-hidden">
      <div className="w-56 bg-[#252526] border-r border-black/50 flex flex-col shrink-0">
        <div className="p-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest flex justify-between items-center bg-[#252526]">Explorer</div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2">{renderTree(fileTree)}</div>
      </div>
      <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
         <div className="flex bg-[#2d2d2d] overflow-x-auto scrollbar-hide border-b border-black/20 h-9 shrink-0">
            {openTabs.map(tabPath => (
              <div key={tabPath} onClick={() => onTabClick(tabPath)} className={`group px-3 py-2 flex items-center gap-2 text-xs cursor-pointer min-w-[120px] max-w-[200px] border-r border-black/20 ${activeTab === tabPath ? 'bg-[#1e1e1e] text-white border-t-2 border-t-blue-500' : 'bg-[#2d2d2d] text-gray-500 hover:bg-[#252526]'}`}>
                <FileCode size={10} className={activeTab === tabPath ? 'text-blue-400' : 'text-gray-500'} /> <span className="truncate flex-1">{tabPath.split('/').pop()}</span> <button onClick={(e) => { e.stopPropagation(); onTabClose(tabPath); }} className="opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded p-0.5 transition-all"><X size={10} /></button>
              </div>
            ))}
         </div>
         <div className="flex-1 overflow-auto relative bg-[#1e1e1e]">
           {loadingFile ? <div className="absolute inset-0 flex items-center justify-center text-gray-500 gap-2"><Loader2 size={20} className="animate-spin" /> Loading...</div> : activeTab && fileContents[activeTab] ? <div className="py-2 min-h-full">{renderCodeLines()}</div> : <div className="flex-1 flex flex-col items-center justify-center text-gray-600 h-full"><Globe size={48} className="opacity-20 mb-4" /><p className="text-xs">Select a file to edit</p></div>}
         </div>
      </div>
    </div>
  );
};

// --- 3. MAIN DASHBOARD ---
export default function Dashboard({ user, token, repo, onBack }) {
  const [viewMode, setViewMode] = useState('simulation'); 
  const [totalUsers, setTotalUsers] = useState(0);
  const [aiLog, setAiLog] = useState([{ role: 'system', text: `Connected to ${repo?.full_name}` }]);
  const [demoMode, setDemoMode] = useState(true); // True = Repo(Edit), False = Live(Extract)
  const [rightPanelWidth, setRightPanelWidth] = useState(480);
  const [isResizing, setIsResizing] = useState(false);
  const [bubbles, setBubbles] = useState([]);
  const [activeId, setActiveId] = useState(null); // TRACK SELECTION
  
  // NEW STATE: Switch between Logs and Properties
  const [activePanel, setActivePanel] = useState('logs');

  // Drag Extraction State
  const [extractedGhost, setExtractedGhost] = useState(null); // { id, x, y }

  // File System State
  const [fileTree, setFileTree] = useState([]);
  const [openTabs, setOpenTabs] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [fileContents, setFileContents] = useState({});
  const [loadingFile, setLoadingFile] = useState(false);

  // NEW HELPERS
  const handleDeleteBubble = (id) => {
    setBubbles(prev => prev.filter(b => b.id !== id));
  };
  
  const toggleVisibility = (id) => {
    setBubbles(prev => prev.map(b => b.id === id ? { ...b, visible: !b.visible } : b));
  };

  // --- REPO LOADING LOGIC (UNTOUCHED) ---
  useEffect(() => {
    async function run_pipeline(contents) {
      const resp = await fetch(APP_HOST + PORT + "/api/run_pipeline", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html: contents })
      });
      if (!resp.ok) return;
      await resp.json();
    }

    async function initSync() {
      if (!token || !repo) return;
      const octokit = new Octokit({ auth: token });
      try {
        setAiLog(prev => [...prev, { role: 'system', text: 'Fetching file tree...' }]);
        const { data: repoData } = await octokit.request('GET /repos/{owner}/{repo}', { owner: repo.owner.login, repo: repo.name });
        const { data: treeData } = await octokit.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}?recursive=1', { owner: repo.owner.login, repo: repo.name, tree_sha: repoData.default_branch });
        const tree = []; const lookup = {}; 
        treeData.tree.forEach(item => { const parts = item.path.split('/'); const fileName = parts[parts.length - 1]; const node = { ...item, name: fileName, children: [] }; lookup[item.path] = node; if (parts.length === 1) tree.push(node); else if (lookup[parts.slice(0, -1).join('/')]) lookup[parts.slice(0, -1).join('/')].children.push(node); });
        const mapType = (nodes) => nodes.map(n => ({ ...n, type: n.type === 'tree' ? 'dir' : 'file', children: n.children ? mapType(n.children) : [] }));
        setFileTree(mapType(tree));
        setAiLog(prev => [...prev, { role: 'success', text: 'File tree loaded.' }]);
        const appFile = treeData.tree.find(f => f.path === 'src/App.jsx');
        if (appFile) {
          const contents = await handleFileSelect({ path: 'src/App.jsx', sha: appFile.sha, name: 'App.jsx', type: 'file' });
          run_pipeline(contents);
        }
      } catch (err) { console.error(err); }
    }
    initSync();
  }, [token, repo]);

  // --- 2. LAYOUT HANDLERS (UNTOUCHED) ---
  const handleUpdateLayout = (id, newX, newY) => {
    const fetchBackendCount = async () => {
      try {
        const resp = await fetch(APP_HOST + PORT + '/api/get_hit_count', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ x: newX, y: newY, div_id: id })
        });
        if (!resp.ok) return;
        const json = await resp.json();
        if (typeof json?.count === 'number') 
          setBubbles(prevBubbles =>
            prevBubbles.map(bubble =>
              bubble.id === id ? { ...bubble, count : json?.count} : 
              bubble 
            )
          )
      } catch (e) {
        console.error(e);
      }
    };
    if (demoMode) {
      fetchBackendCount();
    } 
  };

  const handleFileSelect = async (file) => {
    if (file.type === 'dir') return;
    if (!openTabs.includes(file.path)) setOpenTabs(prev => [...prev, file.path]);
    setActiveTab(file.path);
    if (!fileContents[file.path]) {
       setLoadingFile(true);
       const octokit = new Octokit({ auth: token });
       try { const { data } = await octokit.request('GET /repos/{owner}/{repo}/git/blobs/{file_sha}', { owner: repo.owner.login, repo: repo.name, file_sha: file.sha }); setFileContents(prev => ({ ...prev, [file.path]: atob(data.content) })); return atob(data.content); } catch (e) {console.error(e);} finally { setLoadingFile(false); }
    }
  };

  const handleTabClose = (path) => { const newTabs = openTabs.filter(t => t !== path); setOpenTabs(newTabs); if (activeTab === path) setActiveTab(newTabs.length > 0 ? newTabs[newTabs.length - 1] : null); };
  const handleCodeUpdateFromPreview = (newCode) => { if (activeTab === 'src/App.jsx') setFileContents(prev => ({ ...prev, [activeTab]: newCode })); };

  // --- DRAG EXTRACTION LOGIC (UNTOUCHED) ---
  const handleExtractStart = (tag, id, clientX, clientY) => {
    const iframeRect = document.querySelector('iframe')?.getBoundingClientRect();
    if (iframeRect) {
       setExtractedGhost({
         tag: tag || 'Component',
         id: id,
         x: iframeRect.left + clientX,
         y: iframeRect.top + clientY
       });
    }
  };

  useEffect(() => {
    if (!extractedGhost) return;
    const handleGlobalMove = (e) => { setExtractedGhost(prev => ({ ...prev, x: e.clientX, y: e.clientY })); };
    const handleGlobalUp = (e) => {
       const sceneWidth = window.innerWidth - rightPanelWidth;
       if (e.clientX < sceneWidth) {
          // --- DROP SUCCESSFUL! ---
          // PICK A NEON COLOR
          const nextColor = NEON_PALETTE[bubbles.length % NEON_PALETTE.length];
          
          setBubbles(prev => {
             // Avoid duplicates
             if(prev.find(b => b.id === extractedGhost.id)) return prev;
             
             return [...prev, { 
               id: extractedGhost.id, // Use unique ID
               label: extractedGhost.tag, 
               count: 0, 
               visible: true,
               color: nextColor // Assign vibrant color here
             }];
          });
          setAiLog(prev => [...prev, { role: 'success', text: `Added tracking for ${extractedGhost.tag}` }]);
          // AUTO SWITCH TO PROPERTIES PANEL
          setActivePanel('properties'); 
       }
       setExtractedGhost(null); 
    };
    window.addEventListener('mousemove', handleGlobalMove);
    window.addEventListener('mouseup', handleGlobalUp);
    return () => { window.removeEventListener('mousemove', handleGlobalMove); window.removeEventListener('mouseup', handleGlobalUp); };
  }, [extractedGhost, rightPanelWidth, bubbles]);


  // Resize
  useEffect(() => { const handleMove = (e) => { if (isResizing) setRightPanelWidth(window.innerWidth - e.clientX); }; const handleUp = () => setIsResizing(false); if (isResizing) { window.addEventListener('mousemove', handleMove); window.addEventListener('mouseup', handleUp); } return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); }; }, [isResizing]);
  const handleClearEnvironment = () => { setTotalUsers(0); setBubbles([]); };

  return (
    <div className={`h-screen w-screen bg-black text-white flex overflow-hidden font-sans ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
      {/* Sidebar */}
      <div className="w-16 border-r border-white/5 flex flex-col items-center py-6 gap-6 z-30 bg-[#0a0a0a] shrink-0">
        <div className="w-10 h-10 bg-gradient-to-tr from-neon-blue to-neon-purple rounded-lg flex items-center justify-center font-bold text-xl">D</div>
        <div className="flex flex-col gap-4">
            <button onClick={() => setViewMode('simulation')} className={`p-3 rounded-xl transition-all ${viewMode === 'simulation' ? 'text-neon-blue' : 'text-gray-500 hover:text-white'}`}><Layers size={20} /></button>
            <button onClick={() => setViewMode('code')} className={`p-3 rounded-xl transition-all ${viewMode === 'code' ? 'text-neon-purple' : 'text-gray-500'}`}><Code size={20} /></button>
            {/* PROPERTIES TOGGLE */}
            <button onClick={() => setActivePanel('properties')} className={`p-3 rounded-xl transition-all ${activePanel === 'properties' ? 'text-green-400 bg-green-500/10' : 'text-gray-500 hover:text-white'}`}><Shapes size={20} /></button>
        </div>
        <button onClick={onBack} className="mt-auto p-3 text-gray-600 hover:text-red-500 transition-colors"><ArrowLeft size={20} /></button>
      </div>
      
      {/* 3D Viewport */}
      <div className="flex-1 relative bg-[#0a0a0a] overflow-hidden flex flex-col">
        {viewMode === 'simulation' ? (
          <div className="relative w-full h-full group">
             {/* SCENE */}
             <Scene bubbles={bubbles} activeId={activeId} setActiveId={setActiveId} />
             
             {/* Drop Zone Indicator */}
             {extractedGhost && (
                <div className="absolute inset-0 bg-blue-500/10 border-4 border-blue-500/50 flex items-center justify-center pointer-events-none z-10">
                   <div className="bg-black/80 px-4 py-2 rounded text-blue-400 font-mono font-bold">DROP TO TRACK</div>
                </div>
             )}

             {/* Dock */}
             <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
                <div className="bg-black/80 backdrop-blur-xl border border-white/10 pl-6 pr-2 py-2 rounded-full flex items-center gap-6 shadow-2xl">
                   <div className="flex items-center gap-3 pr-4 border-r border-white/10">
                      <Users size={16} className="text-gray-500" />
                      <div className="flex items-baseline gap-2">
                         <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Active Swarm</span>
                         <span className="text-lg font-mono text-neon-blue leading-none">{demoMode ? '92' : totalUsers}</span>
                      </div>
                   </div>
                   <div className="flex items-center gap-1">
                      <button onClick={() => window.location.reload()} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white" title="Reset"><Camera size={16} /></button>
                      <button onClick={handleClearEnvironment} className="p-2 hover:bg-red-500/20 rounded-full text-gray-400 hover:text-red-500" title="Clear"><Trash2 size={16} /></button>
                   </div>
                   <div className="bg-white/5 p-1 rounded-full flex ml-2">
                      <button onClick={() => setDemoMode(true)} className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${demoMode ? 'bg-neon-blue text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}>REPO</button>
                      <button onClick={() => setDemoMode(false)} className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${!demoMode ? 'bg-red-500 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>LIVE</button>
                   </div>
                </div>
             </div>
          </div>
        ) : (
          <EditorWorkspace fileTree={fileTree} openTabs={openTabs} activeTab={activeTab} fileContents={fileContents} onFileSelect={handleFileSelect} onTabClose={handleTabClose} onTabClick={setActiveTab} loadingFile={loadingFile} />
        )}
      </div>

      <div onMouseDown={() => setIsResizing(true)} className={`w-1 cursor-col-resize transition-colors ${isResizing ? 'bg-neon-blue' : 'bg-white/5 hover:bg-neon-blue/40'}`} />

      {/* Preview Panel */}
      <div style={{ width: rightPanelWidth }} className="flex flex-col bg-[#111] shrink-0 border-l border-white/5 relative">
         {extractedGhost && (
            <div 
               className="fixed z-50 pointer-events-none flex items-center gap-2 bg-[#bc13fe] text-white px-3 py-2 rounded-lg shadow-xl font-bold text-xs"
               style={{ left: extractedGhost.x, top: extractedGhost.y, transform: 'translate(-50%, -50%)' }}
            >
               <MousePointer2 size={14} className="fill-white" />
               <span>{extractedGhost.tag}</span>
               <div className="bg-white text-[#bc13fe] px-1.5 rounded text-[10px]">+ ADD</div>
            </div>
         )}

         <div className="h-[75%]">
           <div className="flex flex-col h-full bg-[#1e1e1e]">
              <div className="h-10 flex items-center justify-between px-4 bg-[#252526] border-b border-black/20">
                 <span className="text-[10px] font-bold uppercase text-gray-400 flex items-center gap-2"><Globe size={12}/> Live Preview</span>
                 <div className={`text-[10px] px-2 rounded flex items-center gap-1 ${demoMode ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                    {demoMode ? 'EDIT MODE' : 'EXTRACT MODE'}
                 </div>
              </div>
              <div className="flex-1 bg-white relative">
                 <IframeRenderer 
                    code={fileContents['src/App.jsx'] || ''} 
                    onUpdateCode={handleCodeUpdateFromPreview} 
                    handleUpdateLayout={handleUpdateLayout}
                    mode={demoMode ? 'edit' : 'live'}
                    onExtractStart={handleExtractStart}
                 />
              </div>
           </div>
         </div>
         <div className="h-[25%] border-t border-white/10 flex flex-col bg-black/40">
            {/* TABS HEADER (Logs vs Properties) */}
            <div className="flex border-b border-white/10">
               <button onClick={() => setActivePanel('logs')} className={`px-4 py-2 text-[10px] font-bold uppercase flex items-center gap-2 ${activePanel === 'logs' ? 'bg-white/10 text-yellow-500 border-b-2 border-yellow-500' : 'text-gray-500 hover:text-white'}`}>
                  <Zap size={12} /> System Logs
               </button>
               <button onClick={() => setActivePanel('properties')} className={`px-4 py-2 text-[10px] font-bold uppercase flex items-center gap-2 ${activePanel === 'properties' ? 'bg-white/10 text-green-400 border-b-2 border-green-400' : 'text-gray-500 hover:text-white'}`}>
                  <Shapes size={12} /> Properties
               </button>
            </div>

            {/* SWITCHABLE CONTENT */}
            <div className="flex-1 overflow-y-auto font-mono text-[10px] p-0">
               {activePanel === 'logs' ? (
                  // ORIGINAL LOGS VIEW
                  <div className="p-4 space-y-2">
                     {aiLog.map((log, i) => <div key={i} className={`p-2 rounded border-l-2 ${log.role === 'success' ? 'border-green-500 bg-green-500/5 text-green-400' : 'border-gray-700 bg-white/5 text-gray-500'}`}>{log.text}</div>)}
                  </div>
               ) : (
                  // NEW PROPERTIES LIST VIEW
                  <div className="p-2 space-y-1">
                     {bubbles.length === 0 ? (
                        <div className="text-gray-600 text-center py-8 italic">No active trackers. Drag elements from the preview here.</div>
                     ) : (
                        bubbles.map((b) => (
                           <div key={b.id} className={`flex items-center justify-between p-2 rounded border border-white/5 hover:border-green-500/50 transition-colors group ${!b.visible ? 'bg-black/40 opacity-60' : 'bg-white/5'}`}>
                              <div className="flex items-center gap-3">
                                 <div className="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]" style={{ color: b.color || '#00f3ff', backgroundColor: b.color || '#00f3ff' }} />
                                 <span className="text-gray-300 font-bold">{b.label || 'Component'}</span>
                                 <span className="text-gray-600 text-[9px] uppercase">#{b.id}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                 <button onClick={() => toggleVisibility(b.id)} className="text-gray-500 hover:text-white p-1 rounded hover:bg-white/10">
                                    {b.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                                 </button>
                                 <button onClick={() => handleDeleteBubble(b.id)} className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                                    <Trash2 size={12} />
                                 </button>
                              </div>
                           </div>
                        ))
                     )}
                  </div>
               )}
            </div>
         </div>
      </div>
    </div>
  );
}