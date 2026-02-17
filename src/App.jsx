import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import { Github, Command, Sparkles, Dna } from 'lucide-react'; 
import { Canvas, useFrame, extend, useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { subscribeToAuth, signInWithGithub, signOut } from './lib/firebase';
import Dashboard from './components/Dashboard';
import RepoSelector from './components/RepoSelector';
import { Analytics } from "@vercel/analytics/react";

// Extend Three.js elements so R3F can use them as JSX tags
extend({ CatmullRomCurve3: THREE.CatmullRomCurve3 });

// --- 3D Components ---

// 1. INFINITE ZOOM OUT RIG
const CameraRig = () => {
  const { camera } = useThree();
  const START_Z = 12; 
  const DISTANCE = 30; 
  const SPEED = 2.5; 

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const movement = (t * SPEED) % DISTANCE;
    camera.position.z = START_Z + movement;
  });

  return null;
};

const HelperRung = ({ start, end }) => {
    const curve = useMemo(() => new THREE.LineCurve3(start, end), [start, end]);
    const geomRef = useRef();

    useLayoutEffect(() => {
      if (geomRef.current) {
        const geom = geomRef.current;
        const count = geom.attributes.position.count;
        const colors = new Float32Array(count * 3);
        
        // RESTORED: Bright Cyan/Purple Colors
        const colorStart = new THREE.Color("#22D3EE"); 
        const colorEnd = new THREE.Color("#A855F7");   
        const tempColor = new THREE.Color();

        const uvs = geom.attributes.uv;

        for (let i = 0; i < count; i++) {
          const t = uvs.getX(i);
          tempColor.copy(colorStart).lerp(colorEnd, t);
          colors[i * 3] = tempColor.r;
          colors[i * 3 + 1] = tempColor.g;
          colors[i * 3 + 2] = tempColor.b;
        }

        geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      }
    }, [curve]);

    return (
      <mesh>
        <tubeGeometry ref={geomRef} args={[curve, 8, 0.08, 4, false]} /> 
        <meshPhysicalMaterial 
             transparent
             opacity={0.6} // RESTORED: Visibility
             roughness={0.2}
             metalness={0.8}
             vertexColors={true}
             emissiveIntensity={0.3} // RESTORED: Glow
        />
      </mesh>
    );
}

function SolidDNAHelix() {
  const spinRef = useRef(); 
  const STRAND_RADIUS = 0.6;
  const HELIX_RADIUS = 4;
  const HEIGHT = 60; 
  const TURNS = 6; 
  const POINTS_PER_TURN = 30;

  const { curveA, curveB, rungs } = useMemo(() => {
    const pA = [];
    const pB = [];
    const rungData = [];
    const totalPoints = TURNS * POINTS_PER_TURN;

    for (let i = 0; i <= totalPoints; i++) {
      const t = i / totalPoints;
      const angle = t * Math.PI * 2 * TURNS;
      const y = (t - 0.5) * HEIGHT;

      const vecA = new THREE.Vector3(Math.cos(angle) * HELIX_RADIUS, y, Math.sin(angle) * HELIX_RADIUS);
      const vecB = new THREE.Vector3(Math.cos(angle + Math.PI) * HELIX_RADIUS, y, Math.sin(angle + Math.PI) * HELIX_RADIUS);

      pA.push(vecA);
      pB.push(vecB);

      if (i % 3 === 0 && i > 0 && i < totalPoints) {
         rungData.push({ start: vecA, end: vecB });
      }
    }

    return {
      curveA: new THREE.CatmullRomCurve3(pA),
      curveB: new THREE.CatmullRomCurve3(pB),
      rungs: rungData,
    };
  }, []);

  useFrame((state, delta) => {
    if (spinRef.current) {
      spinRef.current.rotation.y += delta * 0.4; 
    }
  });

  // RESTORED: Bright Material Props (to be seen through overlay)
  const materialProps = {
      transparent: true,
      opacity: 0.8,        
      roughness: 0.1,     
      metalness: 0.9,      
      clearcoat: 1,        
      clearcoatRoughness: 0.1,
      transmission: 0.1,   
  };

  return (
    <group ref={spinRef}>
      {/* Strand 1 Tube - RESTORED Cyan Glow */}
      <mesh>
        <tubeGeometry args={[curveA, 300, STRAND_RADIUS, 12, false]} />
        <meshPhysicalMaterial 
          {...materialProps} 
          color="#22D3EE" 
          emissive="#0ea5e9" 
          emissiveIntensity={0.6} 
        />
      </mesh>

      {/* Strand 2 Tube - RESTORED Purple Glow */}
      <mesh>
        <tubeGeometry args={[curveB, 300, STRAND_RADIUS, 12, false]} />
        <meshPhysicalMaterial 
          {...materialProps} 
          color="#A855F7" 
          emissive="#d946ef" 
          emissiveIntensity={0.6} 
        />
      </mesh>

      {rungs.map((rung, i) => (
          <HelperRung key={i} start={rung.start} end={rung.end} />
      ))}
    </group>
  );
}

function SceneBackground() {
  return (
    <div className="absolute inset-0 z-0 transition-opacity duration-1000 ease-in-out">
      <Canvas camera={{ position: [0, 0, 12], fov: 35 }} gl={{ antialias: true }}>
        <color attach="background" args={['#050505']} /> 
        
        <ambientLight intensity={0.2} />
        <spotLight position={[10, 10, 10]} angle={0.3} penumbra={1} intensity={1} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#A855F7" />
        
        <Environment preset="city" />
        
        {/* Stars REMOVED to avoid white dots/distraction */}
        
        {/* Slant Group */}
        <group rotation={[0, 0, -Math.PI / 8]}> 
            <SolidDNAHelix />
        </group>
        
        <CameraRig />
        
        <fog attach="fog" args={['#050505', 20, 60]} />
      </Canvas>
      
      {/* --- THE DARK OVERLAY --- */}
      {/* This sits on top of the Canvas but behind the main content (z-0 inside z-0 container) */}
      <div className="absolute inset-0 bg-black/70 pointer-events-none"></div>
    </div>
  );
}

// --- Main App Component ---

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
    { name: "React", logo: <img src="https://cdn.simpleicons.org/react/61DAFB" className="w-4 h-4" alt="react"/> },
    { name: "Tailwind", logo: <img src="https://cdn.simpleicons.org/tailwindcss/06B6D4" className="w-4 h-4" alt="tailwind"/> },
    { name: "JavaScript", logo: <img src="https://cdn.simpleicons.org/javascript/F7DF1E" className="w-4 h-4" alt="js"/> },
    { name: "CSS", logo: <CSSLogo /> },
    { name: "Python", logo: <img src="https://cdn.simpleicons.org/python/3776AB" className="w-4 h-4" alt="python"/> },
    { name: "Three.js", logo: <img src="https://cdn.simpleicons.org/three.js/ffffff" className="w-4 h-4" alt="three"/> },
    { name: "PyTorch", logo: <img src="https://cdn.simpleicons.org/pytorch/EE4C2C" className="w-4 h-4" alt="pytorch"/> },
    { name: "FastAPI", logo: <img src="https://cdn.simpleicons.org/fastapi/05998B" className="w-4 h-4" alt="fastapi"/> },
    { name: "Firebase", logo: <img src="https://cdn.simpleicons.org/firebase/FFCA28" className="w-4 h-4" alt="firebase"/> },
  ];

  if (!user) {
    return (
      <div className="h-screen w-screen text-white flex flex-col items-center justify-center relative overflow-hidden font-sans selection:bg-purple-500/30">
        
        {/* --- 3D Background Layer --- */}
        <SceneBackground />
        <div className="absolute inset-0 bg-black/20 z-5 pointer-events-none"></div>

        {/* --- Styles for UI --- */}
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
            }
          `}
        </style>

        {/* --- Foreground UI --- */}
        <div className="z-10 flex flex-col items-center gap-8 pointer-events-none select-none">
          <div className="relative group cursor-default pointer-events-auto">
            {/* Pulsing Outer Glow */}
            <div className="absolute -inset-2 bg-gradient-to-r from-cyan-400 to-purple-600 rounded-2xl animate-pulse-glow shadow-[0_0_35px_rgba(34,211,238,0.5)]"></div>
            
            {/* Static Sharp Inner Glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 to-purple-600 rounded-2xl blur-md opacity-80"></div>

            {/* Logo Container */}
            <div className="relative w-24 h-24 bg-[#111] rounded-2xl flex items-center justify-center border border-white/20 shadow-2xl">
              {/* Double Helix Icon from Lucide with Gradient Applied */}
              <Dna className="w-12 h-12 text-transparent" stroke="url(#blue-purple-gradient)" strokeWidth={2.5} />
              
              {/* SVG Definition for the gradient stroke */}
              <svg width="0" height="0">
                <linearGradient id="blue-purple-gradient" x1="100%" y1="100%" x2="0%" y2="0%">
                  <stop stopColor="#A855F7" offset="0%" />
                  <stop stopColor="#22D3EE" offset="100%" />
                </linearGradient>
              </svg>
            </div>
          </div>

          <div className="text-center space-y-2 pointer-events-auto">
            <h1 className="text-6xl font-extrabold tracking-[0.06em] text-white mr-[-0.2em] drop-shadow-2xl">Darwin</h1>
            <div className="flex items-center justify-center gap-2 text-gray-300 text-sm uppercase tracking-widest font-medium drop-shadow-md">
                <Command size={14} /> 
                <span>Evolve your Websites with AI</span>
            </div>
          </div>

          <button onClick={handleLogin} className="pointer-events-auto group relative mt-4 px-8 py-3.5 bg-white text-black font-bold text-sm rounded-full flex items-center gap-3 transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] active:scale-95">
            <Github size={18} />
            <span>Connect GitHub</span>
            <div className="absolute inset-0 rounded-full border border-black/10" />
          </button>
        </div>

        <div className="absolute bottom-0 w-full py-8 overflow-hidden z-10 pointer-events-none">
          <div className="flex items-center justify-center gap-2 text-[10px] text-gray-400 uppercase tracking-[0.3em] mb-4 opacity-70 drop-shadow">
            <Sparkles size={10} />
            <span className="flex items-center gap-1.5">
              Powered By
            </span>
          </div>
          
          <div className="conveyor-spotlight relative flex overflow-hidden">
            <div className="animate-marquee whitespace-nowrap flex items-center">
              {[...techStack, ...techStack].map((tech, i) => (
                <div key={i} className="flex items-center gap-3 mx-10 group cursor-default">
                  <div className="w-4 h-4 flex items-center justify-center object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                    {tech.logo}
                  </div>
                  <span className="text-xs font-bold text-white transition-colors drop-shadow-md">
                    {tech.name}
                  </span>
                  <div className="ml-10 w-1 h-1 bg-white/30 rounded-full box-shadow-[0_0_10px_ffffff]" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <Analytics />
      </div>
    );
  }

  if (!selectedRepo) {
    return (
      <>
        <RepoSelector user={user} token={token} onSelect={setSelectedRepo} onLogout={handleLogout} />
        <Analytics />
      </>
    );
  }
  
  return (
    <>
      <Dashboard user={user} token={token} repo={selectedRepo} onBack={() => setSelectedRepo(null)} />
      <Analytics />
    </>
  );
}