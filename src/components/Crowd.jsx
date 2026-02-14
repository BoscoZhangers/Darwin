// src/components/Crowd.jsx
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

        // Apply Offset
        const angle = index * 0.5;
        const radius = 1.5 + (index % 3);
        target.x += Math.cos(angle) * radius;
        target.z += Math.sin(angle) * radius;
    }

    // --- 2. MOVEMENT LOGIC ---
    const distToTarget = current.distanceTo(target);
    
    // STOPPING RADIUS
    const stopRadius = isWandering ? 0.5 : 0.2; 
    const isMoving = distToTarget > stopRadius;

    if (isMoving) {
      const moveVector = target.clone().sub(current).normalize().multiplyScalar(speed);
      group.current.position.add(moveVector);
    }

    // --- 3. ROTATION & ANIMATION ---
    if (isMoving) {
        // RUNNING ANIMATION
        const angle = Math.atan2(target.x - current.x, target.z - current.z);
        const q = new Quaternion().setFromEuler(new Euler(0, angle, 0));
        group.current.quaternion.slerp(q, 0.1);
        
        const t = state.clock.elapsedTime * 15 + speedOffset * 10;
        if(leftArm.current) leftArm.current.rotation.x = Math.sin(t) * 0.6;
        if(rightArm.current) rightArm.current.rotation.x = -Math.sin(t) * 0.6;
        if(leftLeg.current) leftLeg.current.rotation.x = -Math.sin(t) * 0.8;
        if(rightLeg.current) rightLeg.current.rotation.x = Math.sin(t) * 0.8;
        group.current.position.y = Math.abs(Math.sin(t)) * 0.1;
    } else {
        // IDLE ANIMATION
        group.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.02;
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
export default function Crowd({ bubbles = [], capacity = 50, bubbleRefs, rawUsers = {}, demoMode = true }) {
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    setAgents(currentAgents => {
        let newPool = [...currentAgents];

        if (demoMode) {
            // --- DEMO MODE: SIMULATED CROWD BASED ON COUNTS ---
            
            // 1. DOWNSCALE LOGIC
            if (newPool.length > capacity) {
                const assigned = newPool.filter(a => a.assignedTo !== null);
                const unassigned = newPool.filter(a => a.assignedTo === null);
                const keepCount = capacity;
                if (assigned.length >= keepCount) {
                    newPool = assigned.slice(0, keepCount);
                } else {
                    const spaceLeft = keepCount - assigned.length;
                    newPool = [...assigned, ...unassigned.slice(0, spaceLeft)];
                }
            }

            // 2. UPSCALE LOGIC
            if (newPool.length < capacity) {
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

            // 3. CLEANUP ORPHANED AGENTS
            const activeBubbleIds = new Set(bubbles.map(b => b.id));
            newPool.forEach(agent => {
                if (agent.assignedTo && !activeBubbleIds.has(agent.assignedTo)) {
                    agent.assignedTo = null;
                    agent.color = '#444444';
                }
            });

            // 4. ASSIGNMENT LOGIC
            bubbles.forEach(bubble => {
                const targetCount = bubble.count || 0;
                const assignedAgents = newPool.filter(a => a.assignedTo === bubble.id);
                
                if (assignedAgents.length < targetCount) {
                    // Recruit Wanderers
                    const needed = targetCount - assignedAgents.length;
                    let recruitsFound = 0;
                    for (let i = 0; i < newPool.length && recruitsFound < needed; i++) {
                        if (newPool[i].assignedTo === null) {
                            newPool[i].assignedTo = bubble.id;
                            newPool[i].color = bubble.color || 'blue';
                            recruitsFound++;
                        }
                    }
                } else if (assignedAgents.length > targetCount) {
                    // Release Surplus
                    const excess = assignedAgents.length - targetCount;
                    let released = 0;
                    for (let i = 0; i < newPool.length && released < excess; i++) {
                        if (newPool[i].assignedTo === bubble.id) {
                            newPool[i].assignedTo = null;
                            newPool[i].color = '#444444'; 
                            released++;
                        }
                    }
                } else {
                     // Sync Colors
                     assignedAgents.forEach(agent => {
                        const agentIndex = newPool.findIndex(a => a.id === agent.id);
                        if(agentIndex !== -1) {
                            newPool[agentIndex].color = bubble.color;
                        }
                     });
                }
            });

        } else {
            // --- LIVE MODE: REAL USER TRACKING ---
            const activeSessionIds = Object.keys(rawUsers);
            
            // 1. SYNC AGENTS WITH ACTIVE SESSIONS
            // Remove agents not in activeSessionIds
            newPool = newPool.filter(a => activeSessionIds.includes(a.id));
            
            // Add agents for new activeSessionIds
            activeSessionIds.forEach(sessionId => {
                if (!newPool.find(a => a.id === sessionId)) {
                    const angle = Math.random() * Math.PI * 2;
                    const radius = 30 + Math.random() * 20;
                    newPool.push({
                        id: sessionId, // Use actual session ID as Agent ID
                        startPos: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius],
                        assignedTo: null,
                        color: '#444444', 
                        speedOffset: Math.random(),
                    });
                }
            });

            // 2. UPDATE ASSIGNMENTS BASED ON TARGETS FROM RAWUSERS
            newPool.forEach(agent => {
                const sessionData = rawUsers[agent.id];
                const targetId = sessionData?.target;

                // Find if this targetId corresponds to a currently visible bubble
                const targetBubble = bubbles.find(b => b.id === targetId || b.label === targetId);
                
                if (targetBubble && targetBubble.visible) {
                    agent.assignedTo = targetBubble.id;
                    agent.color = targetBubble.color;
                } else {
                    // Wander as grey if no target or target is not tracked
                    agent.assignedTo = null;
                    agent.color = '#444444';
                }
            });
        }

        return [...newPool];
    });
  }, [bubbles, capacity, rawUsers, demoMode]); 

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