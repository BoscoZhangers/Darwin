import React, { useRef, useMemo, useEffect, useLayoutEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sphere, MeshDistortMaterial, Grid, Environment, TransformControls, Html } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { Vector3 } from 'three'; 
import Crowd from './Crowd';

// --- FEATURE BUBBLE (GRAVITY WELL) ---
const FeatureBubble = React.forwardRef(({ color, label, isSelected, onClick, onDoubleClick, scale = 1, count = 0, ...props }, ref) => {
  useFrame((state) => {
    if (ref.current) {
        const t = state.clock.getElapsedTime();
        ref.current.children[0].position.y = Math.sin(t) * 0.1; 
    }
  });

  return (
    <group ref={ref} onClick={onClick} onDoubleClick={onDoubleClick} scale={scale} {...props}>
      <Sphere args={[1, 64, 64]}>
        <MeshDistortMaterial 
          color={color} 
          speed={isSelected ? 5 : 2}       
          distort={isSelected ? 0.6 : 0.3} 
          roughness={0.1}                  
          metalness={isSelected ? 0.6 : 0.1} 
          emissive={color} 
          emissiveIntensity={isSelected ? 4.0 : 0.5} 
          toneMapped={false}               
          transparent={true}               
          opacity={isSelected ? 1.0 : 0.3} 
        />
      </Sphere>
      
      <Html position={[0, 0, 0]} center distanceFactor={6} style={{ pointerEvents: 'none' }}>
        <div 
          className="flex flex-col items-center justify-center text-center w-40 pointer-events-none select-none"
          style={{ transform: `scale(${scale})`, transition: 'transform 0.2s ease-out' }}
        >
            <div className={`text-lg font-black font-mono tracking-widest uppercase leading-none drop-shadow-md ${isSelected ? 'text-white' : 'text-white/80'}`} style={{ textShadow: '0 0 10px rgba(0,0,0,0.8)' }}>
              {label}
            </div>
            <div className="text-[10px] font-mono text-white/80 mt-1 font-bold" style={{ textShadow: '0 0 4px black' }}>
                {count} INTERACTIONS
            </div>
        </div>
      </Html>

      {isSelected && (
        <group rotation={[Math.PI / 2, 0, 0]}>
          <mesh><ringGeometry args={[1.2, 1.25, 64]} /><meshBasicMaterial color={color} toneMapped={false} transparent opacity={1} side={2} /></mesh>
          <mesh><ringGeometry args={[1.35, 1.4, 64]} /><meshBasicMaterial color="white" toneMapped={false} transparent opacity={0.5} side={2} /></mesh>
        </group>
      )}
    </group>
  );
});

// --- CLUSTER WITH REGISTRATION ---
const BubbleCluster = ({ id, position, color, label, crowdCount, isSelected, onSelect, onDoubleClick, onRegister, onUpdateBubblePosition }) => {
  const bubbleRef = useRef();

  useEffect(() => {
    if (bubbleRef.current && onRegister) {
        onRegister(id, bubbleRef.current);
    }
  }, [id, onRegister]);

  const targetScale = useMemo(() => {
    const base = 1;
    const growth = (crowdCount || 0) * 0.05; 
    return Math.min(base + growth, 3.0);
  }, [crowdCount]);

  const safeY = Math.max(position[1], 3.0);

  // --- CRITICAL FIX: MANAGE POSITION MANUALLY ---
  // We use useLayoutEffect to update position only when props change.
  // This prevents React from overwriting the position while TransformControls is dragging it.
  useLayoutEffect(() => {
    if (bubbleRef.current) {
        bubbleRef.current.position.set(position[0], safeY, position[2]);
    }
  }, [position[0], safeY, position[2]]);

  return (
    <>
      {isSelected && (
        <TransformControls 
          object={bubbleRef} 
          mode="translate"
          size={1.2 * targetScale} 
          depthTest={false}   
          renderOrder={999}   
          lineWidth={2}
          onObjectChange={() => {
            if (bubbleRef.current) {
              // Enforce floor during drag
              if (bubbleRef.current.position.y < 3.0) {
                bubbleRef.current.position.y = 3.0;
              }
            }
          }}
          onMouseUp={() => {
             // Sync final position to state
             if (bubbleRef.current && onUpdateBubblePosition) {
                 onUpdateBubblePosition(id, bubbleRef.current.position.x, bubbleRef.current.position.z);
             }
          }}
        />
      )}
      
      {/* Note: We DO NOT pass 'position' prop here to avoid fighting. We handle it in the effect above. */}
      <FeatureBubble 
        ref={bubbleRef} 
        label={label} 
        color={color} 
        isSelected={isSelected} 
        onClick={(e) => { e.stopPropagation(); onSelect(id); }} 
        onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(id); }} 
        scale={targetScale}
        count={crowdCount} 
      />
    </>
  );
};

// --- CAMERA RIG ---
function CameraRig({ focusedBubble, bubbleRefs }) {
  const { camera, controls } = useThree();
  const targetLookAt = useRef(new Vector3(0, 0, 0));
  const targetCamPos = useRef(new Vector3(8, 8, 12));
  const isTransitioning = useRef(false);

  useFrame((state, delta) => {
    // 1. FOCUSED MODE (Info Box Open)
    if (focusedBubble) {
        const ref = bubbleRefs.current[focusedBubble.id];
        if (ref) {
            const worldPos = new Vector3();
            ref.getWorldPosition(worldPos);
            
            // Set targets for "Left-Side" composition
            targetLookAt.current.copy(worldPos).add(new Vector3(4, 0, 0));
            targetCamPos.current.copy(targetLookAt.current).add(new Vector3(0, 2, 10));

            // Force animate to target
            controls.target.lerp(targetLookAt.current, 0.1);
            camera.position.lerp(targetCamPos.current, 0.1);
            controls.update();
            isTransitioning.current = true;
        }
    } 
    // 2. EXIT TRANSITION (Returning to Overview)
    else if (isTransitioning.current) {
        // Target default overview
        const defaultLookAt = new Vector3(0, 0, 0);
        const defaultPos = new Vector3(8, 8, 12);

        controls.target.lerp(defaultLookAt, 0.05);
        camera.position.lerp(defaultPos, 0.05);
        controls.update();

        // Check if we are "close enough" to stop forcing the camera
        if (camera.position.distanceTo(defaultPos) < 0.5) {
            isTransitioning.current = false; // Release control back to user
        }
    }
    // 3. FREE MODE (OrbitControls handles everything)
  });

  return null;
}

export default function Scene({ bubbles, userCount, activeId, setActiveId, darkMode = true, rawUsers, userTargets, demoMode, focusedBubble, onBubbleDoubleClick, onUpdateBubblePosition }) {
  const bgColor = darkMode ? '#000000' : '#ffffff'; 
  const gridSection = darkMode ? '#00f3ff' : '#cbd5e1'; 
  const gridCell = darkMode ? '#bc13fe' : '#e2e8f0'; 
  
  const bubbleRefs = useRef({}); 

  return (
    <div className={`w-full h-full cursor-crosshair transition-colors duration-500 ${darkMode ? 'bg-black' : 'bg-white'}`}>
      <Canvas 
        camera={{ position: [8, 8, 12], fov: 45 }} 
        onPointerMissed={(e) => e.type === 'click' && setActiveId(null)} 
        gl={{ antialias: true }}
      >
        <color attach="background" args={[bgColor]} />
        {darkMode && <fog attach="fog" args={[bgColor, 25, 100]} />}

        <ambientLight intensity={darkMode ? 0.4 : 0.8} />
        <pointLight position={[10, 10, 10]} intensity={1.0} color="#ffffff" />
        <Environment preset={darkMode ? "city" : "studio"} />
        <OrbitControls makeDefault minDistance={5} maxDistance={50} maxPolarAngle={Math.PI / 2.05} />
        <Grid infiniteGrid fadeDistance={100} sectionColor={gridSection} cellColor={gridCell} position={[0, -0.05, 0]} />
        <EffectComposer disableNormalPass>
          <Bloom luminanceThreshold={1} mipmapBlur intensity={darkMode ? 2.5 : 0.2} radius={0.6} />
          <Vignette eskil={false} offset={0} darkness={darkMode ? 0.8 : 0.4} />
        </EffectComposer>

        <CameraRig focusedBubble={focusedBubble} bubbleRefs={bubbleRefs} />

        <Crowd 
          bubbles={bubbles} 
          capacity={userCount || 0} 
          bubbleRefs={bubbleRefs} 
          rawUsers={rawUsers}
          userTargets={userTargets}
          demoMode={demoMode}
        />

        {bubbles.map((b) => {
          if (!b.visible) return null;
          return (
            <BubbleCluster 
              key={b.id} 
              {...b} 
              crowdCount={b.count} 
              isSelected={activeId === b.id} 
              onSelect={setActiveId}
              onDoubleClick={onBubbleDoubleClick} 
              onUpdateBubblePosition={onUpdateBubblePosition}
              onRegister={(id, ref) => (bubbleRefs.current[id] = ref)} 
            />
          );
        })}
      </Canvas>
    </div>
  );
}