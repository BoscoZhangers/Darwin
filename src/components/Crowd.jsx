import React, { useRef, useMemo, useEffect } from 'react';
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
  }, [index, allAgentsRef]);

  const speed = 0.05 + speedOffset * 0.02; // Reduced speed variance for stability

  useFrame((state) => {
    if (!group.current || !targetRef.current) return;

    const current = group.current.position;
    const target = new Vector3();
    targetRef.current.getWorldPosition(target);

    // --- 1. SEPARATION LOGIC ---
    const separation = new Vector3(0, 0, 0);
    const minDistance = 1.2; // Increased distance for better "personal space"
    
    if (allAgentsRef.current) {
      allAgentsRef.current.forEach((neighbor, i) => {
        if (i === index || !neighbor) return;
        
        const dist = current.distanceTo(neighbor.position);
        if (dist < minDistance && dist > 0.1) {
          const push = current.clone().sub(neighbor.position).normalize();
          // Exponential falloff: Push REALLY hard if very close
          separation.add(push.multiplyScalar(0.05 / (dist * dist))); 
        }
      });
    }

    // --- 2. MOVEMENT LOGIC ---
    const distToTarget = current.distanceTo(target);
    const stopRadius = 2.5;

    // Movement Vector
    const moveVector = new Vector3(0, 0, 0);

    if (distToTarget > stopRadius) {
      const seek = target.clone().sub(current).normalize().multiplyScalar(speed);
      moveVector.add(seek);
      
      // Apply Separation
      moveVector.add(separation);
      
      // Apply Move (Ignore Y changes)
      group.current.position.x += moveVector.x;
      group.current.position.z += moveVector.z;
    } else {
      // Idle separation (nudging)
      if (separation.length() > 0.001) {
         group.current.position.add(separation.multiplyScalar(0.5));
      }
    }

    // --- 3. ROTATION LOCK (The Fix) ---
    // Instead of simple lookAt, we calculate the angle manually
    const angle = Math.atan2(target.x - current.x, target.z - current.z);
    
    // Smoothly rotate towards the target angle (Lerp)
    // We construct a target Quaternion that is STRICTLY upright (Rotation only on Y axis)
    const targetRotation = new Euler(0, angle, 0);
    const q = new Quaternion().setFromEuler(targetRotation);
    group.current.quaternion.slerp(q, 0.1); // 0.1 = smooth turn speed
    
    // HARD LOCK: Force X and Z rotation to 0 just in case
    group.current.rotation.x = 0;
    group.current.rotation.z = 0;


    // --- 4. ANIMATION (Walk Cycle) ---
    const isMoving = distToTarget > stopRadius;
    const t = state.clock.elapsedTime * 10 + speedOffset * 10;
    
    if (isMoving) {
        // Walk
        if(leftArm.current) leftArm.current.rotation.x = Math.sin(t) * 0.5;
        if(rightArm.current) rightArm.current.rotation.x = -Math.sin(t) * 0.5;
        if(leftLeg.current) leftLeg.current.rotation.x = -Math.sin(t) * 0.8;
        if(rightLeg.current) rightLeg.current.rotation.x = Math.sin(t) * 0.8;
        // Bob body
        group.current.position.y = Math.abs(Math.sin(t)) * 0.1;
    } else {
        // Idle
        group.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.05;
        // Reset limbs
        if(leftArm.current) leftArm.current.rotation.x = Math.sin(state.clock.elapsedTime) * 0.05;
        if(rightArm.current) rightArm.current.rotation.x = -Math.sin(state.clock.elapsedTime) * 0.05;
        if(leftLeg.current) leftLeg.current.rotation.x = 0;
        if(rightLeg.current) rightLeg.current.rotation.x = 0;
    }
  });

  const skinMaterial = <meshStandardMaterial color="white" roughness={0.3} metalness={0.1} />;
  const shirtMaterial = <meshStandardMaterial color={color} roughness={0.3} metalness={0.1} />;

  return (
    <group ref={group} position={startPos}>
      {/* HEAD */}
      <mesh position={[0, 1.4, 0]}>
        <sphereGeometry args={[0.35, 32, 32]} />
        {skinMaterial}
      </mesh>
      {/* BODY */}
      <mesh position={[0, 0.75, 0]}>
        <capsuleGeometry args={[0.25, 0.6, 4, 16]} />
        {shirtMaterial}
      </mesh>
      {/* ARMS */}
      <group position={[-0.3, 1.0, 0]} ref={leftArm}>
        <mesh position={[0, -0.25, 0]}>
           <capsuleGeometry args={[0.08, 0.5, 4, 8]} />
           {shirtMaterial}
        </mesh>
      </group>
      <group position={[0.3, 1.0, 0]} ref={rightArm}>
         <mesh position={[0, -0.25, 0]}>
           <capsuleGeometry args={[0.08, 0.5, 4, 8]} />
           {shirtMaterial}
         </mesh>
      </group>
      {/* LEGS */}
      <group position={[-0.15, 0.4, 0]} ref={leftLeg}>
        <mesh position={[0, -0.25, 0]}>
           <capsuleGeometry args={[0.1, 0.5, 4, 8]} />
           {skinMaterial}
        </mesh>
      </group>
      <group position={[0.15, 0.4, 0]} ref={rightLeg}>
        <mesh position={[0, -0.25, 0]}>
           <capsuleGeometry args={[0.1, 0.5, 4, 8]} />
           {skinMaterial}
        </mesh>
      </group>
    </group>
  );
};

// --- The Swarm Controller ---
export default function Crowd({ count = 10, targetRef, color = 'blue' }) {
  const allAgentsRef = useRef([]); 

  const agents = useMemo(() => {
    allAgentsRef.current = new Array(count).fill(null);
    return new Array(count).fill(0).map(() => {
      const angle = Math.random() * Math.PI * 2;
      const radius = 8 + Math.random() * 8; 
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      return {
        startPos: [x, 0, z],
        speedOffset: Math.random(),
      };
    });
  }, [count]);

  return (
    <group>
      {agents.map((agent, i) => (
        <Agent 
          key={i} 
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