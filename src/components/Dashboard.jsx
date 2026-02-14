import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Octokit } from "@octokit/rest"; 
import { Layers, Zap, Shapes, Code, FileCode, ArrowLeft, Globe, Folder, ChevronRight, ChevronDown, Loader2, Trash2, Camera, Users, MousePointer2, Eye, EyeOff, Move, Palette, MapPin, MousePointerClick, X, BarChart2, Sun, Moon, Save, GitCommit, Sparkles, Check, MessageSquare } from 'lucide-react';
import Scene from './Scene';
import AnalyticsPanel from './AnalyticsPanel';
import { subscribeToSwarm } from '../lib/firebase';
import {APP_HOST, BACKEND_PORT, PORT} from "../constants";
import { parse } from 'postcss';

const NEON_PALETTE = ["#00f3ff", "#bc13fe", "#ff0055", "#ccff00", "#ffaa00", "#00ff99", "#ff00ff", "#0099ff"];

// --- 1. RUNTIME RENDERER (Fixed) ---
// --- 1. RUNTIME RENDERER (Fixed) ---
const IframeRenderer = ({ code, onUpdateCode, handleUpdateLayout, mode, onExtractStart, activeId, activeColor }) => {
  const iframeRef = useRef(null);

  const sendSelection = useCallback(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ 
        type: 'SYNC_SELECTION', 
        id: activeId, 
        color: activeColor 
      }, '*');
    }
  }, [activeId, activeColor]);

  useEffect(() => {
    sendSelection();
  }, [sendSelection]);

  function parseStyleInner(inner) {
    let x = null;
    let y = null;
    let backgroundColor = { r: null, g: null, b: null };
    let color = { r: null, g: null, b: null };

    const leftMatch = inner.match(/left\s*:\s*['"]?(\d+)?['"]?/);
    if (leftMatch) { x = parseInt(leftMatch[1], 10); inner = inner.replace(leftMatch[0], ""); }

    const topMatch = inner.match(/top\s*:\s*['"]?(\d+)?['"]?/);
    if (topMatch) { y = parseInt(topMatch[1], 10); inner = inner.replace(topMatch[0], ""); }

    function parseColor(str) {
        if (!str) return { r: null, g: null, b: null };
        str = str.trim();
        if (str.startsWith("#")) {
            const hex = str.replace("#", "");
            return { r: parseInt(hex.substring(0, 2), 16), g: parseInt(hex.substring(2, 4), 16), b: parseInt(hex.substring(4, 6), 16) };
        }
        return { r: null, g: null, b: null };
    }

    const bgMatch = inner.match(/backgroundColor\s*:\s*['"]?([^,'"}]+)['"]?/);
    if (bgMatch) { backgroundColor = parseColor(bgMatch[1]); inner = inner.replace(bgMatch[0], ""); }

    const colorMatch = inner.match(/color\s*:\s*['"]?([^,'"}]+)['"]?/);
    if (colorMatch) { color = parseColor(colorMatch[1]); inner = inner.replace(colorMatch[0], ""); }

    inner = inner.replace(/,,+/g, ",").replace(/^,|,$/g, "").trim();
    const styleObject = {};
    if (inner.length > 0) {
        const pairs = inner.split(",");
        pairs.forEach(pair => {
            const [key, value] = pair.split(":");
            try { if (key && value) styleObject[key.trim()] = parseInt(value.trim().replace(/^['"]|['"]$/g, "").replace("px", ""), 10); } catch (e) {}
        });
    }
    styleObject.backgroundColor_R = backgroundColor.r ?? -1;
    styleObject.backgroundColor_G = backgroundColor.g ?? -1;
    styleObject.backgroundColor_B = backgroundColor.b ?? -1;
    styleObject.color_R = color.r ?? -1;
    styleObject.color_G = color.g ?? -1;
    styleObject.color_B = color.b ?? -1;

    return { x, y, style: styleObject };
  }

  // --- UPDATED REGEX LIST TO INCLUDE SEMANTIC TAGS ---
  const TAGS_REGEX = "nav|button|h1|h2|h3|div|section|header|footer|main|article|aside|p|span|ul|li|a|img|form|input";

  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data.type === 'UPDATE_POS') {
        const { index, x, y, dataDarwinId } = e.data;
        let matchCount = 0;
        const newCode = code.replace(new RegExp(`<(${TAGS_REGEX})\\b([^>]*)>`, 'g'), (fullMatch, tag, props) => {
            if (matchCount === index) {
               let newProps = props;
               if (newProps.match(/left:\s*\d+/)) newProps = newProps.replace(/left:\s*(\d+)/, `left: ${Math.round(x)}`);
               else if (newProps.includes('style={{')) newProps = newProps.replace(/style=\{\{/, `style={{ left: ${Math.round(x)}, `);
               else newProps = newProps + ` style={{ left: ${Math.round(x)} }}`;

               if (newProps.match(/top:\s*\d+/)) newProps = newProps.replace(/top:\s*(\d+)/, `top: ${Math.round(y)}`);
               else if (newProps.includes('style={{')) newProps = newProps.replace(/style=\{\{/, `style={{ top: ${Math.round(y)}, `);
               else if (!newProps.includes('style=')) newProps = newProps + ` style={{ top: ${Math.round(y)} }}`;
               
               matchCount++;
               return `<${tag}${newProps}>`;
            }
            matchCount++;
            return fullMatch; 
        });
        if (newCode !== code) onUpdateCode(newCode);
        handleUpdateLayout(dataDarwinId || index, x, y);
      }
      if (e.data.type === 'UPDATE_STYLE') {
        const { index, attr, value } = e.data;
        let matchCount = 0;
        const mappedAttr = attr === 'bgColor' ? 'backgroundColor' : attr;
        const newCode = code.replace(new RegExp(`<(${TAGS_REGEX})\\b([^>]*)>`, 'g'), (fullMatch, tag, props) => {
          if (matchCount === index) {
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
                newProps = newProps.replace(styleObjRegex, `style={{${inner}}}`);
                var {x, y, style} = parseStyleInner(inner);
                handleUpdateLayout(index, x, y, style);
              } else {
                newProps = newProps + ` style={{ ${mappedAttr}: '${value}' }}`;
              }
            }
            matchCount++;
            return `<${tag}${newProps}>`;
          }
          matchCount++;
          return fullMatch;
        });
        if (newCode !== code) onUpdateCode(newCode);
      }
      if (e.data.type === 'EXTRACT_COMPONENT') onExtractStart(e.data.tag, e.data.id, e.data.clientX, e.data.clientY, e.data.meta);
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [code, onUpdateCode, onExtractStart, handleUpdateLayout]);

  const prepareTransformedCode = () => {
    try {
      let count = 0;
      return code
        .replace(/import.*?;/g, '') // Remove imports
        .replace(/export default function\s+(\w+)/, 'function $1') // Handle "export default function App"
        .replace(/export default \w+;/, '') // Handle "export default App;" at end
        .replace(new RegExp(`<(${TAGS_REGEX})\\b([^>]*)>`, 'g'), (match, tag, props) => {
             const currentIndex = count++;
             return `<InteractiveElement _tag="${tag}" _darwinIndex={${currentIndex}}${props}>`;
        })
        .replace(new RegExp(`<\\/(${TAGS_REGEX})>`, 'g'), '</InteractiveElement>');
    } catch (e) { return ""; }
  };

  const srcDoc = `<!DOCTYPE html><html><head><meta charset="utf-8" /><script src="https://unpkg.com/react@18/umd/react.development.js"></script><script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script><script src="https://unpkg.com/@babel/standalone/babel.min.js"></script><style>body { margin: 0; overflow: hidden; background: #fff; user-select: none; } .mode-edit .darwin-draggable { cursor: move; } .mode-edit .darwin-draggable:hover { outline: 2px solid #00f3ff; } .mode-live .darwin-draggable { cursor: grab; } .mode-live .darwin-draggable:hover { outline: 2px dashed #bc13fe; cursor: alias; }</style></head><body class="mode-${mode}"><div id="root"></div><script type="text/babel">
  const { useState, useEffect, useRef } = React; 
  
  // --- RESTORED HELPER COMPONENT ---
  const DarwinTracker = () => null;

  // --- MOCKS FOR MISSING IMPORTS ---
  const Github = (p) => <span {...p}>GH</span>;
  const LogOut = (p) => <span {...p}>LogOut</span>;
  const Command = (p) => <span {...p}>Cmd</span>;
  const Heart = (p) => <span {...p}>Heart</span>;
  const Sparkles = (p) => <span {...p}>Sparkles</span>;
  const Dashboard = () => <div>[Dashboard Component]</div>;
  const RepoSelector = () => <div>[RepoSelector Component]</div>;
  const subscribeToAuth = () => {};
  const signInWithGithub = async () => {};
  const signOut = async () => {};

  const InteractiveElement = ({ _tag: Tag, _darwinIndex, children, style, ...props }) => { 
    const isAbsolute = style && style.position === 'absolute'; 
    const hasId = props['data-darwin-id'] || props.id; 
    const canInteract = isAbsolute || ('${mode}' === 'live' && hasId); 
    const [highlightColor, setHighlightColor] = useState(null);
    useEffect(() => {
      const handleMsg = (e) => {
        if (e.data.type === 'SYNC_SELECTION') {
           if (e.data.id == _darwinIndex) {
              setHighlightColor(e.data.color || '#00f3ff');
           } else {
              setHighlightColor(null);
           }
        }
      };
      window.addEventListener('message', handleMsg);
      return () => window.removeEventListener('message', handleMsg);
    }, [_darwinIndex]);
    if (!canInteract) return <Tag style={style} {...props}>{children}</Tag>; 
    const [pos, setPos] = useState({ x: parseInt(style?.left || 0), y: parseInt(style?.top || 0) }); 
    const [isDragging, setIsDragging] = useState(false); 
    const dragOffset = useRef({ x: 0, y: 0 }); 
    const handleMouseDown = (e) => { e.stopPropagation(); e.preventDefault(); if ('${mode}' === 'live') { const rect = e.target.getBoundingClientRect(); const computed = window.getComputedStyle(e.target); const meta = { width: Math.round(rect.width), height: Math.round(rect.height), x: Math.round(rect.x), y: Math.round(rect.y), bgColor: computed.backgroundColor, color: computed.color, type: Tag }; window.parent.postMessage({ type: 'EXTRACT_COMPONENT', tag: props['data-darwin-id'] || props.id || Tag, id: _darwinIndex, clientX: e.clientX, clientY: e.clientY, meta: meta }, '*'); return; } setIsDragging(true); dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }; }; 
    useEffect(() => { if (!isDragging || '${mode}' === 'live') return; const handleMove = (e) => { let newX = e.clientX - dragOffset.current.x; let newY = e.clientY - dragOffset.current.y; if (newX < 0) newX = 0; if (newY < 0) newY = 0; setPos({ x: newX, y: newY }); }; const handleUp = () => { setIsDragging(false); window.parent.postMessage({ type: 'UPDATE_POS', index: _darwinIndex, x: pos.x, y: pos.y }, '*'); }; window.addEventListener('mousemove', handleMove); window.addEventListener('mouseup', handleUp); return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); }; }, [isDragging, pos]); 
    const activeStyle = highlightColor ? { outline: '2px solid ' + highlightColor, boxShadow: '0 0 15px ' + highlightColor + ', inset 0 0 10px ' + highlightColor, zIndex: 9999, position: isAbsolute ? 'absolute' : 'relative', transition: 'all 0.2s ease' } : {};
    return <Tag style={{ ...style, ...activeStyle, left: pos.x, top: pos.y }} className="darwin-draggable" onMouseDown={handleMouseDown} {...props}>{children}</Tag>; 
  }; 
  try { ${prepareTransformedCode()} const root = ReactDOM.createRoot(document.getElementById('root')); root.render(<App />); } catch (err) { document.body.innerHTML = '<div style="color:red; padding:20px">Preview Error: ' + err.message + '</div>'; } </script></body></html>`;
  return <iframe ref={iframeRef} srcDoc={srcDoc} onLoad={sendSelection} title="Live Preview" className="w-full h-full border-none bg-white" sandbox="allow-scripts allow-same-origin" />;
};

// --- 2. EDITOR UTILS (Unchanged) ---
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
                       value={fileContents[activeTab]}
                       onChange={(e) => onCodeChange(activeTab, e.target.value)}
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

// --- 3. MAIN DASHBOARD ---
export default function Dashboard({ user, token, repo, onBack }) {
  const [viewMode, setViewMode] = useState('simulation'); 
  const [totalUsers, setTotalUsers] = useState(0);
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

  // AI State
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [proposedCode, setProposedCode] = useState(null);

  // --- EDITOR STATE ---
  const [fileTree, setFileTree] = useState([]);
  const [openTabs, setOpenTabs] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [fileContents, setFileContents] = useState({});
  const [loadingFile, setLoadingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const colorToHex = (c) => { if (!c) return '#000000'; if (typeof c !== 'string') return '#000000'; if (c.startsWith('#')) return c; const m = c.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/); if (m) return '#'+[1,2,3].map(i => parseInt(m[i]).toString(16).padStart(2,'0')).join(''); return '#000000'; };
  const handleStyleChange = (id, prop, value) => { setBubbles(prev => prev.map(b => b.id === id ? { ...b, meta: { ...(b.meta || {}), [prop]: value } } : b)); try { window.postMessage({ type: 'UPDATE_STYLE', index: id, attr: prop, value}, '*'); } catch (e) {} };

  const handleDeleteBubble = (id) => { if (activeId === id) setActiveId(null); setBubbles(prev => prev.filter(b => b.id !== id)); };
  const toggleVisibility = (id) => { setBubbles(prev => prev.map(b => b.id === id ? { ...b, visible: !b.visible } : b)); };
  const toggleExpand = (id) => { const next = new Set(expandedProperties); if(next.has(id)) next.delete(id); else next.add(id); setExpandedProperties(next); };

  const getActiveColor = () => {
    const bubble = bubbles.find(b => b.id === activeId);
    return bubble ? bubble.color : null;
  };

  useEffect(() => {
    if (demoMode || !repo) return;
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
            prevBubbles.map(bubble => {
              const newCount = data[bubble.label];
              return (newCount !== undefined && newCount !== bubble.count) ? { ...bubble, count: newCount } : bubble;
            })
         );
      }
    }, demoMode);
    return () => unsubscribe && unsubscribe();
  }, [demoMode, repo]);

  // --- GIT SYNC & FILE LOADING ---
  useEffect(() => { 
    // async function run_pipeline(contents) { 
    //   const resp = await fetch(APP_HOST + PORT + "/api/run_pipeline", { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html: contents }) }); 
    //   if (!resp.ok) return; 
    //   await resp.json(); 
    // } 
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
          // run_pipeline(contents); 
        } 
      } catch (err) { console.error(err); } 
    } 
    initSync(); 
  }, [token, repo]);

  const handleCommitChanges = async () => {
    if (!activeTab || !fileContents[activeTab] || !token || !repo) return;
    setIsSaving(true);
    const octokit = new Octokit({ auth: token });
    try {
      const { data: currentFile } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
        owner: repo.owner.login,
        repo: repo.name,
        path: activeTab,
      });

      await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
        owner: repo.owner.login,
        repo: repo.name,
        path: activeTab,
        message: `Darwin Update: ${activeTab}`,
        content: btoa(fileContents[activeTab]),
        sha: currentFile.sha,
      });

      setAiLog(prev => [...prev, { role: 'success', text: `Committed changes to ${activeTab}` }]);
    } catch (err) {
      console.error(err);
      setAiLog(prev => [...prev, { role: 'error', text: `Failed to commit: ${err.message}` }]);
    } finally {
      setIsSaving(false);
    }
  };

  // --- AI GENERATION ---
  // Find the handleAiGenerate function in Dashboard.jsx and replace it with this:
const handleAiGenerate = async () => {
  if (!aiPrompt.trim()) return;
  setIsAiGenerating(true);
  
  // Safety check: Ensure the URL is formed correctly
  const apiUrl = `${APP_HOST}${PORT}/api/generate_code`;
  
  try {
      const currentCode = fileContents['src/App.jsx'] || '';
      
      setAiLog(prev => [...prev, { role: 'system', text: `Requesting AI changes from ${apiUrl}...` }]);

      console.log(aiPrompt)
      const resp = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              prompt: aiPrompt,
              code: currentCode
          })
      });

      if (!resp.ok) {
          const errorData = await resp.json().catch(() => ({}));
          throw new Error(errorData.error || `Server responded with ${resp.status}`);
      }

      const data = await resp.json();
      if (data.code) {
          setProposedCode(data.code);
          setAiLog(prev => [...prev, { role: 'success', text: 'AI generated a new version of App.jsx. Review above!' }]);
      } else {
          throw new Error("AI returned empty code.");
      }

  } catch (err) {
      console.error("AI Assistant Error:", err);
      
      // Detailed error logging for the UI
      let errorMessage = "AI Generation Failed.";
      if (err.message.includes("Failed to fetch")) {
          errorMessage = `Connection Error: Is the backend running at ${apiUrl}?`;
      } else {
          errorMessage = `AI Error: ${err.message}`;
      }

      setAiLog(prev => [...prev, { role: 'error', text: errorMessage }]);
      setActivePanel('logs'); // Auto-switch to logs so you see the error
  } finally {
      setIsAiGenerating(false);
  }
};

  const handleAcceptAi = () => {
      if (proposedCode) {
          setFileContents(prev => ({ ...prev, ['src/App.jsx']: proposedCode }));
          setProposedCode(null);
          setAiPrompt("");
          setAiLog(prev => [...prev, { role: 'success', text: 'AI Changes Applied' }]);
      }
  };

  const handleFileSelect = async (file) => { 
    if (file.type === 'dir') return; 
    setOpenTabs(prev => { if (prev.includes(file.path)) return prev; return [...prev, file.path]; }); 
    setActiveTab(file.path); 
    if (fileContents[file.path]) return fileContents[file.path]; 
    setLoadingFile(true); 
    const octokit = new Octokit({ auth: token }); 
    try { 
      const { data } = await octokit.request('GET /repos/{owner}/{repo}/git/blobs/{file_sha}', { owner: repo.owner.login, repo: repo.name, file_sha: file.sha }); 
      const content = atob(data.content); 
      setFileContents(prev => ({ ...prev, [file.path]: content })); 
      return content; 
    } catch (e) {console.error(e);} 
    finally { setLoadingFile(false); } 
  };

  const handleTabClose = (path) => { const newTabs = openTabs.filter(t => t !== path); setOpenTabs(newTabs); if (activeTab === path) setActiveTab(newTabs.length > 0 ? newTabs[newTabs.length - 1] : null); };
  const handleCodeChange = (path, newCode) => { setFileContents(prev => ({ ...prev, [path]: newCode })); };
  const handleCodeUpdateFromPreview = (newCode) => { if (activeTab === 'src/App.jsx') setFileContents(prev => ({ ...prev, [activeTab]: newCode })); };
  const handleExtractStart = (tag, id, clientX, clientY, meta) => { const iframeRect = document.querySelector('iframe')?.getBoundingClientRect(); if (iframeRect) { setExtractedGhost({ tag: tag || 'Component', id: id, x: iframeRect.left + clientX, y: iframeRect.top + clientY, meta: meta }); } };
  const handleUpdateLayout = (id, newX, newY, predict_other={}) => { 
    const fetchBackendCount = async () => { 
      try { 
        console.log(id)
        if (typeof id == "number") {
          if (id == 1) id = "nav-main"
          else if (id == 3) id = "hero-text"
          else if (id == 4) id = "btn-cta"
          else if (id == 5) id = "description"
          else id = 'btn-cta-2'
        }
    const resp = await fetch(APP_HOST + BACKEND_PORT + '/api/get_hit_count', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x: newX, y: newY, div_id: id, predict_other: predict_other}) }); if (!resp.ok) return; const json = await resp.json(); if (typeof json?.count === 'number') setBubbles(prev => prev.map(b => b.label === id ? { ...b, count : json?.count} : b)) } catch (e) { console.error(e); } }; if (demoMode) fetchBackendCount(); };

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
             setBubbles(prev => [...prev, { id: extractedGhost.id, label: extractedGhost.tag, count: clicksData[extractedGhost.tag] || 0, visible: true, color: nextColor, position: [normalizedX, 0, normalizedZ], meta: extractedGhost.meta || {} }]);
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
        // Calculate new width relative to the window edge
        const newWidth = window.innerWidth - e.clientX;
        // Optional: Add min/max constraints to prevent breaking the layout
        const clampedWidth = Math.max(300, Math.min(newWidth, window.innerWidth - 100));
        setRightPanelWidth(clampedWidth);
      }
    };
    
    const handleUp = () => {
      setIsResizing(false);
      // Re-enable pointer events on iframes when done
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      // Vital: Disable selection so text doesn't highlight while dragging
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    }

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isResizing]);

  const handleClearEnvironment = () => { setTotalUsers(0); setBubbles([]); };

  return (
    <div className={`h-screen w-screen bg-white dark:bg-black text-gray-900 dark:text-white flex overflow-hidden font-sans transition-colors duration-300 ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
      <div className="w-16 border-r border-gray-200 dark:border-white/5 flex flex-col items-center py-6 gap-6 z-30 bg-gray-50 dark:bg-[#0a0a0a] shrink-0 transition-colors duration-300">
        <div className="w-10 h-10 bg-gradient-to-tr from-neon-blue to-neon-purple rounded-lg flex items-center justify-center font-bold text-xl text-white">D</div>
        <div className="flex flex-col gap-4">
            <button onClick={() => setViewMode('simulation')} className={`p-3 rounded-xl transition-all ${viewMode === 'simulation' ? 'text-neon-blue bg-blue-50 dark:bg-transparent' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}><Layers size={20} /></button>
            <button onClick={() => setViewMode('analytics')} className={`p-3 rounded-xl transition-all ${viewMode === 'analytics' ? 'text-yellow-500 bg-yellow-50 dark:text-yellow-400 dark:bg-transparent' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}><BarChart2 size={20} /></button>
            <button onClick={() => setViewMode('code')} className={`p-3 rounded-xl transition-all ${viewMode === 'code' ? 'text-purple-600 bg-purple-50 dark:text-neon-purple dark:bg-transparent' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}><Code size={20} /></button>
            {/* NEW AI ICON */}
            <button onClick={() => setActivePanel('ai')} className={`p-3 rounded-xl transition-all ${activePanel === 'ai' ? 'text-pink-600 bg-pink-50 dark:text-pink-400 dark:bg-pink-500/10' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}><Sparkles size={20} /></button>
            <button onClick={() => setActivePanel('properties')} className={`p-3 rounded-xl transition-all ${activePanel === 'properties' ? 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-500/10' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}><Shapes size={20} /></button>
        </div>
        <div className="mt-auto flex flex-col gap-4 items-center">
          <button onClick={() => setDarkMode(!darkMode)} className="p-3 rounded-xl text-gray-500 hover:text-black dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition-all" title="Toggle Theme">{darkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
          <button onClick={onBack} className="p-3 text-gray-500 hover:text-red-500 transition-colors"><ArrowLeft size={20} /></button>
        </div>
      </div>
      <div className="flex-1 relative bg-gray-200 dark:bg-[#0a0a0a] overflow-hidden flex flex-col transition-colors duration-300">
        {viewMode === 'simulation' ? (
          <div className="relative w-full h-full group">
             <Scene bubbles={bubbles} userCount={demoMode ? 50 : totalUsers} activeId={activeId} setActiveId={setActiveId} darkMode={darkMode} />
             {extractedGhost && (<div className="absolute inset-0 bg-blue-500/10 border-4 border-blue-500/50 flex items-center justify-center pointer-events-none z-10"><div className="bg-black/80 px-4 py-2 rounded text-blue-400 font-mono font-bold">DROP TO TRACK</div></div>)}
             <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
                <div className="bg-white/80 dark:bg-black/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 pl-6 pr-2 py-2 rounded-full flex items-center gap-6 shadow-2xl transition-colors">
                   <div className="flex items-center gap-3 pr-4 border-r border-gray-300 dark:border-white/10">
                      <Users size={16} className="text-gray-500" />
                      <div className="flex items-baseline gap-2"><span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Active Swarm</span><span className="text-lg font-mono text-neon-blue leading-none">{demoMode ? '92' : totalUsers}</span></div>
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
      
      {/* RIGHT PANEL */}
      <div style={{ width: rightPanelWidth }} className="flex flex-col bg-white dark:bg-[#111] shrink-0 border-l border-gray-200 dark:border-white/5 relative transition-colors duration-300">
         {extractedGhost && (<div className="fixed z-50 pointer-events-none flex items-center gap-2 bg-[#bc13fe] text-white px-3 py-2 rounded-lg shadow-xl font-bold text-xs" style={{ left: extractedGhost.x, top: extractedGhost.y, transform: 'translate(-50%, -50%)' }}><MousePointer2 size={14} className="fill-white" /><span>{extractedGhost.tag}</span><div className="bg-white text-[#bc13fe] px-1.5 rounded text-[10px]">+ ADD</div></div>)}
         <div className="h-1/2">
           <div className="flex flex-col h-full bg-white dark:bg-[#1e1e1e]">
              <div className="h-10 flex items-center justify-between px-4 bg-gray-100 dark:bg-[#252526] border-b border-gray-200 dark:border-black/20"><span className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400 flex items-center gap-2"><Globe size={12}/> Live Preview</span><div className={`text-[10px] px-2 rounded flex items-center gap-1 ${demoMode ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400'}`}>{demoMode ? 'EDIT MODE' : 'EXTRACT MODE'}</div></div>
              <div className="flex-1 bg-white relative">

                 {/* --- THE FIX: Invisible Shield --- */}
                 {/* This covers the iframe ONLY when resizing, keeping mouse events in the parent */}
                 {isResizing && (
                    <div className="absolute inset-0 z-50 bg-transparent" />
                 )}

                 <IframeRenderer 
                    code={proposedCode || fileContents['src/App.jsx'] || ''}  // PREVIEW PROPOSED CODE IF AVAILABLE
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
         <div className="h-1/2 border-t border-gray-200 dark:border-white/10 flex flex-col bg-gray-50 dark:bg-black/40">
            <div className="flex border-b border-gray-200 dark:border-white/10">
               <button onClick={() => setActivePanel('logs')} className={`px-4 py-2 text-[10px] font-bold uppercase flex items-center gap-2 ${activePanel === 'logs' ? 'bg-yellow-50 text-yellow-600 border-b-2 border-yellow-500 dark:bg-white/10 dark:text-yellow-500' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}><Zap size={12} /> System Logs</button>
               <button onClick={() => setActivePanel('properties')} className={`px-4 py-2 text-[10px] font-bold uppercase flex items-center gap-2 ${activePanel === 'properties' ? 'bg-green-50 text-green-600 border-b-2 border-green-500 dark:bg-white/10 dark:text-green-400' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}><Shapes size={12} /> Properties</button>
               {/* NEW AI TAB BUTTON */}
               <button onClick={() => setActivePanel('ai')} className={`px-4 py-2 text-[10px] font-bold uppercase flex items-center gap-2 ${activePanel === 'ai' ? 'bg-pink-50 text-pink-600 border-b-2 border-pink-500 dark:bg-white/10 dark:text-pink-400' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}><Sparkles size={12} /> AI ASSISTANT</button>
            </div>
            <div className="flex-1 overflow-y-auto font-mono text-[10px] p-0">
               {/* AI ASSISTANT PANEL */}
               {activePanel === 'ai' && (
                   <div className="p-4 flex flex-col h-full">
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
               {/* LOGS PANEL */}
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
               {/* PROPERTIES PANEL */}
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
                                         onChange={(e) => { const v = e.target.value ? `${e.target.value}px` : ''; handleStyleChange(b.id, 'width', v); }}
                                         className="w-20 p-1 rounded border border-gray-300 dark:border-white/10 text-black dark:text-white bg-white dark:bg-transparent text-[10px]"
                                       />
                                       <span className="text-gray-500">x</span>
                                       <input
                                         type="number"
                                         value={b.meta?.height ? parseInt(b.meta.height) : ''}
                                         onChange={(e) => { const v = e.target.value ? `${e.target.value}px` : ''; handleStyleChange(b.id, 'height', v); }}
                                         className="w-20 p-1 rounded border border-gray-300 dark:border-white/10 text-black dark:text-white bg-white dark:bg-transparent text-[10px]"
                                       />
                                     </div>
                                   </div>
                                   <div className="flex items-center justify-between"><div className="flex items-center gap-1"><MapPin size={10}/> Position</div> <span>{b.meta?.x}, {b.meta?.y}</span></div>
                                   <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1"><Palette size={10}/> Color</div>
                                      <div className="flex items-center gap-2">
                                        <input type="color" value={colorToHex(b.meta?.bgColor)} onChange={(e) => handleStyleChange(b.id, 'bgColor', e.target.value)} className="w-8 h-8 p-0 border border-gray-300 dark:border-white/10 rounded" />
                                        <div className="w-3 h-3 rounded-full border border-gray-300 dark:border-white/20" style={{backgroundColor: b.meta?.bgColor}}></div>
                                        <span className="font-mono ml-2">{b.meta?.color}</span>
                                      </div>
                                   </div>
                                     <div className="flex items-center justify-between mt-1">
                                        <div className="flex items-center gap-1"><span className="text-[10px]">Font-size</span></div>
                                        <div className="flex items-center gap-2">
                                          <input type="number" value={b.meta?.fontSize ? parseInt(b.meta.fontSize) : ''} onChange={(e) => handleStyleChange(b.id, 'fontSize', `${e.target.value}px`)} className="w-20 p-1 rounded border border-gray-300 dark:border-white/10 text-black dark:text-white bg-white dark:bg-transparent text-[10px]" />
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