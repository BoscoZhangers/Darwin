import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Quaternion, Euler, Color, MeshStandardMaterial } from 'three';

// --- A Single "Bubble" Character ---
const Agent = ({ index, startPos, assignedTo, bubbleRefs, color, speedOffset }) => {
  const group = useRef();
  
  // Limbs
  const leftArm = useRef();
  const rightArm = useRef();
  const leftLeg = useRef();
  const rightLeg = useRef();
  
  // SHARED MATERIAL
  const outfitMaterial = useMemo(() => {
    return new MeshStandardMaterial({
      color: "#444444",
      roughness: 0.3,
      emissive: "#000000",
      emissiveIntensity: 0
    });
  }, []);

  // Internal state for wandering logic
  const wanderTarget = useRef(new Vector3(
    (Math.random() - 0.5) * 50, 
    0, 
    (Math.random() - 0.5) * 40
  ));
  
  const speed = 0.08 + speedOffset * 0.05; 
  const targetColor = useMemo(() => new Color(color), [color]);

  useFrame((state, delta) => {
    if (!group.current) return;

    const current = group.current.position;
    const target = new Vector3();
    const isWandering = !assignedTo;

    // --- 0. COLOR TRANSITION ---
    outfitMaterial.color.lerp(targetColor, 0.1);
    outfitMaterial.emissive.lerp(targetColor, 0.1);
    const targetIntensity = isWandering ? 0 : 0.5;
    outfitMaterial.emissiveIntensity += (targetIntensity - outfitMaterial.emissiveIntensity) * 0.1;

    // --- 1. TARGET LOGIC ---
    if (isWandering) {
        if (current.distanceTo(wanderTarget.current) < 2) {
            wanderTarget.current.set(
                (Math.random() - 0.5) * 60, 
                0, 
                (Math.random() - 0.5) * 40
            );
        }
        target.copy(wanderTarget.current);
    } else {
        // LOOK UP LIVE POSITION
        const bubbleObj = bubbleRefs.current[assignedTo];
        if (bubbleObj) {
            bubbleObj.getWorldPosition(target); 
        } else {
            target.copy(current);
        }

        // --- TIGHT SPIRAL PACKING (No Overlap) ---
        const SPACING = 0.6; 
        const angle = index * 2.39996; // Golden Angle
        const radius = SPACING * Math.sqrt(index); 

        target.x += Math.cos(angle) * radius;
        target.z += Math.sin(angle) * radius;
    }

    // --- 2. MOVEMENT LOGIC (WITH SNAP) ---
    const distToTarget = current.distanceTo(target);
    const stopThreshold = 0.1; 
    let isMoving = false;

    if (distToTarget > stopThreshold) {
        // Move towards target
        const moveVector = target.clone().sub(current).normalize().multiplyScalar(speed);
        group.current.position.add(moveVector);
        isMoving = true;
    } else {
        // Snap to exact position
        if (!isWandering) {
            group.current.position.lerp(target, 0.2); 
        }
        isMoving = false; 
    }

    // --- 3. ROTATION & ANIMATION ---
    if (isMoving) {
        // Face the target
        const angle = Math.atan2(target.x - current.x, target.z - current.z);
        const q = new Quaternion().setFromEuler(new Euler(0, angle, 0));
        group.current.quaternion.slerp(q, 0.1);
        
        // Run Animation (Limbs moving, Body bobbing)
        const t = state.clock.elapsedTime * 15 + speedOffset * 10;
        if(leftArm.current) leftArm.current.rotation.x = Math.sin(t) * 0.6;
        if(rightArm.current) rightArm.current.rotation.x = -Math.sin(t) * 0.6;
        if(leftLeg.current) leftLeg.current.rotation.x = -Math.sin(t) * 0.8;
        if(rightLeg.current) rightLeg.current.rotation.x = Math.sin(t) * 0.8;
        group.current.position.y = Math.abs(Math.sin(t)) * 0.1;
    } else {
        // --- STOPPED (Fixed in Place) ---
        // 1. Reset Height (No bobbing)
        group.current.position.y = 0;
        
        // 2. Reset Limbs to Neutral
        if(leftLeg.current) leftLeg.current.rotation.x = 0;
        if(rightLeg.current) rightLeg.current.rotation.x = 0;
        if(leftArm.current) leftArm.current.rotation.x = 0; 
        if(rightArm.current) rightArm.current.rotation.x = 0;
    }
  });

  const skinMaterial = <meshStandardMaterial color="#333" roughness={0.8} />;
  
  return (
    <group ref={group} position={startPos}>
      <mesh position={[0, 1.4, 0]}><sphereGeometry args={[0.35, 32, 32]} />{skinMaterial}</mesh>
      <mesh position={[0, 0.75, 0]} material={outfitMaterial}><capsuleGeometry args={[0.25, 0.6, 4, 16]} /></mesh>
      <group position={[-0.3, 1.0, 0]} ref={leftArm}><mesh position={[0, -0.25, 0]} material={outfitMaterial}><capsuleGeometry args={[0.08, 0.5, 4, 8]} /></mesh></group>
      <group position={[0.3, 1.0, 0]} ref={rightArm}><mesh position={[0, -0.25, 0]} material={outfitMaterial}><capsuleGeometry args={[0.08, 0.5, 4, 8]} /></mesh></group>
      <group position={[-0.15, 0.4, 0]} ref={leftLeg}><mesh position={[0, -0.25, 0]}><capsuleGeometry args={[0.1, 0.5, 4, 8]} />{skinMaterial}</mesh></group>
      <group position={[0.15, 0.4, 0]} ref={rightLeg}><mesh position={[0, -0.25, 0]}><capsuleGeometry args={[0.1, 0.5, 4, 8]} />{skinMaterial}</mesh></group>
    </group>
  );
};

// --- The Unified Swarm Controller ---
export default function Crowd({ bubbles = [], capacity = 0, bubbleRefs, rawUsers = {}, demoMode = true }) {
  const [agents, setAgents] = useState([]);

  // --- EFFECT 1: RESIZE POOL (Reactive) ---
  useEffect(() => {
    setAgents(currentAgents => {
        let newPool = [...currentAgents];

        if (demoMode) {
            // DEMO MODE: STRICTLY MATCH CAPACITY
            if (newPool.length > capacity) {
                // Downscale: Remove agents (prefer those wandering, then simple slice)
                newPool = newPool.slice(0, capacity);
            } else if (newPool.length < capacity) {
                // Upscale: Add new agents (start them as wanderers)
                const deficit = capacity - newPool.length;
                for(let i=0; i<deficit; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const radius = 30 + Math.random() * 20;
                    newPool.push({
                        id: Math.random().toString(36).substr(2, 9),
                        startPos: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius],
                        assignedTo: null,
                        color: '#444444', 
                        speedOffset: Math.random(),
                    });
                }
            }
        } else {
            // LIVE MODE: SYNC WITH ACTIVE SESSIONS
            const activeSessionIds = Object.keys(rawUsers);
            
            // Remove inactive
            newPool = newPool.filter(a => activeSessionIds.includes(a.id));
            
            // Add new
            activeSessionIds.forEach(sessionId => {
                if (!newPool.find(a => a.id === sessionId)) {
                    const angle = Math.random() * Math.PI * 2;
                    const radius = 30 + Math.random() * 20;
                    newPool.push({
                        id: sessionId,
                        startPos: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius],
                        assignedTo: null,
                        color: '#444444', 
                        speedOffset: Math.random(),
                    });
                }
            });
        }
        return newPool;
    });
  }, [capacity, rawUsers, demoMode]); 

  // --- EFFECT 2: ASSIGN TARGETS (Demo Mode Interval) ---
  useEffect(() => {
    if (!demoMode) return;

    // Helper: Assign a single agent based on probability
    const assignByProbability = (agent) => {
        const rand = Math.random() * 100;
        let cumulative = 0;
        let target = null; // Default: Wander (Grey)
        let color = '#444444';

        for (let b of bubbles) {
            // bubbles.count is now the Percentage (0-100)
            const prob = b.count || 0;
            cumulative += prob;
            
            if (rand < cumulative) {
                target = b.id;
                color = b.color;
                break;
            }
        }
        return { ...agent, assignedTo: target, color };
    };

    // The Interval Function
    const refreshTargets = () => {
        setAgents(prev => prev.map(agent => assignByProbability(agent)));
    };

    // 1. Run immediately when bubbles change to reflect new probabilities instantly
    refreshTargets();

    // 2. Set interval to shuffle them every 10 seconds
    const interval = setInterval(refreshTargets, 10000);

    return () => clearInterval(interval);
  }, [demoMode, bubbles]); 

  // --- EFFECT 3: ASSIGN TARGETS (Live Mode Reactive) ---
  useEffect(() => {
    if (demoMode) return;

    setAgents(prev => prev.map(agent => {
        const sessionData = rawUsers[agent.id];
        const targetId = sessionData?.target;
        const targetBubble = bubbles.find(b => b.id === targetId || b.label === targetId);
        
        if (targetBubble && targetBubble.visible) {
            return { ...agent, assignedTo: targetBubble.id, color: targetBubble.color };
        } else {
            return { ...agent, assignedTo: null, color: '#444444' };
        }
    }));
  }, [rawUsers, bubbles, demoMode]);

  return (
    <group>
      {agents.map((agent, i) => (
        <Agent 
          key={agent.id} 
          index={i}
          startPos={agent.startPos} 
          assignedTo={agent.assignedTo} 
          bubbleRefs={bubbleRefs}       
          color={agent.color} 
          speedOffset={agent.speedOffset} 
        />
      ))}
    </group>
  );
}