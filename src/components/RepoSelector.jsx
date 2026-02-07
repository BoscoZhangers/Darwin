import React, { useState, useEffect } from 'react';
import { Octokit } from "@octokit/rest";
import { GitBranch, Box, Search, LogOut, Lock } from 'lucide-react';

export default function RepoSelector({ token, user, onSelectRepo, onLogout }) {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function fetchRepos() {
      const octokit = new Octokit({ auth: token });
      const res = await octokit.request('GET /user/repos', {
        sort: 'updated',
        per_page: 100,
        visibility: 'all' 
      });
      setRepos(res.data);
      setLoading(false);
    }
    if (token) fetchRepos();
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
           <div className="text-right">
              <div className="font-bold text-sm">{user.displayName}</div>
              <div className="text-xs text-gray-500">Connected via GitHub</div>
           </div>
           <img src={user.photoURL} className="w-10 h-10 rounded-full border border-gray-700" alt="Avatar" />
           <button onClick={onLogout} className="p-2 hover:bg-red-500/20 rounded text-red-500 transition-colors"><LogOut size={18} /></button>
        </div>
      </div>

      {/* Search */}
      <div className="w-full max-w-4xl mb-6 relative">
         <Search className="absolute left-4 top-3.5 text-gray-500" size={20} />
         <input 
            type="text" 
            placeholder="Search repositories..." 
            className="w-full bg-[#161b22] border border-gray-700 rounded-lg py-3 pl-12 text-white focus:outline-none focus:border-blue-500 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
         />
      </div>

      {/* Repo Grid */}
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
         {loading ? (
             <div className="col-span-3 text-center text-gray-500 py-20">Loading repositories...</div>
         ) : filteredRepos.map(repo => (
            <button 
              key={repo.id}
              onClick={() => onSelectRepo(repo)}
              className="bg-[#161b22] border border-gray-800 p-4 rounded-lg hover:border-blue-500 hover:shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all text-left group flex flex-col h-32"
            >
               <div className="flex items-center gap-2 mb-2">
                  {repo.private ? <Lock size={14} className="text-yellow-500" /> : <Box size={14} className="text-gray-400" />}
                  <span className="font-bold truncate w-full group-hover:text-blue-400 transition-colors">{repo.name}</span>
               </div>
               <p className="text-xs text-gray-500 line-clamp-2 mb-auto">{repo.description || "No description provided."}</p>
               
               <div className="flex items-center gap-4 text-[10px] text-gray-400 mt-2">
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> {repo.language || 'Code'}</div>
                  <div className="flex items-center gap-1"><GitBranch size={10} /> {repo.default_branch}</div>
                  <div>{new Date(repo.updated_at).toLocaleDateString()}</div>
               </div>
            </button>
         ))}
      </div>
    </div>
  );
}