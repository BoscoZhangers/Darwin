import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Quaternion, Euler } from 'three';

// --- A Single "Bubble" Character ---
const Agent = ({ index, startPos, targetRef, allAgentsRef, color, speedOffset, wander }) => {
  const group = useRef();
  
  // Limbs
  const leftArm = useRef();
  const rightArm = useRef();
  const leftLeg = useRef();
  const rightLeg = useRef();

  // Internal state for wandering logic (avoids re-renders)
  const wanderTarget = useRef(new Vector3(
    (Math.random() - 0.5) * 50, 
    0, 
    (Math.random() - 0.5) * 50
  ));
  
  // Register this agent
  useEffect(() => {
    if (allAgentsRef.current) allAgentsRef.current[index] = group.current;
    return () => { if (allAgentsRef.current) allAgentsRef.current[index] = null; };
  }, [index, allAgentsRef]);

  const speed = 0.08 + speedOffset * 0.05; 

  useFrame((state) => {
    if (!group.current) return;

    const current = group.current.position;
    const target = new Vector3();

    // --- 1. TARGET LOGIC ---
    if (wander) {
        // WANDER MODE: Go to random point, then pick new random point
        if (current.distanceTo(wanderTarget.current) < 2) {
            wanderTarget.current.set(
                (Math.random() - 0.5) * 60, // Wide range X
                0, 
                (Math.random() - 0.5) * 40  // Wide range Z
            );
        }
        target.copy(wanderTarget.current);
    } else {
        // SEEK MODE: Go to the Bubble
        if (targetRef && targetRef.current) {
            targetRef.current.getWorldPosition(target);
        }
    }

    // --- 2. SEPARATION LOGIC ---
    const separation = new Vector3(0, 0, 0);
    if (allAgentsRef.current) {
      allAgentsRef.current.forEach((neighbor, i) => {
        if (i === index || !neighbor) return;
        const dist = current.distanceTo(neighbor.position);
        if (dist < 1.0 && dist > 0.01) {
          const push = current.clone().sub(neighbor.position).normalize();
          separation.add(push.multiplyScalar(0.08 / (dist * dist))); 
        }
      });
    }

    // --- 3. MOVEMENT LOGIC ---
    const distToTarget = current.distanceTo(target);
    const stopRadius = wander ? 0.5 : 2.5; // Wander agents don't stop, they switch targets
    const moveVector = new Vector3(0, 0, 0);
    const isMoving = distToTarget > stopRadius;

    if (isMoving) {
      const seek = target.clone().sub(current).normalize().multiplyScalar(speed);
      moveVector.add(seek);
      moveVector.add(separation); // Apply pushing
      
      group.current.position.x += moveVector.x;
      group.current.position.z += moveVector.z;
    } else {
      // Idle Nudge
      if (separation.length() > 0.001) group.current.position.add(separation.multiplyScalar(0.5));
    }

    // --- 4. ROTATION & ANIMATION ---
    if (isMoving || separation.length() > 0.1) {
        const lookTarget = isMoving ? target : current.clone().add(separation);
        const angle = Math.atan2(lookTarget.x - current.x, lookTarget.z - current.z);
        const q = new Quaternion().setFromEuler(new Euler(0, angle, 0));
        group.current.quaternion.slerp(q, 0.1);
    }

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

  const skinMaterial = <meshStandardMaterial color="#333" roughness={0.8} />;
  const shirtMaterial = <meshStandardMaterial color={color === 'grey' ? '#444' : color} emissive={color === 'grey' ? '#000' : color} emissiveIntensity={color === 'grey' ? 0 : 0.5} roughness={0.3} />;

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
export default function Crowd({ count = 10, targetRef, color = 'blue', wander = false }) {
  const allAgentsRef = useRef([]); 
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    setAgents(currentAgents => {
        const diff = count - currentAgents.length;
        if (diff === 0) return currentAgents;

        if (diff > 0) {
            // console.log(diff)
            const newAgents = new Array(diff).fill(0).map((_, i) => {
                const angle = Math.random() * Math.PI * 2;
                // Spawn Radius: Wander agents spawn far out (40), Feature agents spawn closer (20)
                const radius = wander ? (40 + Math.random() * 10) : (20 + Math.random() * 5); 
                return {
                    id: Date.now() + i + Math.random(),
                    startPos: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius],
                    speedOffset: Math.random(),
                };
            });
            return [...currentAgents, ...newAgents];
        }
        if (diff < 0) return currentAgents.slice(0, count);
    });
    allAgentsRef.current = allAgentsRef.current.slice(0, count);
  }, [count, wander]);

  return (
    <group>
      {agents.map((agent, i) => (
        <Agent 
          key={agent.id} 
          index={i}
          allAgentsRef={allAgentsRef}
          startPos={agent.startPos} 
          targetRef={targetRef} 
          color={color} 
          speedOffset={agent.speedOffset} 
          wander={wander}
        />
      ))}
    </group>
  );
}