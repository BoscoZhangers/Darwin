import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Quaternion, Euler } from 'three';

// --- A Single "Bubble" Character ---
const Agent = ({ index, startPos, targetRef, allAgentsRef, color, speedOffset }) => {
  const group = useRef();
  
  // Limbs
  const leftArm = useRef();
  const rightArm = useRef();
  const leftLeg = useRef();
  const rightLeg = useRef();
  
  // Register this agent into the shared array
  useEffect(() => {
    if (allAgentsRef.current) {
      allAgentsRef.current[index] = group.current;
    }
    // Cleanup on unmount
    return () => {
      if (allAgentsRef.current) allAgentsRef.current[index] = null;
    };
  }, [index, allAgentsRef]);

  // Randomize speed slightly
  const speed = 0.08 + speedOffset * 0.05; 

  useFrame((state) => {
    if (!group.current || !targetRef.current) return;

    const current = group.current.position;
    const target = new Vector3();
    targetRef.current.getWorldPosition(target);

    // --- 1. SEPARATION LOGIC ---
    const separation = new Vector3(0, 0, 0);
    if (allAgentsRef.current) {
      allAgentsRef.current.forEach((neighbor, i) => {
        if (i === index || !neighbor) return;
        const dist = current.distanceTo(neighbor.position);
        if (dist < 1.0 && dist > 0.1) {
          const push = current.clone().sub(neighbor.position).normalize();
          separation.add(push.multiplyScalar(0.08 / (dist * dist))); 
        }
      });
    }

    // --- 2. MOVEMENT LOGIC ---
    const distToTarget = current.distanceTo(target);
    const stopRadius = 2.5;
    const moveVector = new Vector3(0, 0, 0);
    const isMoving = distToTarget > stopRadius;

    if (isMoving) {
      // Seek Target
      const seek = target.clone().sub(current).normalize().multiplyScalar(speed);
      moveVector.add(seek);
      // Add Separation
      moveVector.add(separation);
      
      // Apply Move
      group.current.position.x += moveVector.x;
      group.current.position.z += moveVector.z;
    } else {
      // Idle Nudge (prevent stacking)
      if (separation.length() > 0.001) {
         group.current.position.add(separation.multiplyScalar(0.5));
      }
    }

    // --- 3. ROTATION LOCK ---
    // Look at where we are going
    if (isMoving || separation.length() > 0.1) {
        const lookTarget = isMoving ? target : current.clone().add(separation);
        const angle = Math.atan2(lookTarget.x - current.x, lookTarget.z - current.z);
        const q = new Quaternion().setFromEuler(new Euler(0, angle, 0));
        group.current.quaternion.slerp(q, 0.1);
    }

    // --- 4. ANIMATION ---
    const t = state.clock.elapsedTime * 15 + speedOffset * 10;
    if (isMoving) {
        if(leftArm.current) leftArm.current.rotation.x = Math.sin(t) * 0.6;
        if(rightArm.current) rightArm.current.rotation.x = -Math.sin(t) * 0.6;
        if(leftLeg.current) leftLeg.current.rotation.x = -Math.sin(t) * 0.8;
        if(rightLeg.current) rightLeg.current.rotation.x = Math.sin(t) * 0.8;
        group.current.position.y = Math.abs(Math.sin(t)) * 0.1;
    } else {
        group.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.05;
        if(leftLeg.current) leftLeg.current.rotation.x = 0;
        if(rightLeg.current) rightLeg.current.rotation.x = 0;
    }
  });

  const skinMaterial = <meshStandardMaterial color="white" roughness={0.3} metalness={0.1} />;
  const shirtMaterial = <meshStandardMaterial color={color} roughness={0.3} metalness={0.1} />;

  return (
    <group ref={group} position={startPos}>
      <mesh position={[0, 1.4, 0]}><sphereGeometry args={[0.35, 32, 32]} />{skinMaterial}</mesh>
      <mesh position={[0, 0.75, 0]}><capsuleGeometry args={[0.25, 0.6, 4, 16]} />{shirtMaterial}</mesh>
      <group position={[-0.3, 1.0, 0]} ref={leftArm}><mesh position={[0, -0.25, 0]}><capsuleGeometry args={[0.08, 0.5, 4, 8]} />{shirtMaterial}</mesh></group>
      <group position={[0.3, 1.0, 0]} ref={rightArm}><mesh position={[0, -0.25, 0]}><capsuleGeometry args={[0.08, 0.5, 4, 8]} />{shirtMaterial}</mesh></group>
      <group position={[-0.15, 0.4, 0]} ref={leftLeg}><mesh position={[0, -0.25, 0]}><capsuleGeometry args={[0.1, 0.5, 4, 8]} />{skinMaterial}</mesh></group>
      <group position={[0.15, 0.4, 0]} ref={rightLeg}><mesh position={[0, -0.25, 0]}><capsuleGeometry args={[0.1, 0.5, 4, 8]} />{skinMaterial}</mesh></group>
    </group>
  );
};

// --- The Swarm Controller ---
export default function Crowd({ count = 10, targetRef, color = 'blue' }) {
  const allAgentsRef = useRef([]); 
  
  // Persistent State for Agents
  const [agents, setAgents] = useState([]);

  // This Effect handles the "Delta" (Adding/Removing agents)
  useEffect(() => {
    setAgents(currentAgents => {
        const diff = count - currentAgents.length;
        
        // 1. No Change
        if (diff === 0) return currentAgents;

        // 2. Add New Agents (Spawn at Edge)
        if (diff > 0) {
            const newAgents = new Array(diff).fill(0).map((_, i) => {
                const id = Date.now() + i + Math.random(); // Unique ID
                const angle = Math.random() * Math.PI * 2;
                
                // SPAWN LOGIC:
                // If it's the very first render (length 0), spawn close (radius 10).
                // If we are adding to an existing crowd, spawn FAR away (radius 35).
                const radius = currentAgents.length === 0 ? (8 + Math.random() * 5) : (35 + Math.random() * 10);
                
                const x = Math.cos(angle) * radius;
                const z = Math.sin(angle) * radius;
                
                // Get Bubble position to spawn relative to it? 
                // No, spawning relative to world center (0,0) ensures they walk IN from the void.
                
                return {
                    id: id,
                    startPos: [x, 0, z],
                    speedOffset: Math.random(),
                };
            });
            return [...currentAgents, ...newAgents];
        }

        // 3. Remove Agents (Slice off the end)
        // This causes them to "disappear" instantly.
        if (diff < 0) {
            return currentAgents.slice(0, count);
        }
    });

    // Resize ref array to match new count
    allAgentsRef.current = allAgentsRef.current.slice(0, count);
  }, [count]);

  return (
    <group>
      {agents.map((agent, i) => (
        <Agent 
          key={agent.id} // IMPORTANT: Key must be unique ID, not index, to prevent re-renders
          index={i}
          allAgentsRef={allAgentsRef}
          startPos={agent.startPos} 
          targetRef={targetRef} 
          color={color} 
          speedOffset={agent.speedOffset} 
        />
      ))}
    </group>
  );
}