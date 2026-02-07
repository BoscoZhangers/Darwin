import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, MeshDistortMaterial, Grid, Environment, TransformControls, Html } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import Crowd from './Crowd';

const FeatureBubble = React.forwardRef(({ color, label, isSelected, onClick }, ref) => {
  useFrame((state) => {
    if (ref.current) {
        const t = state.clock.getElapsedTime();
        ref.current.children[0].position.y = Math.sin(t) * 0.1; 
        if (ref.current.position.y < 1) ref.current.position.y = 1;
    }
  });
  return (
    <group ref={ref} onClick={onClick}>
      <Sphere args={[1, 32, 32]}><MeshDistortMaterial color={color} speed={2} distort={0.4} roughness={0.2} emissive={color} emissiveIntensity={isSelected ? 4 : 1.5} toneMapped={false} /></Sphere>
      <Html position={[0, -1.5, 0]} center distanceFactor={10} style={{ pointerEvents: 'none' }}><div className={`px-3 py-1 rounded-md text-xs font-bold font-mono transition-all border ${isSelected ? 'bg-black text-white border-white scale-125 shadow-[0_0_10px_white]' : 'bg-black/50 text-white/80 border-transparent blur-[0.5px]'}`}>{label}</div></Html>
      {isSelected && (<mesh rotation={[Math.PI / 2, 0, 0]}><ringGeometry args={[1.2, 1.3, 32]} /><meshBasicMaterial color="white" opacity={0.5} transparent /></mesh>)}
    </group>
  );
});

const BubbleCluster = ({ id, position, color, label, crowdCount, isSelected, onSelect }) => {
  const bubbleRef = useRef();
  return (
    <group>
      {isSelected && <TransformControls object={bubbleRef} mode="translate" />}
      <group position={position}><FeatureBubble ref={bubbleRef} label={label} color={color} isSelected={isSelected} onClick={(e) => { e.stopPropagation(); onSelect(id); }} /></group>
      {/* Feature crowds behave normally (seek the bubble) */}
      <Crowd count={crowdCount} targetRef={bubbleRef} color={color} wander={false} />
    </group>
  );
};

export default function Scene({ bubbles, activeId, setActiveId, totalUsers = 0 }) {
  
  const assignedUsers = bubbles.reduce((acc, b) => acc + (b.visible ? (b.count || 0) : 0), 0);
  const unassignedUsers = Math.max(0, totalUsers - assignedUsers);

  return (
    <div className="w-full h-full bg-tech-black cursor-crosshair">
      <Canvas camera={{ position: [8, 8, 12], fov: 45 }} onPointerMissed={(e) => e.type === 'click' && setActiveId(null)} gl={{ antialias: false }}>
        <ambientLight intensity={0.2} />
        <pointLight position={[10, 10, 10]} intensity={1.0} color="#ffffff" />
        <Environment preset="city" />
        <OrbitControls makeDefault minDistance={5} maxDistance={50} maxPolarAngle={Math.PI / 2.05} />
        <Grid infiniteGrid fadeDistance={100} sectionColor="#00f3ff" cellColor="#bc13fe" position={[0, -0.1, 0]} />
        
        <EffectComposer disableNormalPass>
          <Bloom luminanceThreshold={1} mipmapBlur intensity={1.5} radius={0.6} />
          <Vignette eskil={false} offset={0.1} darkness={1.1} />
        </EffectComposer>

        {/* --- GREY CROWD (WANDERING) --- */}
        <Crowd count={unassignedUsers} color="grey" wander={true} />

        {/* --- COLORED CROWDS (FOCUSED) --- */}
        {bubbles.map((b) => {
          if (!b.visible) return null;
          return (
            <BubbleCluster 
              key={b.id}
              {...b} 
              crowdCount={b.count || 0} 
              isSelected={activeId === b.id}
              onSelect={setActiveId}
            />
          );
        })}

      </Canvas>
    </div>
  );
}