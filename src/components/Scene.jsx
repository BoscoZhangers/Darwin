import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, MeshDistortMaterial, Grid, Environment, TransformControls, Html } from '@react-three/drei';
import Crowd from './Crowd';

// --- 1. The Single Feature Bubble ---
const FeatureBubble = React.forwardRef(({ color, label, isSelected, onClick }, ref) => {
  useFrame((state) => {
    if (ref.current) {
        const t = state.clock.getElapsedTime();
        ref.current.children[0].position.y = Math.sin(t) * 0.1; // Bobbing
        
        // Floor Clamp
        if (ref.current.position.y < 1) ref.current.position.y = 1;
    }
  });

  return (
    <group ref={ref} onClick={onClick}>
      <Sphere args={[1, 32, 32]}>
        <MeshDistortMaterial 
          color={color} speed={2} distort={0.4} roughness={0.2}
          emissive={isSelected ? color : 'black'} emissiveIntensity={0.5}
        />
      </Sphere>
      <Html position={[0, -1.5, 0]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
        <div className={`px-2 py-1 rounded text-xs font-bold font-mono transition-all ${isSelected ? 'bg-white text-black scale-110' : 'bg-black/50 text-white'}`}>
          {label}
        </div>
      </Html>
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.2, 1.3, 32]} />
          <meshBasicMaterial color="white" opacity={0.5} transparent />
        </mesh>
      )}
    </group>
  );
});

// --- 2. The Cluster (Bubble + Crowd Wrapper) ---
const BubbleCluster = ({ id, position, color, label, crowdCount, isSelected, onSelect }) => {
  const bubbleRef = useRef();

  return (
    <group>
      {isSelected && <TransformControls object={bubbleRef} mode="translate" />}
      
      <group position={position}>
        <FeatureBubble 
          ref={bubbleRef}
          label={label}
          color={color}
          isSelected={isSelected}
          onClick={(e) => { e.stopPropagation(); onSelect(id); }}
        />
      </group>

      <Crowd count={crowdCount} targetRef={bubbleRef} color={color} />
    </group>
  );
};

// --- 3. The Main Scene ---
export default function Scene({ bubbles, activeId, setActiveId }) {
  return (
    <div className="w-full h-full bg-tech-black cursor-crosshair">
      <Canvas 
        camera={{ position: [8, 8, 12], fov: 45 }}
        onPointerMissed={(e) => e.type === 'click' && setActiveId(null)}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={1.5} color="#ffffff" />
        <Environment preset="city" />

        {/* --- ZOOM & GRID CONTROLS --- */}
        <OrbitControls 
          makeDefault 
          minDistance={5}   // Stop user from zooming too close (inside the bubble)
          maxDistance={50}  // Stop user from zooming too far (lost in space)
          maxPolarAngle={Math.PI / 2.05} // Prevent camera from going UNDER the floor
        />
        
        <Grid 
          infiniteGrid 
          fadeDistance={100} // Increased from 30 to 100 for "Infinite" look
          sectionColor="#00f3ff" 
          cellColor="#bc13fe" 
          position={[0, -0.1, 0]} 
        />

        {/* Render Bubbles */}
        {bubbles.map((b) => (
          <BubbleCluster 
            key={b.id}
            {...b} 
            isSelected={activeId === b.id}
            onSelect={setActiveId}
          />
        ))}

      </Canvas>
    </div>
  );
}