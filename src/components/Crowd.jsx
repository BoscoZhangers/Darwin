import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Quaternion, Euler, Color, MeshStandardMaterial } from 'three';

const Agent = ({ id, startPos, assignedTo, bubbleRefs, color, speedOffset, sharedPositions }) => {
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

  // Cleanup shared position when unmounted
  useEffect(() => {
    return () => {
        if (sharedPositions.current) {
            delete sharedPositions.current[id];
        }
    };
  }, [id, sharedPositions]);

  // Internal state for wandering logic
  const wanderTarget = useRef(new Vector3(
    startPos[0] + (Math.random() - 0.5) * 10, 
    0, 
    startPos[2] + (Math.random() - 0.5) * 10
  ));
  
  // Calculates once when they pick a target, doesn't change if someone else leaves
  const targetOffset = useMemo(() => {
    const angle = Math.random() * Math.PI * 2;
    // Disperse them in a radius of 0.8 to 2.5 around the component
    const radius = Math.random() * 1.7 + 0.8; 
    return new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  }, [assignedTo]); 

  const speed = 0.05 + speedOffset * 0.04; 
  const targetColor = useMemo(() => new Color(color), [color]);

  useFrame((state) => {
    if (!group.current) return;

    const current = group.current.position;
    
    // Broadcast position to swarm for collision detection
    if (sharedPositions.current) {
        sharedPositions.current[id] = current;
    }

    const target = new Vector3();
    const isWandering = !assignedTo;

    // 0. COLOR TRANSITION
    outfitMaterial.color.lerp(targetColor, 0.1);
    outfitMaterial.emissive.lerp(targetColor, 0.1);
    const targetIntensity = isWandering ? 0 : 0.5;
    outfitMaterial.emissiveIntensity += (targetIntensity - outfitMaterial.emissiveIntensity) * 0.1;

    // 1. TARGET LOGIC
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
            // Add their unique stable offset so they don't all target the dead center
            target.add(targetOffset);
        } else {
            target.copy(current);
        }
    }

    // 2. MOVEMENT LOGIC (WITH COLLISION AVOIDANCE) 
    const distToTarget = current.distanceTo(target);
    const stopThreshold = 0.15; 
    let isMoving = false;
    let moveDir = new Vector3();

    // BOIDS SEPARATION (Collision Avoidance)
    const separation = new Vector3();
    let neighbors = 0;
    
    for (const otherId in sharedPositions.current) {
        if (otherId === id) continue;
        const otherPos = sharedPositions.current[otherId];
        if (!otherPos) continue;
        
        const dist = current.distanceTo(otherPos);
        // If another humanoid is closer than 1.0 units, push away
        if (dist > 0 && dist < 1.0) {
            const push = current.clone().sub(otherPos).normalize().divideScalar(dist);
            separation.add(push);
            neighbors++;
        }
    }

    // Move if we are far from our spot, OR if we are being bumped by someone
    if (distToTarget > stopThreshold || neighbors > 0) {
        let dir = new Vector3();
        
        if (distToTarget > stopThreshold) {
            dir = target.clone().sub(current).normalize();
        }
        
        if (neighbors > 0) {
            separation.multiplyScalar(0.4); // Repulsion strength
            dir.add(separation).normalize();
        }

        moveDir.copy(dir); 
        
        const moveVector = dir.multiplyScalar(speed);
        group.current.position.add(moveVector);
        isMoving = true;
    }

    // 3. ROTATION & ANIMATION
    if (isMoving) {
        // Face the exact direction of movement
        if (moveDir.lengthSq() > 0.001) {
            const angle = Math.atan2(moveDir.x, moveDir.z);
            const q = new Quaternion().setFromEuler(new Euler(0, angle, 0));
            group.current.quaternion.slerp(q, 0.15);
        }
        
        // Run Animation
        const t = state.clock.elapsedTime * 15 + speedOffset * 10;
        if(leftArm.current) leftArm.current.rotation.x = Math.sin(t) * 0.6;
        if(rightArm.current) rightArm.current.rotation.x = -Math.sin(t) * 0.6;
        if(leftLeg.current) leftLeg.current.rotation.x = -Math.sin(t) * 0.8;
        if(rightLeg.current) rightLeg.current.rotation.x = Math.sin(t) * 0.8;
        group.current.position.y = Math.abs(Math.sin(t)) * 0.1;
    } else {
        // Stopped completely, stay put
        group.current.position.y = 0;
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
  
  // Shared ref holding live coordinates for all humanoids so they don't walk into each other
  const sharedPositions = useRef({});

  // RESIZE POOL (Reactive)
  useEffect(() => {
    setAgents(currentAgents => {
        let newPool = [...currentAgents];

        if (demoMode) {
            if (newPool.length > capacity) {
                newPool = newPool.slice(0, capacity);
            } else if (newPool.length < capacity) {
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
                        nextUpdate: Date.now() + Math.random() * 5000,
                    });
                }
            }
        } else {
            const activeSessionIds = Object.keys(rawUsers);
            newPool = newPool.filter(a => activeSessionIds.includes(a.id));
            
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

  // ASSIGN TARGETS (Demo Mode Interval) 
  useEffect(() => {
    if (!demoMode) return;

    const assignByProbability = (agent) => {
        const rand = Math.random() * 100;
        let cumulative = 0;
        let target = null;
        let color = '#444444';

        for (let b of bubbles) {
            const prob = b.count || 0;
            cumulative += prob;
            
            if (rand < cumulative) {
                target = b.id;
                color = b.color;
                break;
            }
        }
        
        const nextUpdate = Date.now() + 5000 + Math.random() * 10000;
        return { ...agent, assignedTo: target, color, nextUpdate };
    };

    const interval = setInterval(() => {
        const now = Date.now();
        setAgents(prev => {
            let changed = false;
            const nextAgents = prev.map(agent => {
                const targetExists = !agent.assignedTo || bubbles.some(b => b.id === agent.assignedTo);
                if (now >= agent.nextUpdate || !targetExists) {
                    changed = true;
                    return assignByProbability(agent);
                }
                return agent;
            });
            return changed ? nextAgents : prev;
        });
    }, 500); 

    return () => clearInterval(interval);
  }, [demoMode, bubbles]); 

  //  ASSIGN TARGETS (Live Mode Reactive) 
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
      {agents.map((agent) => (
        <Agent 
            key={agent.id} 
            id={agent.id} 
            startPos={agent.startPos} 
            assignedTo={agent.assignedTo} 
            bubbleRefs={bubbleRefs}       
            color={agent.color} 
            speedOffset={agent.speedOffset} 
            sharedPositions={sharedPositions} 
        />
      ))}
    </group>
  );
}