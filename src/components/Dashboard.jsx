import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Octokit } from "@octokit/rest"; 
import { Layers, Zap, Shapes, Code, FileCode, ArrowLeft, Globe, Folder, ChevronRight, ChevronDown, Loader2, Trash2, Camera, Users, MousePointer2, Eye, EyeOff, Move, Palette, MapPin, MousePointerClick, X, BarChart2, Sun, Moon, Save, GitCommit, Sparkles, Check, History, MessageSquare, Info, Tag, FileText, Dna } from 'lucide-react';
import Scene from './Scene';
import AnalyticsPanel from './AnalyticsPanel';
import HistoryPanel from './HistoryPanel';
import { subscribeToSwarm } from '../lib/firebase';
import {APP_HOST, BACKEND_PORT, PORT} from "../constants";
import logo from '../assets/logo.png';

const NEON_PALETTE = ["#00f3ff", "#bc13fe", "#ff0055", "#ccff00", "#ffaa00", "#00ff99", "#ff00ff", "#0099ff"];
const TAGS_REGEX = "nav|button|h1|h2|h3|div|section|header|footer|main|article|aside|p|span|ul|li|a|img|form|input";

const isImageFile = (path) => /\.(svg|png|jpe?g|gif|ico|webp)$/i.test(path);

const IframeRenderer = ({ files, proposedCode, onUpdateCode, handleUpdateLayout, mode, onExtractStart, activeId, activeColor }) => {
  const iframeRef = useRef(null);

  const sendSelection = useCallback(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'SYNC_SELECTION', id: activeId, color: activeColor }, '*');
    }
  }, [activeId, activeColor]);

  useEffect(() => { sendSelection(); }, [sendSelection]);


  useEffect(() => {
    const handleMessage = (e) => {
      if (!e.data || !e.data.type) return;
      if (e.data.type === 'UPDATE_POS') {
          handleUpdateLayout(
              e.data.dataDarwinId || e.data.index, 
              e.data.x, 
              e.data.y, 
              null, 
              e.data.file 
          );
      }

      if (e.data.type === 'UPDATE_STYLE') {
        console.log("Style")
        handleUpdateLayout(
          e.data.dataDarwinId,
          e.data.x,
          e.data.y,
          null,
          e.data.file || 'src/pages/Home.jsx',
          {attr : e.data.attr, value : e.data.value}
        )
      }
      if (e.data.type === 'EXTRACT_COMPONENT') onExtractStart(e.data.tag, e.data.id, e.data.clientX, e.data.clientY, e.data.meta);
      if (e.data.type === 'LOG') console.log("[Preview Log]", e.data.message);
      if (e.data.type === 'ERROR') {
         console.error("[Preview Error]", e.data.message);
         window.parent.postMessage({ type: 'SYSTEM_LOG', role: 'error', text: `Preview Error: ${e.data.message}` }, '*');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onUpdateCode, onExtractStart, handleUpdateLayout]);

  const prepareFileSystem = () => {
    const effectiveFiles = { ...files };
    if (proposedCode) effectiveFiles['src/App.jsx'] = proposedCode;
    return JSON.stringify(effectiveFiles);
  };

  const srcDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js"></script>
  <style>
    body { 
      margin: 0; 
      background: #fff; 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
      user-select: none; 
    }
    .mode-edit .darwin-draggable { cursor: grab; }
    .mode-edit .darwin-draggable:active { cursor: grabbing; }
    .mode-edit .darwin-draggable:hover { outline: 2px solid #00f3ff; }
    .mode-live .darwin-draggable { cursor: pointer; }
    .mode-live .darwin-draggable:hover { outline: 2px dashed #bc13fe; }
  </style>
</head>
<body class="mode-${mode}">
  <div id="root"></div>
  <script>
    window.onerror = function(message, source, lineno, colno, error) { window.parent.postMessage({ type: 'ERROR', message: message + ' (' + source + ':' + lineno + ')' }, '*'); };
    const originalError = console.error;
    console.error = function(...args) { window.parent.postMessage({ type: 'ERROR', message: args.join(' ') }, '*'); originalError.apply(console, args); };
  </script>
  <script type="text/babel" data-presets="react,env">
    const files = ${prepareFileSystem()};
    const modules = {};

    const isImageFile = (path) => /\\.(svg|png|jpe?g|gif|ico|webp)$/i.test(path);

    function applyDarwinTransform(code, filename) {
      try {
        const TAGS = "nav|button|h1|h2|h3|div|section|header|footer|main|article|aside|p|span|ul|li|a|img|form|input";
        let idx = 0;
        return code.replace(new RegExp('<(' + TAGS + ')\\\\b([^>]*)>', 'g'), (match, tag, props) => {
             const currentIndex = idx++;
             return \`<InteractiveElement _tag="\${tag}" _darwinIndex={\${currentIndex}} _darwinFile="\${filename}" \${props}>\`;
        }).replace(new RegExp('<\\\\/(' + TAGS + ')>', 'g'), '</InteractiveElement>');
      } catch(e) { return code; }
    }

    const { useState, useEffect, useRef } = React;
     
    const InteractiveElement = ({ _tag: Tag, _darwinIndex, _darwinFile, children, style, ...props }) => { 
      const isAbsolute = style && style.position === 'absolute'; 
      const hasId = props['data-darwin-id'] || props.id; 
      const canInteract = isAbsolute || '${mode}' === 'edit' || ('${mode}' === 'live' && hasId);
      
      const [highlightColor, setHighlightColor] = useState(null);
      const [pos, setPos] = useState({ x: 0, y: 0 }); 
      const [isDragging, setIsDragging] = useState(false); 
      const dragMeta = useRef({ startX: 0, startY: 0, initialRelX: 0, initialRelY: 0 });
      
      // --- NEW: Drag vs Click detection ---
      const isDragOp = useRef(false);
      const startPos = useRef({ x: 0, y: 0 });

      useEffect(() => {
        const handleMsg = (e) => {
          if (e.data.type === 'SYNC_SELECTION') {
             if (e.data.id == _darwinIndex || (hasId && e.data.id == hasId)) setHighlightColor(e.data.color || '#00f3ff');
             else setHighlightColor(null);
          }
        };
        window.addEventListener('message', handleMsg);
        return () => window.removeEventListener('message', handleMsg);
      }, [_darwinIndex, hasId]);

      // --- NEW: Global move listener to detect drag distance ---
      useEffect(() => {
        const handleGlobalMove = (e) => {
            const dx = Math.abs(e.clientX - startPos.current.x);
            const dy = Math.abs(e.clientY - startPos.current.y);
            if (dx > 5 || dy > 5) {
                isDragOp.current = true;
            }
        };
        window.addEventListener('mousemove', handleGlobalMove);
        return () => window.removeEventListener('mousemove', handleGlobalMove);
      }, []);

      const handleMouseDown = (e) => { 
        e.stopPropagation(); 
        
        // Reset drag detection
        isDragOp.current = false;
        startPos.current = { x: e.clientX, y: e.clientY };
        
        if ('${mode}' === 'live') { 
          // Note: We removed e.preventDefault() here to allow clicks, 
          // but we will intercept them in onClickCapture if it was a drag.
          
          const rect = e.target.getBoundingClientRect(); 
          const computed = window.getComputedStyle(e.target); 
          const meta = { width: Math.round(rect.width), height: Math.round(rect.height), x: Math.round(rect.x), y: Math.round(rect.y), bgColor: computed.backgroundColor, color: computed.color, type: Tag, file: _darwinFile }; 
          window.parent.postMessage({ type: 'EXTRACT_COMPONENT', tag: props['data-darwin-id'] || props.id || Tag, id: _darwinIndex, clientX: e.clientX, clientY: e.clientY, meta: meta }, '*'); 
          return; 
        } 

        if ('${mode}' === 'edit') {
            e.preventDefault();
            const elem = e.target;
            const rect = elem.getBoundingClientRect();
            // Calculate relative position based on offsetParent to prevent jumping
            const parent = elem.offsetParent || document.body;
            const parentRect = parent.getBoundingClientRect();
            
            const relX = rect.left - parentRect.left;
            const relY = rect.top - parentRect.top;
            
            setPos({ x: relX, y: relY });
            
            dragMeta.current = { startX: e.clientX, startY: e.clientY, initialRelX: relX, initialRelY: relY };
            setIsDragging(true);
        }
      }; 

      const handleClickCapture = (e) => {
          if (isDragOp.current) {
              e.preventDefault();
              e.stopPropagation();
          }
      };

      useEffect(() => { 
        if (!isDragging || '${mode}' === 'live') return; 
        
        const handleMove = (e) => { 
            const deltaX = e.clientX - dragMeta.current.startX;
            const deltaY = e.clientY - dragMeta.current.startY;
            let newX = dragMeta.current.initialRelX + deltaX;
            let newY = dragMeta.current.initialRelY + deltaY;
            if (newX < 0) newX = 0; if (newY < 0) newY = 0; 
            setPos({ x: newX, y: newY }); 
        }; 
        
        const handleUp = () => { 
          setIsDragging(false); 
          window.parent.postMessage({ type: 'UPDATE_POS', index: _darwinIndex, dataDarwinId: props['data-darwin-id'], x: pos.x, y: pos.y, file: _darwinFile }, '*'); 
        }; 

        window.addEventListener('mousemove', handleMove); 
        window.addEventListener('mouseup', handleUp); 
        return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); }; 
      }, [isDragging, pos]); 

      const finalStyle = {
          ...style,
          ...(highlightColor ? { outline: '2px solid ' + highlightColor, boxShadow: '0 0 15px ' + highlightColor } : {}),
          ...(isDragging ? { position: 'absolute', zIndex: 99999, left: pos.x, top: pos.y, cursor: 'grabbing' } : {}),
      };

      if (!canInteract) return <Tag style={style} {...props}>{children}</Tag>; 
      
      // Added onClickCapture to intercept clicks after drag
      return <Tag style={finalStyle} className="darwin-draggable" onMouseDown={handleMouseDown} onClickCapture={handleClickCapture} {...props}>{children}</Tag>; 
    };

    const EXTERNALS = { 
      'react': React, 
      'react-dom': ReactDOM, 
      'react-dom/client': { ...ReactDOM, default: ReactDOM, createRoot: ReactDOM.createRoot },
      'lucide-react': new Proxy({}, { 
          get: (target, prop) => (props) => React.createElement('svg', { ...props, viewBox: "0 0 24 24", width: 24, height: 24, fill: "none", stroke: "currentColor", strokeWidth: 2, style: { ...props.style, opacity: 0.5 } }, 
            React.createElement('circle', { cx: 12, cy: 12, r: 10 }), 
            React.createElement('path', { d: "M12 8v8M8 12h8" })
          ) 
      }),
      'firebase/app': {
        initializeApp: (config) => {
          if (!window.firebase) throw new Error("Firebase SDK not loaded.");
          if (firebase.apps.length > 0) return firebase.apps[0];
          return firebase.initializeApp(config);
        }
      },
      'firebase/database': {
        getDatabase: (app) => firebase.database(app),
        ref: (db, path) => db.ref(path),
        set: (ref, value) => ref.set(value),
        push: (ref, value) => ref.push(value),
        update: (ref, value) => ref.update(value),
        remove: (ref) => ref.remove(),
        onDisconnect: (ref) => ref.onDisconnect(),
        increment: (val) => firebase.database.ServerValue.increment(val)
      }
    };
     
    function resolvePath(base, relative) { if (!relative.startsWith('.')) return relative; const stack = base.split('/'); stack.pop(); const parts = relative.split('/'); for (let i = 0; i < parts.length; i++) { if (parts[i] === '.') continue; if (parts[i] === '..') stack.pop(); else stack.push(parts[i]); } let path = stack.join('/'); if (files[path]) return path; if (files[path + '.jsx']) return path + '.jsx'; if (files[path + '.js']) return path + '.js'; const imgExts = ['.svg', '.png', '.jpg', '.jpeg', '.gif', '.ico']; for (let ext of imgExts) { if (files[path + ext]) return path + ext; } return path; }
     
    function require(currentPath, importPath) { 
      if (EXTERNALS[importPath]) return EXTERNALS[importPath];
      
      const resolved = resolvePath(currentPath, importPath);

      if (files[resolved] && isImageFile(resolved)) {
         return files[resolved];
      }
      
      if (isImageFile(importPath) || isImageFile(resolved)) {
         return "https://placehold.co/100x100?text=Missing+Asset";
      }

      if (importPath.endsWith('.css')) {
         if (files[resolved]) {
            const style = document.createElement('style');
            style.textContent = files[resolved];
            document.head.appendChild(style);
         }
         return {};
      }

      if (!modules[resolved]) {
        if (!files[resolved]) {
           throw new Error(\`Module not found: \${importPath} (resolved: \${resolved})\`);
        }
        const module = { exports: {} };
        const darwinCode = applyDarwinTransform(files[resolved], resolved);
        const transformed = Babel.transform(darwinCode, { presets: ['react', 'env'], filename: resolved }).code;
        const wrapper = new Function('require', 'module', 'exports', 'React', 'InteractiveElement', transformed);
        wrapper((path) => require(resolved, path), module, module.exports, React, InteractiveElement);
        modules[resolved] = module.exports;
      }
      return modules[resolved];
    }

    try {
        const entry = ['src/main.jsx', 'src/index.jsx', 'src/App.jsx'].find(e => files[e]);
        if (entry) require('root', './' + entry);
        else document.body.innerHTML = 'No entry point found';
    } catch (err) { console.error(err); }
  </script>
</body>
</html>`;

  return <iframe ref={iframeRef} srcDoc={srcDoc} onLoad={sendSelection} title="Live Preview" className="w-full h-full border-none bg-white" sandbox="allow-scripts allow-same-origin allow-modals" />;
};

const highlightSyntax = (line) => { const parts = line.split(/(\s+|[{}();,<>=]|'[^']*'|"[^"]*")/g).filter(Boolean); return parts.map((part, i) => { if (['import', 'from', 'const', 'let', 'var', 'function', 'return', 'export', 'default', 'class', 'if', 'else', 'true', 'false', 'null', 'undefined', 'await', 'async'].includes(part)) return <span key={i} className="text-pink-600 dark:text-pink-400">{part}</span>; if (part.startsWith("'") || part.startsWith('"')) return <span key={i} className="text-yellow-600 dark:text-yellow-300">{part}</span>; if (part.match(/^[A-Z][a-zA-Z0-9]*$/)) return <span key={i} className="text-blue-600 dark:text-blue-300">{part}</span>; if (part.match(/<[^>]+>/)) return <span key={i} className="text-blue-700 dark:text-blue-400">{part}</span>; return <span key={i} className="text-gray-700 dark:text-gray-300">{part}</span>; }); };

const EditorWorkspace = ({ fileTree, openTabs, activeTab, fileContents, onFileSelect, onTabClose, onTabClick, onCodeChange, onSave, loadingFile, isSaving }) => { 
  const [expandedFolders, setExpandedFolders] = useState(new Set(['src', 'components']));
  
  const textareaRef = useRef(null);
  const codeBgRef = useRef(null);
  const lineNumRef = useRef(null);

  const handleScroll = (e) => {
    if (codeBgRef.current) {
        codeBgRef.current.scrollTop = e.target.scrollTop;
        codeBgRef.current.scrollLeft = e.target.scrollLeft;
    }
    if (lineNumRef.current) {
        lineNumRef.current.scrollTop = e.target.scrollTop;
    }
  };

  const toggleFolder = (path) => { 
    const next = new Set(expandedFolders); 
    if (next.has(path)) next.delete(path); else next.add(path); 
    setExpandedFolders(next); 
  }; 
  
  const renderTree = (items) => { 
    if (!items) return null; 
    return items.map((item) => { 
      if (item.type === 'dir') { 
        const isExpanded = expandedFolders.has(item.path); 
        return ( 
          <div key={item.path}> 
            <div onClick={() => toggleFolder(item.path)} className="flex items-center gap-1 py-1 px-2 text-gray-500 hover:text-black hover:bg-gray-200 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5 cursor-pointer select-none text-xs"> 
              {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />} 
              <Folder size={12} className="text-blue-500 dark:text-blue-400 shrink-0" /> 
              <span className="truncate">{item.name}</span> 
            </div> 
            {isExpanded && item.children && <div className="pl-3 border-l border-gray-300 dark:border-white/5 ml-2">{renderTree(item.children)}</div>} 
          </div> 
        ); 
      } 
      return ( 
        <div key={item.path} onClick={() => onFileSelect(item)} className={`flex items-center gap-2 py-1 px-2 cursor-pointer text-xs transition-colors ${activeTab === item.path ? 'bg-blue-100 text-blue-600 border-r-2 border-blue-500 dark:bg-blue-500/20 dark:text-blue-400' : 'text-gray-600 hover:text-black hover:bg-gray-200 dark:text-gray-500 dark:hover:text-white dark:hover:bg-white/5'}`}> 
          <FileCode size={12} className="shrink-0" /> 
          <span className="truncate">{item.name}</span> 
        </div> 
      ); 
    }); 
  }; 

  const lines = activeTab && fileContents[activeTab] ? fileContents[activeTab].split('\n') : [];

  return ( 
    <div className="w-full h-full bg-white dark:bg-[#1e1e1e] flex font-mono text-sm overflow-hidden"> 
      <div className="w-56 bg-gray-50 border-r border-gray-200 dark:bg-[#252526] dark:border-black/50 flex flex-col shrink-0"> 
        <div className="p-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest flex justify-between items-center bg-gray-100 dark:bg-[#252526]">Explorer</div> 
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2">{renderTree(fileTree)}</div> 
      </div> 
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#1e1e1e]"> 
        <div className="flex bg-gray-100 border-b border-gray-200 dark:bg-[#2d2d2d] dark:border-black/20 h-9 shrink-0 overflow-x-auto scrollbar-hide justify-between"> 
          <div className="flex overflow-x-auto">
            {openTabs.map(tabPath => ( 
              <div key={tabPath} onClick={() => onTabClick(tabPath)} className={`group px-3 py-2 flex items-center gap-2 text-xs cursor-pointer min-w-[120px] max-w-[200px] border-r border-gray-200 dark:border-black/20 ${activeTab === tabPath ? 'bg-white text-gray-900 border-t-2 border-t-blue-500 dark:bg-[#1e1e1e] dark:text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-[#2d2d2d] dark:hover:bg-[#252526]'}`}> 
                <FileCode size={10} className={activeTab === tabPath ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'} /> 
                <span className="truncate flex-1">{tabPath.split('/').pop()}</span> 
                <button onClick={(e) => { e.stopPropagation(); onTabClose(tabPath); }} className="opacity-0 group-hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 rounded p-0.5 transition-all"><X size={10} /></button> 
              </div> 
            ))} 
          </div>
          {activeTab && (
            <button 
              onClick={onSave}
              disabled={isSaving}
              className={`flex items-center gap-2 px-4 text-xs font-bold transition-colors ${
                isSaving 
                  ? 'bg-yellow-500/10 text-yellow-500' 
                  : 'bg-green-500/10 text-green-600 hover:bg-green-500/20 dark:text-green-400'
              }`}
            >
              {isSaving ? <Loader2 size={12} className="animate-spin"/> : <GitCommit size={14} />}
              {isSaving ? 'PUSHING...' : 'COMMIT & PUSH'}
            </button>
          )}
        </div> 
        <div className="flex-1 flex relative overflow-hidden bg-white dark:bg-[#1e1e1e]">
          {loadingFile ? (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500 gap-2"><Loader2 size={20} className="animate-spin" /> Loading...</div> 
          ) : activeTab && fileContents[activeTab] !== undefined ? (
            <>
                <div ref={lineNumRef} className="w-12 bg-gray-50 dark:bg-[#1e1e1e] border-r border-gray-200 dark:border-white/5 overflow-hidden text-right pr-3 pt-4 select-none">
                    {lines.map((_, i) => (
                        <div key={i} className="h-5 text-xs text-gray-400 dark:text-gray-600 leading-5">{i + 1}</div>
                    ))}
                </div>
                <div className="relative flex-1 h-full overflow-hidden">
                    <div ref={codeBgRef} className="absolute inset-0 p-4 overflow-hidden pointer-events-none whitespace-pre font-mono text-xs leading-5">
                       {lines.map((line, i) => (
                          <div key={i} className="h-5">{highlightSyntax(line)}</div>
                       ))}
                    </div>
                    <textarea
                       ref={textareaRef}
                       onScroll={handleScroll}
                       className="absolute inset-0 w-full h-full p-4 bg-transparent text-transparent caret-black dark:caret-white font-mono text-xs leading-5 resize-none outline-none whitespace-pre overflow-auto"
                       wrap="off"
                       spellCheck="false"
                       value={fileContents[activeTab].startsWith('data:image') ? '[Binary Image Data]' : fileContents[activeTab]}
                       onChange={(e) => !fileContents[activeTab].startsWith('data:image') && onCodeChange(activeTab, e.target.value)}
                       readOnly={fileContents[activeTab].startsWith('data:image')}
                    />
                </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 h-full"><Globe size={48} className="opacity-20 mb-4" /><p className="text-xs">Select a file to edit</p></div>
          )} 
        </div> 
      </div> 
    </div> 
  ); 
};

export default function Dashboard({ user, token, repo, onBack }) {
  const [viewMode, setViewMode] = useState('simulation'); 
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalDemoUsers, setTotalDemoUsers] = useState(0);
  const [rawUsers, setRawUsers] = useState({});
  const [clicksData, setClicksData] = useState({}); 
  const [aiLog, setAiLog] = useState([{ role: 'system', text: `Connected to ${repo?.full_name}` }]);
  const [demoMode, setDemoMode] = useState(true); 
  const [darkMode, setDarkMode] = useState(true); 
  
  const [rightPanelWidth, setRightPanelWidth] = useState(480);
  const [isResizing, setIsResizing] = useState(false);
  const [bubbles, setBubbles] = useState([]);
  const [activeId, setActiveId] = useState(null); 
  
  const [activePanel, setActivePanel] = useState('logs');
  const [expandedProperties, setExpandedProperties] = useState(new Set());
  const [extractedGhost, setExtractedGhost] = useState(null); 
  const [focusedBubble, setFocusedBubble] = useState(null);

  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [proposedCode, setProposedCode] = useState(null);

  const [fileTree, setFileTree] = useState([]);
  const [openTabs, setOpenTabs] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [fileContents, setFileContents] = useState({});
  const [loadingFile, setLoadingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  // Capture System Logs
  useEffect(() => {
      const handleSysLog = (e) => {
          if (e.data.type === 'SYSTEM_LOG') {
              setAiLog(prev => {
                  const newLog = { role: e.data.role || 'system', text: e.data.text };
                  if (prev.length > 0) {
                      const lastLog = prev[prev.length - 1];
                      if (lastLog.text === newLog.text && lastLog.role === newLog.role) return prev; 
                  }
                  return [...prev, newLog];
              });
          }
      };
      window.addEventListener('message', handleSysLog);
      return () => window.removeEventListener('message', handleSysLog);
  }, []);

  const colorToHex = (c) => { if (!c) return '#000000'; if (typeof c !== 'string') return '#000000'; if (c.startsWith('#')) return c; const m = c.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/); if (m) return '#'+[1,2,3].map(i => parseInt(m[i]).toString(16).padStart(2,'0')).join(''); return '#000000'; };
  const handleStyleChange = (id, label, prop, value) => { setBubbles(prev => prev.map(b => b.id === id ? { ...b, meta: { ...(b.meta || {}), [prop]: value } } : b)); try { window.postMessage({ type: 'UPDATE_STYLE', dataDarwinId: label, attr: prop, value}, '*'); } catch (e) {} };

  const handleDeleteBubble = (id) => { if (activeId === id) setActiveId(null); setBubbles(prev => prev.filter(b => b.id !== id)); };
  const toggleVisibility = (id) => { setBubbles(prev => prev.map(b => b.id === id ? { ...b, visible: !b.visible } : b)); };
  const toggleExpand = (id) => { const next = new Set(expandedProperties); if(next.has(id)) next.delete(id); else next.add(id); setExpandedProperties(next); };

  const getActiveColor = () => {
    const bubble = bubbles.find(b => b.id === activeId);
    return bubble ? bubble.color : null;
  };

  const handleBubbleDoubleClick = (id) => {
      const bubble = bubbles.find(b => b.id === id);
      if (bubble) {
          setFocusedBubble(bubble);
          setActiveId(id); 
      }
  };

  const fetchModelPredictions = useCallback(async (currentBubbles) => {
      setAiLog(prev => [...prev, { role: 'system', text: 'Fetching AI Model predictions...' }]);
      
      const newBubbles = await Promise.all(currentBubbles.map(async (b) => {
          let id = b.label;
          if (typeof id == "number") {
             const mockIds = ["nav-main", "hero-text", "btn-cta", "description", "btn-cta-2"];
             if(mockIds[id]) id = mockIds[id];
          }
          
          try {
              const resp = await fetch(APP_HOST + BACKEND_PORT + '/api/get_hit_count', { 
                  method: 'POST', 
                  headers: { 'Content-Type': 'application/json' }, 
                  body: JSON.stringify({ 
                      x: b.meta?.x || 0, 
                      y: b.meta?.y || 0, 
                      div_id: id,
                      predict_other: {}
                  }) 
              });
              if (!resp.ok) return b;
              const json = await resp.json();
              if (typeof json?.count === 'number') {
                  return { ...b, count: json.count };
              }
          } catch(e) { console.error(e); }
          return b;
      }));
      
      setBubbles(newBubbles);
      setAiLog(prev => [...prev, { role: 'success', text: 'Model data loaded.' }]);
  }, []);

  useEffect(() => {
    if (demoMode) {
        if (bubbles.length > 0) {
            fetchModelPredictions(bubbles);
        }
    } else {
        if (!repo) return;
        const repoId = repo.full_name;
        const unsubscribe = subscribeToSwarm(repoId, (type, data) => {
          if (type === 'users_full') {
            const activeIds = data ? Object.keys(data) : [];
            setTotalUsers(activeIds.length);
            setRawUsers(data || {});
          }
          if (type === 'clicks') {
             setClicksData(data || {}); 
             setBubbles(prevBubbles => 
                (prevBubbles || []).map(bubble => {
                  const newCount = data[bubble.label];
                  return (newCount !== undefined && newCount !== bubble.count) ? { ...bubble, count: newCount } : bubble;
                })
             );
          }
        }, false);
        return () => unsubscribe && unsubscribe();
    }
  }, [demoMode, repo]);

  function parseStyleInner(inner) {
    let x = null;
    let y = null;

    let backgroundColor = { r: null, g: null, b: null };
    let color = { r: null, g: null, b: null };

    // ---------- Extract left ----------
    const leftMatch = inner.match(/left\s*:\s*['"]?(\d+)?['"]?/);
    if (leftMatch) {
        x = parseInt(leftMatch[1], 10);
        inner = inner.replace(leftMatch[0], "");
    }

    // ---------- Extract top ----------
    const topMatch = inner.match(/top\s*:\s*['"]?(\d+)?['"]?/);
    if (topMatch) {
        y = parseInt(topMatch[1], 10);
        inner = inner.replace(topMatch[0], "");
    }

    // ---------- Color parsing helper ----------
    function parseColor(str) {
        if (!str) return { r: null, g: null, b: null };

        str = str.trim();

        if (str.startsWith("#")) {
            const hex = str.replace("#", "");
            return {
                r: parseInt(hex.substring(0, 2), 16),
                g: parseInt(hex.substring(2, 4), 16),
                b: parseInt(hex.substring(4, 6), 16)
            };
        }

        if (str.startsWith("rgb")) {
            const rgb = str.match(/\d+/g);
            if (rgb) {
                return {
                    r: parseInt(rgb[0]),
                    g: parseInt(rgb[1]),
                    b: parseInt(rgb[2])
                };
            }
        }

        return { r: null, g: null, b: null };
    }

      // ---------- Extract backgroundColor ----------
      const bgMatch = inner.match(/backgroundColor\s*:\s*['"]?([^,'"}]+)['"]?/);
      if (bgMatch) {
          backgroundColor = parseColor(bgMatch[1]);
          inner = inner.replace(bgMatch[0], "");
      }

      // ---------- Extract color ----------
      const colorMatch = inner.match(/color\s*:\s*['"]?([^,'"}]+)['"]?/);
      if (colorMatch) {
          color = parseColor(colorMatch[1]);
          inner = inner.replace(colorMatch[0], "");
      }

      // ---------- Clean commas ----------
      inner = inner.replace(/,,+/g, ",");
      inner = inner.replace(/^,|,$/g, "").trim();

      // ---------- Convert remaining style to object ----------
      const styleObject = {};

      if (inner.length > 0) {
          const pairs = inner.split(",");
          pairs.forEach(pair => {
              const [key, value] = pair.split(":");
              try { 
              if (key && value) {
                  styleObject[key.trim()] = parseInt(value.trim().replace(/^['"]|['"]$/g, "").replace("px", ""), 10);
              }
              } catch (e) {
                console.error(e);
              }
          });
      }

      // ---------- Insert RGB objects ----------
      styleObject.backgroundColor_R = backgroundColor.r ? backgroundColor.r : -1;
      styleObject.backgroundColor_G = backgroundColor.g ? backgroundColor.g : -1;
      styleObject.backgroundColor_B = backgroundColor.b ? backgroundColor.b : -1;
      styleObject.color_R = color.r ? color.r : -1;
      styleObject.color_G = color.g ? color.g : -1;
      styleObject.color_B = color.b ? color.b : -1;

      // console.log("PArse x", x)

      return {
          x,
          y,
          style: styleObject
      };
  }

  // --- UPDATE CODE ---
  const handleUpdateLayout = useCallback((id, newX, newY, newHeight, filePathArg, extra_style_update=false) => { 
    setBubbles(prev => prev.map(b => 
       b.id === id ? { ...b, position: [newX, newHeight ?? b.position[1], newY] } : b
    ));

    const fetchBackendCount = async () => { 
      try { 
        let div_id = id;
        if (typeof div_id == "number") {
           const mockIds = ["nav-main", "hero-text", "btn-cta", "description", "btn-cta-2"];
           if(mockIds[div_id]) div_id = mockIds[div_id];
        }
        const payload = { x: newX || 50, y: newY || 250, div_id: div_id, predict_other: predict_other };
        const resp = await fetch(APP_HOST + BACKEND_PORT + '/api/get_hit_count', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        }); 
        if (!resp.ok) return;
        const json = await resp.json(); 
        if (typeof json?.count === 'number') {
            setBubbles(prev => {
              const updated = prev.map(b => b.label === div_id ? { ...b, count : json?.count} : b);
              
              const total = updated.reduce((sum, b) => sum + (b.count || 0), 0);
              setTotalDemoUsers(total);
              
              return updated;
            });
        }
      } catch (e) { console.error(e); } 
    }; 

    if (demoMode) {
      // 1. Identify File
      const bubble = bubbles.find(b => b.id === id);
      const filePath = filePathArg || bubble?.meta?.file || 'src/App.jsx';
      var predict_other = {};

      // 2. Update Code
      setFileContents(prev => {
        const code = prev[filePath];
        if (!code) return prev; 

        var newCode = code;
        
        if (extra_style_update) {
          const { attr, value } = extra_style_update;
          const mappedAttr = attr === 'bgColor' ? 'backgroundColor' : attr;
          newCode = code.replace(/<(nav|button|h1|div|section|header|p|span)\b([^>]*)>/g, (fullMatch, tag, props) => {
            let shouldUpdate = false;
            const idToMatch = id;
            const idRegex = new RegExp('data-darwin-id\\s*=\\s*["\']' + idToMatch + '["\']');
            const idAttrRegex = new RegExp('id\\s*=\\s*["\']' + idToMatch + '["\']');
            if (idRegex.test(props) || idAttrRegex.test(props)) shouldUpdate = true;
            if (shouldUpdate) {
              let newProps = props;
              const attrEqRegex = new RegExp(mappedAttr + "\\s*=\\s*['\"]([^'\"]*)['\"]");
              if (attrEqRegex.test(newProps)) {
                newProps = newProps.replace(attrEqRegex, `${mappedAttr}="${value}"`);
              } else {
                const styleObjRegex = /style=\{\{([\s\S]*?)\}\}/;
                const styleMatch = newProps.match(styleObjRegex);
                if (styleMatch) {
                  let inner = styleMatch[1];
                  const stylePropRegex = new RegExp(mappedAttr + "\\s*:\\s*['\"]?([^,'\"}]+)['\"]?");
                  if (stylePropRegex.test(inner)) inner = inner.replace(stylePropRegex, `${mappedAttr}: '${value}'`);
                  else { inner = inner.trim(); if (inner.length > 0 && !inner.endsWith(',')) inner = inner + ', '; inner = inner + `${mappedAttr}: '${value}'`; }
                  inner = inner.replace(/''/g, "");
                  var {x, y, style} = parseStyleInner(inner);
                  newX = x;
                  newY = y;
                  newProps = newProps.replace(styleObjRegex, `style={{${inner}}}`)
                  // console.log(x)
                  predict_other = style;
                }
              }
              return `<${tag}${newProps}>`;
            }
            return fullMatch;
          })
        }

        // --- NEW FIX: TOLERANT REGEX FOR ARROW FUNCTIONS => ---
        // Matches the tag start, the ID, and ignores '>' if they are part of '=>'
        const regex = new RegExp(`(<(?:=>|[^>])*\\bdata-darwin-id=["']${id}["'](?:=>|[^>])*>)`, 'g');
        
        if (newX != undefined && newY != undefined) {
          newCode = newCode.replace(regex, (matchTag) => {
              console.log(matchTag);
              if (matchTag.match(/style={{/)) {
                  return matchTag.replace(/style={{([\s\S]*?)}}/, (fullStyle, innerStyle) => {
                      let updatedStyle = innerStyle;
                      
                      const setStyle = (prop, val) => {
                          // Regex allows decimals and quotes
                          const propRegex = new RegExp(`${prop}\\s*:\\s*(?:'[^']*'|"[^"]*"|[\\d\\w.-]+)`);
                          if (propRegex.test(updatedStyle)) {
                            updatedStyle = updatedStyle.replace(propRegex, `${prop}: '${val}'`);
                          } else {
                            updatedStyle += `, ${prop}: '${val}'`;
                          }
                      };

                      setStyle('left', newX + 'px');
                      setStyle('top', newY + 'px');
                      if (!updatedStyle.includes('position')) {
                          updatedStyle += `, position: 'absolute'`;
                      }
                      return `style={{${updatedStyle}}}`;
                  });
              } else {
                  const styleString = ` style={{ position: 'absolute', left: '${newX}px', top: '${newY}px' }}`;

                  // --- NEW FIX: SAFE INJECTION AT END OF TAG ---
                  // Instead of searching for the first '>', we use regex anchors to find the true end
                  if (matchTag.trim().endsWith('/>')) {
                      return matchTag.replace(/\/>$/, `${styleString} />`);
                  } else {
                      return matchTag.replace(/>$/, `${styleString}>`);
                  }
              }
          });
        }
        fetchBackendCount(); 

        if (newCode === code) return prev;
        return { ...prev, [filePath]: newCode };
      });
    }
    }, [demoMode, bubbles]); 

  useEffect(() => {
    const total = bubbles.reduce((sum, b) => sum + (b.count || 0), 0);
    setTotalDemoUsers(total);
  }, [bubbles])

  useEffect(() => {
    if (!extractedGhost) return;
    const handleGlobalMove = (e) => { setExtractedGhost(prev => ({ ...prev, x: e.clientX, y: e.clientY })); };
    const handleGlobalUp = (e) => {
       const sceneWidth = window.innerWidth - rightPanelWidth;
       if (e.clientX < sceneWidth) {
          const isDuplicate = bubbles.some(b => b.id === extractedGhost.id);
          if (isDuplicate) {
             setAiLog(prev => [...prev, { role: 'error', text: `⚠️ Error: '${extractedGhost.tag}' is already active` }]);
             setActivePanel('logs'); 
          } else {
             const nextColor = NEON_PALETTE[bubbles.length % NEON_PALETTE.length];
             const normalizedX = ((e.clientX / sceneWidth) - 0.5) * 20; 
             const normalizedZ = ((e.clientY / window.innerHeight) - 0.5) * 20; 
             setBubbles(prev => [...prev, { id: extractedGhost.id, label: extractedGhost.tag, count: clicksData[extractedGhost.tag] || 0, visible: true, color: nextColor, position: [normalizedX, 3, normalizedZ], meta: extractedGhost.meta || {} }]);
             setAiLog(prev => [...prev, { role: 'success', text: `Now tracking for ${extractedGhost.tag}` }]);
             setActivePanel('properties'); 
          }
       }
       setExtractedGhost(null); 
    };
    window.addEventListener('mousemove', handleGlobalMove); window.addEventListener('mouseup', handleGlobalUp);
    return () => { window.removeEventListener('mousemove', handleGlobalMove); window.removeEventListener('mouseup', handleGlobalUp); };
  }, [extractedGhost, rightPanelWidth, bubbles, clicksData]);

  useEffect(() => {
    const handleMove = (e) => {
      if (isResizing) {
        const newWidth = window.innerWidth - e.clientX;
        const clampedWidth = Math.max(300, Math.min(newWidth, window.innerWidth - 100));
        setRightPanelWidth(clampedWidth);
      }
    };
    const handleUp = () => { setIsResizing(false); document.body.style.userSelect = ''; document.body.style.cursor = ''; };
    if (isResizing) { window.addEventListener('mousemove', handleMove); window.addEventListener('mouseup', handleUp); document.body.style.userSelect = 'none'; document.body.style.cursor = 'col-resize'; }
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
  }, [isResizing]);

  const handleClearEnvironment = () => { setTotalUsers(0); setBubbles([]); };
  const handleFileSelect = async (file) => { 
    if (file.type === 'dir') return; 
    setOpenTabs(prev => { if (prev.includes(file.path)) return prev; return [...prev, file.path]; }); 
    setActiveTab(file.path); 
    if (fileContents[file.path]) return fileContents[file.path]; 
    setLoadingFile(true); 
    const octokit = new Octokit({ auth: token }); 
    try { 
      const { data } = await octokit.request('GET /repos/{owner}/{repo}/git/blobs/{file_sha}', { owner: repo.owner.login, repo: repo.name, file_sha: file.sha }); 
      
      let content;
      if (isImageFile(file.path)) {
         const ext = file.path.split('.').pop().toLowerCase();
         const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
         content = `data:${mime};base64,${data.content.replace(/\n/g, '')}`;
      } else {
         const binaryString = atob(data.content);
         const bytes = new Uint8Array(binaryString.length);
         for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
         }
         content = new TextDecoder().decode(bytes);
      }

      setFileContents(prev => ({ ...prev, [file.path]: content })); 
      return content; 
    } catch (e) {console.error(e);} 
    finally { setLoadingFile(false); } 
  };
  useEffect(() => { 
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
        
        const srcFiles = treeData.tree.filter(f => f.path.startsWith('src/') && (
            f.path.endsWith('.jsx') || f.path.endsWith('.js') || f.path.endsWith('.css') || isImageFile(f.path)
        ));
        setAiLog(prev => [...prev, { role: 'system', text: `Loading ${srcFiles.length} project files...` }]);
        
        await Promise.all(srcFiles.map(f => handleFileSelect(f)));

        setAiLog(prev => [...prev, { role: 'success', text: 'Project loaded successfully.' }]); 

        const appFile = srcFiles.find(f => f.path.includes('App.jsx')) || srcFiles[0];
        if (appFile) setActiveTab(appFile.path);

      } catch (err) { console.error(err); } 
    } 
    initSync(); 
  }, [token, repo]);
  const handleAcceptAi = () => {
      if (proposedCode) {
          setFileContents(prev => ({ ...prev, ['src/App.jsx']: proposedCode }));
          setProposedCode(null);
          setAiPrompt("");
          setAiLog(prev => [...prev, { role: 'success', text: 'AI Changes Applied' }]);
      }
  };
  const handleTabClose = (path) => { const newTabs = openTabs.filter(t => t !== path); setOpenTabs(newTabs); if (activeTab === path) setActiveTab(newTabs.length > 0 ? newTabs[newTabs.length - 1] : null); };
  const handleCodeChange = (path, newCode) => { setFileContents(prev => ({ ...prev, [path]: newCode })); };
  const handleCodeUpdateFromPreview = (newCode) => { if (activeTab === 'src/App.jsx') setFileContents(prev => ({ ...prev, [activeTab]: newCode })); };
  const handleExtractStart = (tag, id, clientX, clientY, meta) => { const iframeRect = document.querySelector('iframe')?.getBoundingClientRect(); if (iframeRect) { setExtractedGhost({ tag: tag || 'Component', id: id, x: iframeRect.left + clientX, y: iframeRect.top + clientY, meta: meta }); } };
  const handleCommitChanges = async () => {
    // 1. Safety check
    if (Object.keys(fileContents).length === 0) return;
    
    setIsSaving(true);
    const octokit = new Octokit({ auth: token });
    
    try {
      // 2. Get latest commit and base tree
      const { data: refData } = await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', {
        owner: repo.owner.login,
        repo: repo.name,
        ref: `heads/${repo.default_branch}`,
      });
      const latestCommitSha = refData.object.sha;

      const { data: commitData } = await octokit.request('GET /repos/{owner}/{repo}/git/commits/{commit_sha}', {
        owner: repo.owner.login,
        repo: repo.name,
        commit_sha: latestCommitSha,
      });
      const baseTreeSha = commitData.tree.sha;

      // 3. Prepare blobs for ALL text files in fileContents
      // We filter out images to avoid corrupting them (since they are stored as Data URIs in state)
      const filesToUpload = Object.entries(fileContents).filter(([path]) => !isImageFile(path));
      
      const newTreeItems = await Promise.all(filesToUpload.map(async ([path, content]) => {
        const { data: blobData } = await octokit.request('POST /repos/{owner}/{repo}/git/blobs', {
          owner: repo.owner.login,
          repo: repo.name,
          content: content,
          encoding: 'utf-8',
        });
        
        return {
          path: path,
          mode: '100644',
          type: 'blob',
          sha: blobData.sha,
        };
      }));

      // 4. Create a new tree with ALL changes
      const { data: newTreeData } = await octokit.request('POST /repos/{owner}/{repo}/git/trees', {
        owner: repo.owner.login,
        repo: repo.name,
        base_tree: baseTreeSha,
        tree: newTreeItems,
      });

      // 5. Create commit
      const { data: newCommitData } = await octokit.request('POST /repos/{owner}/{repo}/git/commits', {
        owner: repo.owner.login,
        repo: repo.name,
        message: `Update ${newTreeItems.length} files via Darwin`,
        tree: newTreeData.sha,
        parents: [latestCommitSha],
      });

      // 6. Push
      await octokit.request('PATCH /repos/{owner}/{repo}/git/refs/{ref}', {
        owner: repo.owner.login,
        repo: repo.name,
        ref: `heads/${repo.default_branch}`,
        sha: newCommitData.sha,
      });

      setAiLog(prev => [...prev, { role: 'success', text: `Successfully pushed ${newTreeItems.length} files.` }]);
    } catch (error) {
      console.error(error);
      setAiLog(prev => [...prev, { role: 'error', text: `Failed to push: ${error.message}` }]);
    } finally {
      setIsSaving(false);
    }
  };
  const handleAiGenerate = async () => {};

  return (
    <div className={`h-screen w-screen bg-white dark:bg-black text-gray-900 dark:text-white flex overflow-hidden font-sans transition-colors duration-300 ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
      {/* ... Left Sidebar (Same as before) ... */}
      <div className="w-16 border-r border-gray-200 dark:border-white/5 flex flex-col items-center py-6 gap-6 z-30 bg-gray-50 dark:bg-[#0a0a0a] shrink-0 transition-colors duration-300">
        <img src={logo} className="w-10 h-10" alt="Logo" />
        <div className="flex flex-col gap-4">
            <button onClick={() => setViewMode('simulation')} className={`p-3 rounded-xl transition-all ${viewMode === 'simulation' ? 'text-neon-blue bg-blue-50 dark:bg-transparent' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}><Layers size={20} /></button>
            <button onClick={() => setViewMode('analytics')} className={`p-3 rounded-xl transition-all ${viewMode === 'analytics' ? 'text-yellow-500 bg-yellow-50 dark:text-yellow-400 dark:bg-transparent' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}><BarChart2 size={20} /></button>
            <button onClick={() => setViewMode('code')} className={`p-3 rounded-xl transition-all ${viewMode === 'code' ? 'text-purple-600 bg-purple-50 dark:text-neon-purple dark:bg-transparent' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}><Code size={20} /></button>
            <button onClick={() => setViewMode('history')} className={`p-3 rounded-xl transition-all ${viewMode === 'history' ? 'text-orange-500 bg-orange-50 dark:text-orange-500 dark:bg-transparent' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}><History size={20} /></button>
            <button onClick={() => setActivePanel('ai')} className={`p-3 rounded-xl transition-all ${activePanel === 'ai' ? 'text-pink-600 bg-pink-50 dark:text-pink-400 dark:bg-pink-500/10' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}><Sparkles size={20} /></button>
            <button onClick={() => setActivePanel('properties')} className={`p-3 rounded-xl transition-all ${activePanel === 'properties' ? 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-500/10' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}><Shapes size={20} /></button>
        </div>
        <div className="mt-auto flex flex-col gap-4 items-center">
          <button onClick={() => setDarkMode(!darkMode)} className="p-3 rounded-xl text-gray-500 hover:text-black dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition-all" title="Toggle Theme">{darkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
          <button onClick={onBack} className="p-3 text-gray-500 hover:text-red-500 transition-colors"><ArrowLeft size={20} /></button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative bg-gray-200 dark:bg-[#0a0a0a] overflow-hidden flex flex-col transition-colors duration-300">
        {viewMode === 'simulation' ? (
          <div className="relative w-full h-full group">
             <Scene 
                bubbles={bubbles} 
                userCount={demoMode ? totalDemoUsers : totalUsers} 
                activeId={activeId} 
                setActiveId={setActiveId} 
                darkMode={darkMode} 
                rawUsers={rawUsers} 
                demoMode={demoMode}
                focusedBubble={focusedBubble} 
                onBubbleDoubleClick={handleBubbleDoubleClick}
                onUpdateBubblePosition={handleUpdateLayout}
             />
             {focusedBubble && (
                <div 
                    className="absolute top-1/2 right-12 -translate-y-1/2 w-96 bg-white/80 dark:bg-black/80 backdrop-blur-2xl border-2 p-8 rounded-[2.5rem] shadow-2xl z-50 text-gray-900 dark:text-white animate-in fade-in zoom-in-95 duration-300"
                    style={{ borderColor: focusedBubble.color, boxShadow: `0 0 30px ${focusedBubble.color}66` }}
                >
                    <button onClick={() => setFocusedBubble(null)} className="absolute top-6 right-6 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 transition-colors"><X size={24} /></button>
                    <div className="flex flex-col gap-3 mb-8">
                        <div className="flex flex-wrap gap-2 mb-1">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white/50 dark:bg-white/10 border border-white/20" style={{ color: focusedBubble.color, borderColor: `${focusedBubble.color}40` }}>
                                <Tag size={12} />
                                {focusedBubble.meta?.type || 'COMPONENT'}
                            </div>
                        </div>
                        <h2 className="text-4xl font-black tracking-tight leading-none break-all">{focusedBubble.label}</h2>
                        <div className="flex items-center gap-2 text-xs font-mono text-gray-500 bg-gray-100 dark:bg-white/5 p-2 rounded-lg border border-gray-200 dark:border-white/10">
                            <FileCode size={14} className="shrink-0" />
                            <span className="truncate" title={focusedBubble.meta?.file || 'src/App.jsx'}>{focusedBubble.meta?.file || 'src/App.jsx'}</span>
                        </div>
                    </div>
                    {/* Stats & Details */}
                    <div className="space-y-4">
                        <div className="bg-white/50 dark:bg-white/5 p-5 rounded-2xl border border-white/20 dark:border-white/5">
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mb-1">Total Interactions</div>
                            <div className="text-5xl font-mono font-medium tracking-tighter text-transparent bg-clip-text" style={{ backgroundImage: `linear-gradient(to right, ${focusedBubble.color}, #ffffff)` }}>{focusedBubble.count}</div>
                        </div>
                        {/* More property grids... */}
                    </div>
                </div>
             )}
             {extractedGhost && (<div className="absolute inset-0 bg-blue-500/10 border-4 border-blue-500/50 flex items-center justify-center pointer-events-none z-10"><div className="bg-black/80 px-4 py-2 rounded text-blue-400 font-mono font-bold">DROP TO TRACK</div></div>)}
             <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
                <div className="bg-white/80 dark:bg-black/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 pl-6 pr-2 py-2 rounded-full flex items-center gap-6 shadow-2xl transition-colors">
                   <div className="flex items-center gap-3 pr-4 border-r border-gray-300 dark:border-white/10">
                      <Users size={16} className="text-gray-500" />
                      <div className="flex items-baseline gap-2"><span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Active Swarm</span><span className="text-lg font-mono text-neon-blue leading-none">{demoMode ? totalDemoUsers : totalUsers}</span></div>
                   </div>
                   <div className="flex items-center gap-1">
                        <button onClick={handleClearEnvironment} className="p-2 hover:bg-red-500/10 dark:hover:bg-red-500/20 rounded-full text-gray-400 hover:text-red-500" title="Clear"><Trash2 size={16} /></button>
                   </div>
                   <div className="bg-gray-100 dark:bg-white/5 p-1 rounded-full flex ml-2">
                      <button onClick={() => setDemoMode(true)} className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${demoMode ? 'bg-neon-blue text-white shadow-lg' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}>REPO</button>
                      <button onClick={() => setDemoMode(false)} className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${!demoMode ? 'bg-red-500 text-white shadow-lg' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}>LIVE</button>
                   </div>
                </div>
             </div>
          </div>
        ) : viewMode === 'analytics' ? (
          <AnalyticsPanel rawUsers={rawUsers} clicksData={clicksData} />
        ) : viewMode === 'history' ? (    
          <HistoryPanel repo={repo} token={token} />
        ) : (
          <EditorWorkspace 
            fileTree={fileTree} 
            openTabs={openTabs} 
            activeTab={activeTab} 
            fileContents={fileContents} 
            onFileSelect={handleFileSelect} 
            onTabClose={handleTabClose} 
            onTabClick={setActiveTab} 
            onCodeChange={handleCodeChange}
            onSave={handleCommitChanges}
            loadingFile={loadingFile} 
            isSaving={isSaving}
          />
        )}
      </div>
      <div onMouseDown={() => setIsResizing(true)} className={`w-1 cursor-col-resize transition-colors ${isResizing ? 'bg-neon-blue' : 'bg-gray-200 hover:bg-gray-300 dark:bg-white/5 dark:hover:bg-neon-blue/40'}`} />
      
      {/* Right Panel (Logs, Properties, AI) */}
      <div style={{ width: rightPanelWidth }} className="flex flex-col bg-white dark:bg-[#111] shrink-0 border-l border-gray-200 dark:border-white/5 relative transition-colors duration-300">
         {extractedGhost && (<div className="fixed z-50 pointer-events-none flex items-center gap-2 bg-[#bc13fe] text-white px-3 py-2 rounded-lg shadow-xl font-bold text-xs" style={{ left: extractedGhost.x, top: extractedGhost.y, transform: 'translate(-50%, -50%)' }}><MousePointer2 size={14} className="fill-white" /><span>{extractedGhost.tag}</span><div className="bg-white text-[#bc13fe] px-1.5 rounded text-[10px]">+ ADD</div></div>)}
         <div className="h-1/2">
           <div className="flex flex-col h-full bg-white dark:bg-[#1e1e1e]">
              <div className="h-10 flex items-center justify-between px-4 bg-gray-100 dark:bg-[#252526] border-b border-gray-200 dark:border-black/20"><span className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400 flex items-center gap-2"><Globe size={12}/> Live Preview</span><div className={`text-[10px] px-2 rounded flex items-center gap-1 ${demoMode ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400'}`}>{demoMode ? 'EDIT MODE' : 'EXTRACT MODE'}</div></div>
              <div className="flex-1 bg-white relative">
                 {isResizing && <div className="absolute inset-0 z-50 bg-transparent" />}
                 <IframeRenderer 
                   files={fileContents} 
                   proposedCode={proposedCode}
                   onUpdateCode={handleCodeUpdateFromPreview} 
                   handleUpdateLayout={handleUpdateLayout} 
                   mode={demoMode ? 'edit' : 'live'} 
                   onExtractStart={handleExtractStart} 
                   activeId={activeId}
                   activeColor={getActiveColor()}
                 />
              </div>
           </div>
         </div>
         {/* Bottom Half of Right Panel */}
         <div className="h-1/2 border-t border-gray-200 dark:border-white/10 flex flex-col bg-gray-50 dark:bg-black/40">
            <div className="flex border-b border-gray-200 dark:border-white/10">
               <button onClick={() => setActivePanel('logs')} className={`px-4 py-2 text-[10px] font-bold uppercase flex items-center gap-2 ${activePanel === 'logs' ? 'bg-yellow-50 text-yellow-600 border-b-2 border-yellow-500 dark:bg-white/10 dark:text-yellow-500' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}><Zap size={12} /> System Logs</button>
               <button onClick={() => setActivePanel('properties')} className={`px-4 py-2 text-[10px] font-bold uppercase flex items-center gap-2 ${activePanel === 'properties' ? 'bg-green-50 text-green-600 border-b-2 border-green-500 dark:bg-white/10 dark:text-green-400' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}><Shapes size={12} /> Properties</button>
               <button onClick={() => setActivePanel('ai')} className={`px-4 py-2 text-[10px] font-bold uppercase flex items-center gap-2 ${activePanel === 'ai' ? 'bg-pink-50 text-pink-600 border-b-2 border-pink-500 dark:bg-white/10 dark:text-pink-400' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}><Sparkles size={12} /> AI ASSISTANT</button>
            </div>
            <div className="flex-1 overflow-y-auto font-mono text-[10px] p-0">
               {activePanel === 'ai' && (
                   <div className="p-4 flex flex-col h-full">
                       {/* AI Panel Content */}
                       {proposedCode ? (
                           <div className="flex-1 flex flex-col gap-3">
                               <div className="p-3 bg-green-500/10 border border-green-500/20 rounded text-green-600 dark:text-green-400">
                                   <div className="flex items-center gap-2 font-bold mb-1"><Check size={14}/> Code Generated!</div>
                                   <div>Previewing changes in the window above.</div>
                               </div>
                               <div className="flex gap-2 mt-auto">
                                   <button onClick={handleAcceptAi} className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white rounded font-bold flex items-center justify-center gap-2"><Check size={14}/> ACCEPT</button>
                                   <button onClick={() => setProposedCode(null)} className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-white/10 dark:hover:bg-white/20 text-gray-600 dark:text-gray-300 rounded font-bold flex items-center justify-center gap-2"><X size={14}/> DISCARD</button>
                               </div>
                           </div>
                       ) : (
                           <div className="flex-1 flex flex-col gap-3">
                               <div className="text-gray-500 italic mb-2">Ask Gemini to modify your App.jsx...</div>
                               <textarea 
                                   className="flex-1 w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded p-3 resize-none outline-none focus:border-pink-500 transition-colors"
                                   placeholder="e.g. 'Make the background dark blue' or 'Add a title at the top'"
                                   value={aiPrompt}
                                   onChange={(e) => setAiPrompt(e.target.value)}
                               />
                               <button 
                                   onClick={handleAiGenerate}
                                   disabled={isAiGenerating || !aiPrompt.trim()}
                                   className="py-2 bg-pink-500 hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded font-bold flex items-center justify-center gap-2 transition-all"
                               >
                                   {isAiGenerating ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>}
                                   {isAiGenerating ? 'GENERATING...' : 'GENERATE'}
                               </button>
                           </div>
                       )}
                   </div>
               )}
               {activePanel === 'logs' && (
                  <div className="p-4 space-y-2">
                     {aiLog.map((log, i) => (
                        <div key={i} className={`p-2 rounded border-l-2 ${
                           log.role === 'success' ? 'border-green-500 bg-green-100 text-green-700 dark:bg-green-500/5 dark:text-green-400' : 
                           log.role === 'error' ? 'border-red-500 bg-red-100 text-red-700 dark:bg-red-500/5 dark:text-red-400' : 
                           'border-gray-300 bg-white text-gray-600 dark:border-gray-700 dark:bg-white/5 dark:text-gray-500'
                        }`}>
                           {log.text}
                        </div>
                     ))}
                  </div>
               )}
               {activePanel === 'properties' && (
                  <div className="p-2 space-y-1">
                     {bubbles.length === 0 ? (
                        <div className="text-gray-500 text-center py-8 italic">No active trackers. Drag elements from the preview here.</div>
                     ) : (
                        bubbles.map((b) => (
                           <div key={b.id} className={`bg-white dark:bg-[#222] rounded overflow-hidden border border-gray-200 dark:border-transparent hover:border-gray-300 dark:hover:border-white/10 transition-colors shadow-sm dark:shadow-none ${!b.visible ? 'opacity-50' : ''}`}>
                              <div className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-[#333]">
                                 <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => toggleExpand(b.id)}>
                                     {expandedProperties.has(b.id) ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                                     <div className={`w-2 h-2 rounded-full ${b.visible ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-gray-400 dark:bg-gray-600'}`} style={{ backgroundColor: b.color || 'gray' }} />
                                     <span className="text-gray-700 dark:text-gray-300 font-bold text-xs">{b.label || 'Component'}</span>
                                     <span className="text-gray-400 dark:text-gray-500 text-[8px] uppercase tracking-wider ml-1">#{b.id}</span>
                                 </div>
                                 <div className="flex items-center gap-1">
                                    <button onClick={(e) => { e.stopPropagation(); toggleVisibility(b.id); }} className="text-gray-400 hover:text-black dark:text-gray-500 dark:hover:text-white p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10">
                                        {b.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteBubble(b.id); }} className="text-gray-400 hover:text-red-500 dark:text-gray-500 p-1 ml-2 transition-colors" title="Delete Tracker"><Trash2 size={12} /></button>
                                 </div>
                              </div>
                              {expandedProperties.has(b.id) && (
                                <div className="bg-gray-50 dark:bg-black/40 p-2 text-[9px] text-gray-600 dark:text-gray-400 space-y-1 border-t border-gray-200 dark:border-white/5">
                                   <div className="flex items-center justify-between"><div className="flex items-center gap-1"><MousePointerClick size={10}/> Interactions</div> <span className="text-green-600 dark:text-green-400 font-mono">{b.count}</span></div>
                                   <div className="flex items-center justify-between"><div className="flex items-center gap-1"><Code size={10}/> Type</div> <span className="text-black dark:text-white font-mono">{b.meta?.type || 'Unknown'}</span></div>
                                    <div className="flex items-center justify-between">
                                     <div className="flex items-center gap-1"><Move size={10}/> Dimensions</div>
                                     <div className="flex items-center gap-2">
                                       <input
                                          type="number"
                                          value={b.meta?.width ? parseInt(b.meta.width) : ''}
                                          onChange={(e) => { const v = e.target.value ? `${e.target.value}px` : ''; handleStyleChange(b.id, b.label, 'width', v); }}
                                          className="w-20 p-1 rounded border border-gray-300 dark:border-white/10 text-black dark:text-white bg-white dark:bg-transparent text-[10px]"
                                       />
                                       <span className="text-gray-500">x</span>
                                       <input
                                          type="number"
                                          value={b.meta?.height ? parseInt(b.meta.height) : ''}
                                          onChange={(e) => { const v = e.target.value ? `${e.target.value}px` : ''; handleStyleChange(b.id, b.label, 'height', v); }}
                                          className="w-20 p-1 rounded border border-gray-300 dark:border-white/10 text-black dark:text-white bg-white dark:bg-transparent text-[10px]"
                                       />
                                     </div>
                                   </div>
                                   <div className="flex items-center justify-between"><div className="flex items-center gap-1"><MapPin size={10}/> Position</div> <span>{b.meta?.x}, {b.meta?.y}</span></div>
                                   <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1"><Palette size={10}/> Color</div>
                                      <div className="flex items-center gap-2">
                                        <input type="color" value={colorToHex(b.meta?.bgColor)} onChange={(e) => handleStyleChange(b.id, b.label, 'bgColor', e.target.value)} className="w-8 h-8 p-0 border border-gray-300 dark:border-white/10 rounded" />
                                        <div className="w-3 h-3 rounded-full border border-gray-300 dark:border-white/20" style={{backgroundColor: b.meta?.bgColor}}></div>
                                        <span className="font-mono ml-2">{b.meta?.color}</span>
                                      </div>
                                   </div>
                                </div>
                              )}
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