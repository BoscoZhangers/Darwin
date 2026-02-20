import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import { Github, Command, Sparkles, Dna, Play, Monitor, BarChart, MousePointer2, ChevronsDown, Users, Zap, Globe, Eye, Activity, ArrowRight, Clock } from 'lucide-react'; 
import { Canvas, useFrame, extend, useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { subscribeToAuth, signInWithGithub, signOut } from './lib/firebase';
import Dashboard from './components/Dashboard';
import RepoSelector from './components/RepoSelector';
import { Analytics } from "@vercel/analytics/react";
import vid2 from './assets/vid2.mov';
import pic2 from './assets/pic2.png';
import pic3 from './assets/pic3.png'; 
import demoVid from './assets/Demo.mov';

// Extend Three.js elements so R3F can use them as JSX tags
extend({ CatmullRomCurve3: THREE.CatmullRomCurve3 });

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
    // CHANGED: 'absolute' to 'fixed' so it stays put while scrolling
    <div className="fixed inset-0 z-0 transition-opacity duration-1000 ease-in-out">
      <Canvas camera={{ position: [0, 0, 12], fov: 35 }} gl={{ antialias: true }}>
        <color attach="background" args={['#050505']} /> 
        
        <ambientLight intensity={0.2} />
        <spotLight position={[10, 10, 10]} angle={0.3} penumbra={1} intensity={1} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#A855F7" />
        
        <Environment preset="city" />
        
        {/* Slant Group */}
        <group rotation={[0, 0, -Math.PI / 8]}> 
            <SolidDNAHelix />
        </group>
        
        <CameraRig />
        
        <fog attach="fog" args={['#050505', 20, 60]} />
      </Canvas>
      
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/70 pointer-events-none"></div>
    </div>
  );
}

// Features Showcase 
const FeaturesShowcase = () => {
  return (
    <div className="relative z-10 w-full bg-gradient-to-b from-transparent via-black/90 to-black text-white py-24 px-6 md:px-12" id="features">
      <div className="max-w-7xl mx-auto space-y-32">

        {/* Feature 1: Demo Video */}
        <div className="text-center space-y-12">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-gray-300">
              <Sparkles size={14} className="text-yellow-400" />
              <span>See it in action</span>
            </div>
            <h3 className="text-4xl md:text-5xl font-bold">Evolution at 60 FPS</h3>
          </div>
          
          <div className="relative w-full max-w-5xl mx-auto aspect-video bg-black rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(168,85,247,0.15)] overflow-hidden">
            {/* The looping video player */}
            <video src="/Demo.mp4" autoPlay loop muted playsInline />
          </div>
        </div>

        {/* Feature 2: The Motto Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full mt-12 mb-12">
          {[
            {
              icon: <Eye size={32} />,
              word: "VISUALIZE",
              color: "text-cyan-400",
              desc: "Leverage our heatmaps and live analytics dashboard to optimize your frontend."
            },
            {
              icon: <Users size={32} />,
              word: "SIMULATE",
              color: "text-purple-400",
              desc: "Stop guessing. Predict user behavior with swarm intelligence before you ship a single line."
            },
            {
              icon: <Dna size={32} />,
              word: "EVOLVE",
              color: "text-green-400",
              desc: "Leverage your data to make informed changes and evolve your code with our AI tools."
            }
          ].map((item, i) => (
            <div key={i} className="group relative p-8 rounded-3xl bg-white/5 border border-white/10 overflow-hidden hover:bg-white/10 transition-all duration-300">
              <div className={`absolute top-0 right-0 p-8 opacity-20 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500 ${item.color}`}>
                {item.icon}
              </div>
              <div className="mt-16 space-y-4 relative z-10">
                <h4 className={`text-3xl font-black tracking-tighter ${item.color}`}>{item.word}</h4>
                <p className="text-gray-400 leading-relaxed text-sm">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Feature 3: Predictive vs Live Mode */}
        <div className="flex flex-col items-center text-center gap-8 mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-gray-300">
              <Activity size={14} className="text-green-400" />
              <span>Two Ways to Build</span>
            </div>
            <h3 className="text-4xl md:text-5xl font-bold tracking-tight max-w-3xl">Design for the Future. Monitor the Present.</h3>
            <p className="text-gray-400 text-lg leading-relaxed max-w-2xl">
              Switch seamlessly between our AI-driven predictive engine and real-time user tracking.
            </p>
            
            <div className="flex flex-col md:flex-row gap-6 w-full max-w-4xl mt-8">
                {/* Demo Mode Card */}
                <div className="flex-1 bg-gray-900/50 rounded-2xl border border-white/10 p-8 flex flex-col items-center text-center group hover:border-cyan-500/50 transition-colors">
                    <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(6,182,212,0.2)] group-hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-shadow">
                        <BarChart size={32} className="text-cyan-400" />
                    </div>
                    <h4 className="text-2xl font-bold mb-3 text-white">Predictive Mode</h4>
                    <p className="text-gray-400 text-sm">
                        Feed component layouts into our deep learning model 
                        and simulate predicted user engagement 
                        based on synthetic heatmaps.
                    </p>
                </div>
                
                {/* Live Mode Card */}
                <div className="flex-1 bg-gray-900/50 rounded-2xl border border-white/10 p-8 flex flex-col items-center text-center group hover:border-red-500/50 transition-colors">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(239,68,68,0.2)] group-hover:shadow-[0_0_30px_rgba(239,68,68,0.4)] transition-shadow">
                        <Globe size={32} className="text-red-400" />
                    </div>
                    <h4 className="text-2xl font-bold mb-3 text-white">Live Analytics Mode</h4>
                    <p className="text-gray-400 text-sm">
                        Monitor your actual site visitors 
                        populate a 3D environment in real-time as they 
                        interact with your deployed app. See what's working and what isn't.
                    </p>
                </div>
            </div>
        </div>

        {/* Feature 4: Visual Editing */}
        <div className="flex flex-col md:flex-row-reverse items-center gap-12">
          <div className="flex-1 space-y-6">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-400">
              <MousePointer2 size={24} />
            </div>
            <h3 className="text-4xl font-bold tracking-tight">Drag & Drop Evolution</h3>
            <p className="text-gray-400 text-lg leading-relaxed">
              Modify your attributes directly in our IDE. 
              Drag elements to new positions and watch the code update instantly 
              via our bi-directional sync engine that's linked to your own Github repo.
            </p>
          </div>
          <div className="flex-1 w-full">
            <div className="aspect-video bg-gray-900 rounded-2xl border border-white/10 shadow-2xl overflow-hidden relative">
               <video 
                 src={vid2} 
                 autoPlay 
                 loop 
                 muted 
                 playsInline 
                 className="w-full h-full object-cover"
               />
            </div>
          </div>
        </div>

        {/* Feature 5: Live Interaction Heat Maps */}
        <div className="flex flex-col md:flex-row items-center gap-12 mt-12">
          <div className="flex-1 space-y-6">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20 text-red-400">
              <Monitor size={24} />
            </div>
            <h3 className="text-4xl font-bold tracking-tight">Test Your Predictions</h3>
            <p className="text-gray-400 text-lg leading-relaxed">
              Feeling confident with your changes? Put your predictions to the test and see how your users are interacting with your deployed web.
              Our immersive 3D live heat maps overlay directly onto your components, turning raw interaction data into actionable visual insights instantly.
            </p>
          </div>

          <div className="flex-1 w-full">
            <div className="aspect-video bg-gray-900 rounded-2xl border border-white/10 shadow-2xl overflow-hidden relative">
               <img 
                 src={pic2} 
                 alt="Drag and Drop Visual Editing Interface"
                 className="w-full h-full object-cover"
               />
            </div>
          </div>
        </div>

        {/* Feature 6: Natural Language Synthesis */}
        <div className="flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 space-y-6">
            <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center border border-pink-500/20 text-pink-400">
              <Sparkles size={24} />
            </div>
            <h3 className="text-4xl font-bold tracking-tight">Natural Language Synthesis</h3>
            <p className="text-gray-400 text-lg leading-relaxed">
              Don't just write code—describe it. Our Gemini-powered engine translates 
              plain English prompts into complex component logic, styling, and state management 
              in milliseconds.
            </p>
          </div>
          <div className="flex-1 w-full">
            <div className="flex flex-col items-center bg-gray-900/50 rounded-2xl border border-white/10 p-6 shadow-2xl">
              
              <div className="w-full mb-4 px-4 py-2 bg-pink-500/10 border border-pink-500/20 rounded-lg text-pink-400 text-sm font-mono flex items-center gap-2">
                 <Sparkles size={14} />
                 Prompt: "Make the button look like a glowing cyberpunk terminal"
              </div>

              <div className="flex flex-col md:flex-row items-center justify-between w-full gap-4">
                {/* BEFORE */}
                <div className="flex-1 bg-black rounded-xl border border-white/5 p-8 flex items-center justify-center min-h-[160px] w-full">
                    <button className="bg-gray-800 text-white px-4 py-2 border border-gray-700">
                        Click Me
                    </button>
                </div>

                <div className="text-pink-500/50 hidden md:block">
                   <ArrowRight size={32} />
                </div>
                <div className="text-pink-500/50 block md:hidden rotate-90">
                   <ArrowRight size={24} />
                </div>

                <div className="flex-1 bg-[#050505] rounded-xl border border-white/5 p-8 flex items-center justify-center min-h-[160px] w-full relative overflow-hidden">
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.05)_1px,transparent_1px)] bg-[size:10px_10px]" />
                    <button className="relative z-10 bg-black text-cyan-400 px-6 py-3 font-mono font-bold tracking-widest border border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.5),inset_0_0_10px_rgba(6,182,212,0.2)] hover:bg-cyan-950 hover:shadow-[0_0_25px_rgba(6,182,212,0.8),inset_0_0_15px_rgba(6,182,212,0.5)] transition-all uppercase">
                        [ SYSTEM_LINK ]
                    </button>
                </div>
              </div>

            </div>
          </div>
        </div>

       
        {/* Feature 7: Live Analytics Dashboard (UPDATED TO USE pic3.png) */}
        <div className="flex flex-col md:flex-row items-center gap-12 mt-12">
          <div className="flex-1 space-y-6">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400">
              <Activity size={24} />
            </div>
            <h3 className="text-4xl font-bold tracking-tight">Get Metrics That Matter</h3>
            <p className="text-gray-400 text-lg leading-relaxed">
              Turn raw interaction data into actionable insights. 
              Our live telemetry dashboard tracks active agents, average engagement times, and component-level click distributions in real-time.
            </p>
          </div>
          
          <div className="flex-1 w-full">
            <div className="aspect-video bg-gray-900 rounded-2xl border border-white/10 shadow-2xl overflow-hidden relative">
               <img 
                 src={pic3} 
                 alt="Live Analytics Dashboard"
                 className="w-full h-full object-cover"
               />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

// Scroll Nudge 
const ScrollNudge = () => {
    const handleScroll = () => {
        window.scrollTo({
            top: window.innerHeight,
            behavior: 'smooth'
        });
    };

    return (
        <div 
            onClick={handleScroll}
            className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 cursor-pointer opacity-70 hover:opacity-100 transition-opacity duration-300 pointer-events-auto"
        >
            <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-400 font-bold animate-pulse">Explore Features</span>
            <div className="w-6 h-9 border-2 border-white/30 rounded-full flex justify-center p-1 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                <div className="w-1 h-2 bg-white rounded-full animate-scroll-wheel" />
            </div>
            <ChevronsDown size={18} className="text-white/50 animate-bounce" />
        </div>
    )
}

// Footer 
const Footer = () => {
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

    return (
        <div className="relative z-10 w-full bg-black border-t border-white/10 py-12 pb-16 flex flex-col gap-10">
            {/* Tech Stack Marquee */}
            <div className="w-full py-4 overflow-hidden z-10 pointer-events-none">
                <div className="flex items-center justify-center gap-2 text-[10px] text-gray-400 uppercase tracking-[0.3em] mb-6 opacity-50 drop-shadow">
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

            {/* Copyright */}
            <div className="text-center text-gray-600 text-sm">
                <p>&copy; 2026 Darwin. Evolution for your codebase.</p>
            </div>
        </div>
    );
}

// Main App Component 

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

  if (!user) {
    return (
      <div className="min-h-screen w-screen text-white flex flex-col relative overflow-y-auto overflow-x-hidden font-sans selection:bg-purple-500/30">
        
        {/* 3D Background Layer */}
        <SceneBackground />
        
        {/* Styles for UI */}
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
            /* NEW: Scroll Wheel Animation */
            @keyframes scroll-wheel {
                0% { transform: translateY(0); opacity: 1; }
                100% { transform: translateY(10px); opacity: 0; }
            }
            .animate-scroll-wheel {
                animation: scroll-wheel 1.5s infinite;
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

        {/* HERO SECTION (100vh) */}
        <div className="relative h-screen w-full flex flex-col items-center justify-center shrink-0 z-10 pointer-events-none select-none">
            
            <div className="flex flex-col items-center gap-8">
            <div className="relative group cursor-default pointer-events-auto">
                {/* Pulsing Outer Glow */}
                <div className="absolute -inset-2 bg-gradient-to-r from-cyan-400 to-purple-600 rounded-2xl animate-pulse-glow shadow-[0_0_35px_rgba(34,211,238,0.5)]"></div>
                
                {/* Static Sharp Inner Glow */}
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 to-purple-600 rounded-2xl blur-md opacity-80"></div>

                {/* Logo Container */}
                <div className="relative w-24 h-24 bg-[#111] rounded-2xl flex items-center justify-center border border-white/20 shadow-2xl">
                <Dna className="w-12 h-12 text-transparent" stroke="url(#blue-purple-gradient)" strokeWidth={2.5} />
                
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

            {/* Scroll Nudge (Positioned nicely at bottom now) */}
            <ScrollNudge />
        </div>

        {/* SCROLLABLE CONTENT BELOW FOLD */}
        <FeaturesShowcase />

        {/* FOOTER (Powered By + Copyright) */}
        <Footer />

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