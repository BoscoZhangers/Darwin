import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// This component renders THOUSANDS of "users" efficiently
export default function Swarm({ count = 100, targetPosition = [0, 0, 0], color = 'white' }) {
  const meshRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Generate random starting positions for each particle
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      const t = Math.random() * 100;
      const speed = 0.01 + Math.random() / 50;
      const xFactor = -10 + Math.random() * 20; // Random spread
      const yFactor = -10 + Math.random() * 20;
      const zFactor = -10 + Math.random() * 20;
      temp.push({ t, speed, xFactor, yFactor, zFactor });
    }
    return temp;
  }, [count]);

  useFrame((state) => {
    if (!meshRef.current) return;

    particles.forEach((particle, i) => {
      let { t, speed, xFactor, yFactor, zFactor } = particle;
      
      // Update time for movement
      t = particle.t += speed;
      
      // ORBIT LOGIC: Make them swarm around the targetPosition
      // We use Sin/Cos to make them circle the "Feature Bubble"
      const x = targetPosition[0] + Math.cos(t) * 2 + Math.sin(t * 1) / 10;
      const y = targetPosition[1] + Math.sin(t) * 2 + Math.cos(t * 1) / 10;
      const z = targetPosition[2] + Math.cos(t) * 2 + Math.sin(t * 1) / 10;

      // Update the dummy object
      dummy.position.set(x, y, z);
      dummy.scale.setScalar(0.1); // Make them tiny
      dummy.updateMatrix();
      
      // Apply the update to the single instance
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      {/* The shape of a "User" (a tiny capsule) */}
      <capsuleGeometry args={[0.5, 1, 4, 8]} />
      <meshBasicMaterial color={color} />
    </instancedMesh>
  );
}