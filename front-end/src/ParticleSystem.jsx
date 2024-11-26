// ParticleSystem.js
import React, { useRef, useMemo, useEffect, useState } from "react";
import { HubConnectionBuilder } from "@microsoft/signalr";
import { v4 as uuidv4 } from "uuid";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

function randomInAnnularRegion(R_inner, R_outer) {
  const radius = R_inner + Math.random() * (R_outer - R_inner);
  const angle = Math.random() * Math.PI * 2;
  const x = radius * Math.cos(angle);
  const y = radius * Math.sin(angle);
  return { x, y };
}

function screenToWorldFixedZ(globalX, globalY, fixedDepthZ, camera) {
  const isMaximized =
    window.innerWidth === screen.availWidth &&
    window.innerHeight === screen.availHeight;

  if (isMaximized) {
    return new THREE.Vector3(0, 0, fixedDepthZ);
  }

  // Translate global screen coordinates to window coordinates
  const x = globalX - window.screenX;
  const y = globalY - window.screenY;

  // Convert the translated window coordinates to NDC
  const ndcX = (x / window.innerWidth) * 2 - 1;
  const ndcY = -(y / window.innerHeight) * 2 + 1;

  // Generate world coordinates based on NDC
  const vector = new THREE.Vector3(ndcX, ndcY, 1).unproject(camera);
  const direction = vector.sub(camera.position).normalize();
  const distance = (fixedDepthZ - camera.position.z) / direction.z;
  const targetPosition = camera.position
    .clone()
    .add(direction.multiplyScalar(distance));

  return targetPosition;
}

const getLifespan = () => {
  return Math.random() * 0.5;
};

const ParticleSystem = () => {
  const particlesRef = useRef();
  const fixedDepthZ = -75;
  const particleCount = 15000;
  const selectionProbability = 0.35;
  const overshootProbability = 0.35;

  const colorRandom = Math.random();

  const { camera } = useThree();
  const screenTargetPosition = useRef({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });

  const particlesData = useMemo(() => {
    const basePositions = [];
    const colors = [];
    const offsets = [];
    const lifespans = [];
    const isMovingToTarget = [];
    const startDelays = [];
    const targets = [];
    const overshootFactors = []; // Array to store overshoot factors

    for (let i = 0; i < particleCount; i++) {
      const R_inner = 15;
      const R_outer = 20;
      const particlePosition = randomInAnnularRegion(R_inner, R_outer);

      const x = particlePosition.x;
      const y = particlePosition.y;
      const z = fixedDepthZ;

      basePositions.push(x, y, z);

      offsets.push(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
      );

      if (colorRandom > 0.5) {
        const color = new THREE.Color(0x1fb02a);
        colors.push(color.r, color.g, color.b);
      } else {
        const color = new THREE.Color(0xff723d);
        colors.push(color.r, color.g, color.b);
      }

      isMovingToTarget.push(Math.random() < selectionProbability);
      startDelays.push(isMovingToTarget[i] ? Math.random() * 5 : 0);

      lifespans.push(getLifespan());
      targets.push(new THREE.Vector3(x, y, z));

      overshootFactors.push(
        Math.random() < overshootProbability ? 1.2 + Math.random() * 0.3 : 1.0
      );
    }
    return {
      basePositions,
      colors,
      offsets,
      lifespans,
      isMovingToTarget,
      startDelays,
      targets,
      overshootFactors,
    };
  }, [particleCount]);

  // -----------------------------------------------------------------

  const [windowId] = useState(uuidv4());

  useEffect(() => {
    // Establish the SignalR connection
    const connection = new HubConnectionBuilder()
      .withUrl("https://localhost:7091/windowHub") // replace with your hub URL
      .withAutomaticReconnect()
      .build();

    const startConnection = async () => {
      try {
        await connection.start();
        // Set up the listener for receiving actions from the server
        connection.on("ReceiveCenterPosition", (id, x, y) => {
          if (windowId !== id) {
            screenTargetPosition.current = { x, y };
          }
        });
      } catch (err) {
        console.error("SignalR Connection Error: ", err);
      }
    };

    startConnection();

    const updateCenterPosition = () => {
      const centerX = window.screenX + window.innerWidth / 2;
      const centerY = window.screenY + window.innerHeight / 2;

      connection
        .send("SendCenterPosition", windowId, centerX, centerY)
        .catch((err) => console.error("Error sending position:", err));
    };

    // Set interval to update position every 100ms
    const intervalId = setInterval(updateCenterPosition, 100);

    // Clean up: stop the connection and clear the interval on unmount
    return () => {
      clearInterval(intervalId);
      connection.off("ReceiveCenterPosition"); // Remove listener
      connection.stop();
    };
  }, [windowId]);

  useFrame(({ clock }) => {
    const elapsedTime = clock.getElapsedTime();
    const positions = particlesRef.current.geometry.attributes.position.array;
    const {
      offsets,
      basePositions,
      lifespans,
      isMovingToTarget,
      startDelays,
      targets,
      overshootFactors,
    } = particlesData;

    // Calculate the world-space target position based on the latest mouse position
    const newTarget = screenToWorldFixedZ(
      screenTargetPosition.current.x,
      screenTargetPosition.current.y,
      fixedDepthZ,
      camera
    );

    for (let i = 0; i < particleCount; i++) {
      lifespans[i] -= 1 / 60;
      if (lifespans[i] <= 0) {
        positions[i * 3] = basePositions[i * 3];
        positions[i * 3 + 1] = basePositions[i * 3 + 1];
        positions[i * 3 + 2] = basePositions[i * 3 + 2];
        lifespans[i] = getLifespan();
        startDelays[i] = Math.random() * 5;

        // Assign the latest target position from the mouse when the particle resets
        targets[i].copy(newTarget);
        overshootFactors[i] =
          Math.random() < overshootProbability
            ? 1.2 + Math.random() * 0.3
            : 1.0;
        continue;
      }

      if (isMovingToTarget[i] && elapsedTime >= startDelays[i]) {
        const target = targets[i]; // Use the locked target for this particle
        const dx = target.x - positions[i * 3];
        const dy = target.y - positions[i * 3 + 1];
        const dz = target.z - positions[i * 3 + 2];
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const minSpeed = 0.1;
        const maxSpeed = 2;
        const speed =
          (Math.min(maxSpeed, distance * 0.1) + minSpeed) * overshootFactors[i];

        const velocityX = (dx / distance) * speed;
        const velocityY = (dy / distance) * speed;
        const velocityZ = (dz / distance) * speed;

        positions[i * 3] += velocityX;
        positions[i * 3 + 1] += velocityY;
        positions[i * 3 + 2] += velocityZ;

        if (distance < 1) {
          positions[i * 3] = basePositions[i * 3];
          positions[i * 3 + 1] = basePositions[i * 3 + 1];
          positions[i * 3 + 2] = basePositions[i * 3 + 2];
          lifespans[i] = getLifespan();
          // Lock onto a new target only when the particle resets
          targets[i].copy(newTarget);
          overshootFactors[i] =
            Math.random() < overshootProbability
              ? 1.2 + Math.random() * 0.3
              : 1.0;
        }
      } else {
        const baseX = basePositions[i * 3];
        const baseY = basePositions[i * 3 + 1];

        const springFactor =
          1 + 0.1 * Math.sin(elapsedTime * 2 + offsets[i * 3]);

        positions[i * 3] = baseX * springFactor;
        positions[i * 3 + 1] = baseY * springFactor;

        positions[i * 3] += Math.sin(elapsedTime * 2 + offsets[i * 3]) * 0.1;
        positions[i * 3 + 1] +=
          Math.cos(elapsedTime * 2 + offsets[i * 3 + 1]) * 0.1;
        positions[i * 3 + 2] +=
          Math.sin(elapsedTime * 2 + offsets[i * 3 + 2]) * 0.1;
      }
    }
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={new Float32Array(particlesData.basePositions)}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={particleCount}
          array={new Float32Array(particlesData.colors)}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.2} vertexColors />
    </points>
  );
};

export default ParticleSystem;
