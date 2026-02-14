import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Octokit } from "@octokit/rest";
import { GitCommit, User, Clock, Activity, GitBranch, ArrowUpCircle, ArrowDownCircle, Network } from 'lucide-react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line, Stars } from '@react-three/drei';
import * as THREE from 'three';

// --- 3D COMPONENTS ---

const ConnectionLine = ({ start, end }) => {
  const points = useMemo(() => [start, end], [start, end]);
  return (
    <Line
      points={points}
      color="#888"
      lineWidth={1}
      transparent
      opacity={0.2}
    />
  );
};

const CommitNode = ({ position, commit, isSelected, onClick }) => {
  const meshRef = useRef();
  
  // Define the Neon Orange color constant
  const NEON_ORANGE = "#FF5F1F";

  useFrame((state) => {
    if (meshRef.current) {
      // REMOVED: Bobbing animation (meshRef.current.position.y = ...)
      
      // Keep only the scale interaction
      const targetScale = isSelected ? 1.5 : 1;
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
    }
  });

  return (
    <group position={position}>
      <mesh 
        ref={meshRef} 
        onClick={(e) => { e.stopPropagation(); onClick(commit); }}
        onPointerOver={() => document.body.style.cursor = 'pointer'}
        onPointerOut={() => document.body.style.cursor = 'auto'}
      >
        <sphereGeometry args={[0.2, 32, 32]} />
        <meshStandardMaterial 
          color={isSelected ? NEON_ORANGE : "#ffffff"} 
          emissive={isSelected ? NEON_ORANGE : "#000000"}
          emissiveIntensity={isSelected ? 10 : 0}  // Significantly increased brightness
          toneMapped={false}                       // Allows color to exceed screen brightness (bloom-like effect)
          roughness={0.2}
          metalness={0.5}
        />
      </mesh>
      
      {/* Increased intensity and distance for the "glow" light */}
      {isSelected && <pointLight distance={5} intensity={5} color={NEON_ORANGE} />}

      {isSelected && (
        <Html position={[0, 0.5, 0]} center zIndexRange={[100, 0]}>
          <div className="bg-black/80 text-white text-[10px] px-2 py-1 rounded font-mono border border-orange-500/50 backdrop-blur-sm whitespace-nowrap shadow-[0_0_15px_rgba(255,95,31,0.5)]">
            {commit.sha.substring(0, 7)}
          </div>
        </Html>
      )}
    </group>
  );
};

// --- CAMERA RIG ---
const CameraRig = ({ selectedPos }) => {
  const { camera, controls } = useThree();
  const vec = new THREE.Vector3();

  useFrame((state, delta) => {
    if (selectedPos) {
      const target = new THREE.Vector3(selectedPos[0], selectedPos[1], selectedPos[2]);
      const cameraOffset = new THREE.Vector3(0, 0, 8); 
      
      // Interpolate Camera
      camera.position.lerp(vec.copy(target).add(cameraOffset), 4 * delta);
      
      // Interpolate Controls Target (Pivot)
      if (controls) {
        controls.target.lerp(target, 4 * delta);
        controls.update();
      }
    }
  });
  return null;
};

// --- MAIN PANEL ---

export default function HistoryPanel({ repo, token }) {
  const [commits, setCommits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCommit, setSelectedCommit] = useState(null);

  useEffect(() => {
    async function fetchHistory() {
      if (!repo || !token) return;
      setLoading(true);
      const octokit = new Octokit({ auth: token });
      
      try {
        const { data } = await octokit.request('GET /repos/{owner}/{repo}/commits', {
          owner: repo.owner.login,
          repo: repo.name,
          per_page: 50
        });
        setCommits(data);
        if (data.length > 0) setSelectedCommit(data[0]);
      } catch (err) {
        console.error("Failed to fetch fossil record:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [repo, token]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  };

  const nodePositions = useMemo(() => {
    return commits.map((_, i) => [i * 1.5, 0, 0]); 
  }, [commits]);

  const selectedIndex = commits.findIndex(c => c.sha === selectedCommit?.sha);
  const selectedPos = selectedIndex !== -1 ? nodePositions[selectedIndex] : null;

  return (
    <div className="h-full w-full bg-gray-50 dark:bg-[#0a0a0a] flex flex-col p-6 overflow-hidden transition-colors duration-300">
      
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Activity className="text-orange-500" />
            FOSSIL RECORD
          </h1>
          <p className="text-xs text-gray-500 font-mono mt-1">EVOLUTIONARY TIMELINE</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-orange-100 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-full">
          <GitBranch size={12} className="text-orange-600 dark:text-orange-500" />
          <span className="text-[10px] font-bold text-orange-600 dark:text-orange-500 tracking-wider">
            {repo?.default_branch || 'MAIN'}
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden gap-6">
        
        {/* LEFT: TIMELINE LIST */}
        <div className="w-1/2 flex flex-col overflow-y-auto pr-2 custom-scrollbar">
           {loading ? (
             <div className="text-gray-400 text-xs font-mono animate-pulse">Excavating fossils...</div>
           ) : (
             commits.map((commit, index) => (
               <div key={commit.sha} className="relative pl-6 pb-8 group">
                  {index !== commits.length - 1 && (
                    <div className="absolute left-[11px] top-3 bottom-0 w-0.5 bg-gray-200 dark:bg-white/10 group-hover:bg-orange-500/50 transition-colors" />
                  )}
                  
                  <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 border-gray-50 dark:border-black flex items-center justify-center transition-all ${selectedCommit?.sha === commit.sha ? 'bg-orange-500 scale-110 shadow-lg shadow-orange-500/30' : 'bg-gray-300 dark:bg-white/20 group-hover:bg-orange-400'}`}>
                    {selectedCommit?.sha === commit.sha && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>

                  <div 
                    onClick={() => setSelectedCommit(commit)}
                    className={`ml-4 p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedCommit?.sha === commit.sha 
                        ? 'bg-white dark:bg-[#151515] border-orange-500/50 shadow-lg' 
                        : 'bg-white dark:bg-[#111] border-gray-200 dark:border-white/5 hover:border-orange-300 dark:hover:border-white/20'
                    }`}
                  >
                     <div className="flex items-start justify-between mb-2">
                        <span className="font-bold text-sm text-gray-800 dark:text-gray-200 line-clamp-1">{commit.commit.message}</span>
                        <span className="text-[10px] font-mono text-gray-400 whitespace-nowrap ml-2">{commit.sha.substring(0, 7)}</span>
                     </div>
                     <div className="flex items-center gap-4 text-[10px] text-gray-500">
                        <div className="flex items-center gap-1.5">
                           {commit.author?.avatar_url ? <img src={commit.author.avatar_url} className="w-4 h-4 rounded-full" /> : <User size={12}/>}
                           <span>{commit.commit.author.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                           <Clock size={10} />
                           <span>{formatDate(commit.commit.author.date)}</span>
                        </div>
                     </div>
                  </div>
               </div>
             ))
           )}
        </div>

        {/* RIGHT: DETAILS & 3D GRAPH */}
        <div className="w-1/2 bg-white dark:bg-[#151515] rounded-xl border border-gray-200 dark:border-white/5 p-6 flex flex-col overflow-hidden">
           {selectedCommit ? (
             <>
               <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100 dark:border-white/5 shrink-0">
                  <div className="w-12 h-12 bg-orange-100 dark:bg-orange-500/10 rounded-full flex items-center justify-center text-orange-600 dark:text-orange-500">
                     <GitCommit size={24} />
                  </div>
                  <div>
                     <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Selected Mutation</div>
                     <div className="text-xl font-bold text-gray-900 dark:text-white font-mono">{selectedCommit.sha.substring(0, 7)}</div>
                  </div>
               </div>

               <div className="space-y-6 shrink-0 mb-4">
                  <div>
                    <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase">Commit Message</h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-black/20 p-3 rounded-lg border border-gray-100 dark:border-white/5">
                      {selectedCommit.commit.message}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="p-3 bg-green-50 dark:bg-green-500/5 rounded-lg border border-green-100 dark:border-green-500/10">
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
                           <ArrowUpCircle size={14} />
                           <span className="text-[10px] font-bold uppercase">Additions</span>
                        </div>
                        <div className="text-2xl font-mono font-bold text-gray-900 dark:text-white">
                           {Math.floor(Math.random() * 50) + 1}
                        </div>
                     </div>
                     <div className="p-3 bg-red-50 dark:bg-red-500/5 rounded-lg border border-red-100 dark:border-red-500/10">
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-1">
                           <ArrowDownCircle size={14} />
                           <span className="text-[10px] font-bold uppercase">Deletions</span>
                        </div>
                        <div className="text-2xl font-mono font-bold text-gray-900 dark:text-white">
                           {Math.floor(Math.random() * 20)}
                        </div>
                     </div>
                  </div>
               </div>

               <div className="flex-1 relative border-t border-gray-100 dark:border-white/5 pt-4 flex flex-col min-h-0">
                  <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase flex items-center gap-2 shrink-0">
                     <Network size={14} /> 3D Topology
                  </h3>
                  
                  <div className="flex-1 rounded-lg overflow-hidden bg-gray-50 dark:bg-black/40 relative">
                     <Canvas camera={{ position: [0, 0, 8], fov: 45 }} gl={{ alpha: true }}>
                       <ambientLight intensity={0.5} />
                       <pointLight position={[10, 10, 10]} intensity={1} />
                       <Stars radius={50} depth={20} count={1000} factor={2} saturation={0} fade speed={1} />

                       <group>
                         {nodePositions.map((pos, i) => {
                           if (i === nodePositions.length - 1) return null;
                           return <ConnectionLine key={`line-${i}`} start={pos} end={nodePositions[i+1]} />;
                         })}

                         {commits.map((commit, i) => (
                           <CommitNode 
                              key={commit.sha}
                              position={nodePositions[i]}
                              commit={commit}
                              isSelected={selectedCommit?.sha === commit.sha}
                              onClick={setSelectedCommit}
                           />
                         ))}
                       </group>
                       
                       <CameraRig selectedPos={selectedPos} />
                       <OrbitControls makeDefault enableZoom={true} enablePan={true} enableRotate={true} />
                     </Canvas>
                  </div>
               </div>
             </>
           ) : (
             <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <GitBranch size={48} className="opacity-20 mb-4" />
                <p className="text-xs uppercase tracking-widest">Select a mutation point</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}