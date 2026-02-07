import React, { useState, useEffect } from 'react';
import { Octokit } from "@octokit/rest";
import { GitBranch, Box, Search, LogOut, Lock, RefreshCw } from 'lucide-react';

export default function RepoSelector({ token, user, onSelect, onLogout }) {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchRepos = async () => {
    if (!token) return;
    setLoading(true);
    const octokit = new Octokit({ auth: token });
    
    try {
      // OPTIMIZATION: Only fetch repos you own or collaborate on (skips slow Org checks)
      const res = await octokit.request('GET /user/repos', {
        sort: 'updated',
        per_page: 50, 
        affiliation: 'owner,collaborator', 
        visibility: 'all' 
      });
      setRepos(res.data);
    } catch (e) {
      console.error("Failed to load repos", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepos();
  }, [token]);

  const filteredRepos = repos.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex flex-col items-center p-10 font-sans">
      
      {/* Header */}
      <div className="w-full max-w-4xl flex justify-between items-end mb-8 border-b border-gray-800 pb-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">Darwin</h1>
          <p className="text-gray-400 text-sm mt-1">Select a repository to visualize</p>
        </div>
        <div className="flex items-center gap-4">
           <div className="text-right hidden sm:block">
              <div className="font-bold text-sm">{user?.displayName || user?.login || 'Developer'}</div>
              <div className="text-xs text-gray-500">Connected</div>
           </div>
           {user?.photoURL && (
             <img src={user.photoURL} className="w-10 h-10 rounded-full border border-gray-700" alt="Avatar" />
           )}
           <button onClick={onLogout} className="p-2 hover:bg-red-500/20 rounded text-red-500 transition-colors" title="Sign Out">
             <LogOut size={18} />
           </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="w-full max-w-4xl mb-6 flex gap-2">
         <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 text-gray-500" size={20} />
            <input 
                type="text" 
                placeholder="Search repositories..." 
                className="w-full bg-[#161b22] border border-gray-700 rounded-lg py-3 pl-12 text-white focus:outline-none focus:border-blue-500 transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
         </div>
         <button 
           onClick={fetchRepos} 
           disabled={loading}
           className="bg-[#161b22] border border-gray-700 rounded-lg px-4 hover:border-blue-500 hover:text-blue-400 transition-all disabled:opacity-50"
         >
           <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
         </button>
      </div>

      {/* Repo Grid */}
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
         {loading ? (
             // SKELETON LOADER
             [...Array(6)].map((_, i) => (
               <div key={i} className="bg-[#161b22] border border-gray-800 p-4 rounded-lg h-32 animate-pulse flex flex-col gap-3">
                  <div className="h-5 bg-gray-700 rounded w-2/3"></div>
                  <div className="h-3 bg-gray-800 rounded w-full"></div>
                  <div className="h-3 bg-gray-800 rounded w-1/2 mt-auto"></div>
               </div>
             ))
         ) : filteredRepos.length > 0 ? (
           filteredRepos.map(repo => (
            <button 
              key={repo.id}
              onClick={() => onSelect(repo)}
              className="bg-[#161b22] border border-gray-800 p-4 rounded-lg hover:border-blue-500 hover:shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all text-left group flex flex-col h-32 relative overflow-hidden"
            >
               <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRightIcon />
               </div>
               
               <div className="flex items-center gap-2 mb-2">
                  {repo.private ? <Lock size={14} className="text-yellow-500 shrink-0" /> : <Box size={14} className="text-gray-400 shrink-0" />}
                  <span className="font-bold truncate w-full group-hover:text-blue-400 transition-colors">{repo.name}</span>
               </div>
               <p className="text-xs text-gray-500 line-clamp-2 mb-auto leading-relaxed">
                 {repo.description || "No description provided."}
               </p>
               
               <div className="flex items-center gap-4 text-[10px] text-gray-400 mt-3 pt-3 border-t border-gray-800/50">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${repo.language === 'TypeScript' || repo.language === 'JavaScript' ? 'bg-yellow-400' : 'bg-blue-400'}`}></span> 
                    {repo.language || 'Code'}
                  </div>
                  <div className="flex items-center gap-1"><GitBranch size={10} /> {repo.default_branch}</div>
                  <div className="ml-auto opacity-50">{new Date(repo.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
               </div>
            </button>
           ))
         ) : (
           <div className="col-span-3 py-16 text-center text-gray-500 border border-dashed border-gray-800 rounded-xl">
              <Box size={40} className="mx-auto mb-4 opacity-20" />
              <p>No repositories found matching "{search}"</p>
           </div>
         )}
      </div>
    </div>
  );
}

const ArrowRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-blue-500 transform -rotate-45">
    <path d="M3.33337 8H12.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M8 3.33337L12.6667 8.00004L8 12.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);