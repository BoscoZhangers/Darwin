import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, MeshDistortMaterial, Grid, Environment, TransformControls, Html } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import Crowd from './Crowd';

// --- FEATURE BUBBLE (GRAVITY WELL) ---
const FeatureBubble = React.forwardRef(({ color, label, isSelected, onClick, scale = 1, count = 0 }, ref) => {
  useFrame((state) => {
    if (ref.current) {
        const t = state.clock.getElapsedTime();
        // Gentle floating animation
        ref.current.children[0].position.y = Math.sin(t) * 0.1; 
    }
  });

  return (
    <group ref={ref} onClick={onClick} scale={scale}>
      <Sphere args={[1, 64, 64]}>
        <MeshDistortMaterial 
          color={color} 
          speed={isSelected ? 5 : 2}       // Faster glitch when active
          distort={isSelected ? 0.6 : 0.3} // Deeper distortion when active
          
          // --- VISUAL TWEAKS ---
          roughness={0.1}                  // Always keep it glossy/smooth
          metalness={isSelected ? 0.6 : 0.1} // Metallic when active, Glass-like when inactive
          
          emissive={color} 
          emissiveIntensity={isSelected ? 4.0 : 0.5} // Blinding Neon vs Dim Glow
          
          toneMapped={false}               // Allows colors to exceed 1.0 for Bloom effect
          transparent={true}               // Required for opacity to work
          opacity={isSelected ? 1.0 : 0.3} // Solid when active, Ghostly transparent when inactive
        />
      </Sphere>
      
      {/* TEXT LABEL */}
      <Html position={[0, 0, 0]} center distanceFactor={6} style={{ pointerEvents: 'none' }}>
        <div 
          className="flex flex-col items-center justify-center text-center w-40 pointer-events-none select-none"
          style={{ 
            transform: `scale(${scale})`, 
            transition: 'transform 0.2s ease-out' 
          }}
        >
            <div className={`text-lg font-black font-mono tracking-widest uppercase leading-none drop-shadow-md ${isSelected ? 'text-white' : 'text-white/80'}`} 
                 style={{ textShadow: '0 0 10px rgba(0,0,0,0.8)' }}>
              {label}
            </div>
            {/* UPDATED: Shows raw interaction count instead of growth percentage */}
            <div className="text-[10px] font-mono text-white/80 mt-1 font-bold" style={{ textShadow: '0 0 4px black' }}>
                {count} INTERACTIONS
            </div>
        </div>
      </Html>

      {/* Cyberpunk Selection Rings */}
      {isSelected && (
        <group rotation={[Math.PI / 2, 0, 0]}>
          {/* Inner Neon Ring */}
          <mesh>
            <ringGeometry args={[1.2, 1.25, 64]} />
            <meshBasicMaterial color={color} toneMapped={false} transparent opacity={1} side={2} />
          </mesh>
          {/* Outer HUD Ring */}
          <mesh>
            <ringGeometry args={[1.35, 1.4, 64]} />
            <meshBasicMaterial color="white" toneMapped={false} transparent opacity={0.5} side={2} />
          </mesh>
        </group>
      )}
    </group>
  );
});

const BubbleCluster = ({ id, position, color, label, crowdCount, isSelected, onSelect }) => {
  const bubbleRef = useRef();

  // --- DATA-DRIVEN SCALING ---
  const targetScale = useMemo(() => {
    const base = 1;
    const growth = (crowdCount || 0) * 0.05; 
    return Math.min(base + growth, 3.0);
  }, [crowdCount]);

  return (
    <group>
      {isSelected && (
        <TransformControls 
          object={bubbleRef} 
          mode="translate"
          size={1.2 * targetScale} 
          depthTest={false}   
          renderOrder={999}   
          lineWidth={2}
        />
      )}
      <group position={position}>
        <FeatureBubble 
          ref={bubbleRef} 
          label={label} 
          color={color} 
          isSelected={isSelected} 
          onClick={(e) => { e.stopPropagation(); onSelect(id); }} 
          scale={targetScale}
          count={crowdCount} // <--- Passing the count down
        />
      </group>
      <Crowd count={crowdCount} targetRef={bubbleRef} color={color} wander={false} />
    </group>
  );
};

export default function Scene({ bubbles, userCount, activeId, setActiveId, darkMode = true }) {
  const crowdSize = userCount !== undefined ? userCount : 50;

  // Theme Colors
  const bgColor = darkMode ? '#000000' : '#ffffff'; 
  const gridSection = darkMode ? '#00f3ff' : '#cbd5e1'; 
  const gridCell = darkMode ? '#bc13fe' : '#e2e8f0'; 

  return (
    <div className={`w-full h-full cursor-crosshair transition-colors duration-500 ${darkMode ? 'bg-black' : 'bg-white'}`}>
      <Canvas 
        camera={{ position: [8, 8, 12], fov: 45 }} 
        onPointerMissed={(e) => e.type === 'click' && setActiveId(null)} 
        gl={{ antialias: true }}
      >
        {/* Dynamic Background */}
        <color attach="background" args={[bgColor]} />
        <fog attach="fog" args={[bgColor, 10, 50]} />

        <ambientLight intensity={darkMode ? 0.4 : 0.8} />
        <pointLight position={[10, 10, 10]} intensity={1.0} color="#ffffff" />
        <Environment preset={darkMode ? "city" : "studio"} />
        
        <OrbitControls makeDefault minDistance={5} maxDistance={50} maxPolarAngle={Math.PI / 2.05} />
        
        <Grid 
          infiniteGrid 
          fadeDistance={50} 
          sectionColor={gridSection} 
          cellColor={gridCell} 
          position={[0, -0.05, 0]} 
        />
        
        {/* Post-Processing */}
        <EffectComposer disableNormalPass>
          <Bloom 
            luminanceThreshold={1} 
            mipmapBlur 
            intensity={darkMode ? 2.5 : 0.2} 
            radius={0.6} 
          />
          <Vignette eskil={false} offset={0.1} darkness={darkMode ? 1.1 : 0.4} />
        </EffectComposer>

        <Crowd count={crowdSize} color={darkMode ? "grey" : "#9ca3af"} wander={true} />

        {bubbles.map((b) => {
          if (!b.visible) return null;
          return (
            <BubbleCluster 
              key={b.id} 
              {...b} 
              crowdCount={b.count} 
              isSelected={activeId === b.id} 
              onSelect={setActiveId} 
            />
          );
        })}
      </Canvas>
    </div>
  );
}