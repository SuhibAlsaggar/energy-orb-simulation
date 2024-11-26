import React from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import ParticleSystem from "./ParticleSystem"; // Assume ParticleSystem is your component
import "./App.css";

const App = () => {
  return (
    <Canvas
      gl={{ antialias: true }}
      camera={{ position: [0, 0, 10], fov: 50 }}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
      }}
      onCreated={({ gl }) => {
        gl.setClearColor("#1a1a1a"); // Background color (e.g., dark gray)
      }}
    >
      <ambientLight intensity={1} />

      {/* Particle system */}
      <ParticleSystem />

      {/* Postprocessing effects */}
      <EffectComposer>
        <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} height={300} />
        <Vignette eskil={false} offset={0.1} darkness={1.1} />
      </EffectComposer>
    </Canvas>
  );
};

export default App;
