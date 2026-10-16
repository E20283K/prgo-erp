"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { FlexoLayoutResult, FlexoRenderOptions } from "@/lib/flexo/types";
import { RotateCw, Play, Pause, ZoomIn, ZoomOut, Maximize2, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Cylinder3DViewProps {
  result: FlexoLayoutResult;
  options: FlexoRenderOptions;
  cylinderRotation: number;
  onRotationChange: (deg: number) => void;
  isAutoSpinning: boolean;
  onAutoSpinChange: (spinning: boolean) => void;
  orderMeta?: {
    docNo?: string;
    productName?: string;
    customer?: string;
  };
}

export function Cylinder3DView({
  result,
  options,
  cylinderRotation,
  onRotationChange,
  isAutoSpinning,
  onAutoSpinChange,
  orderMeta = {},
}: Cylinder3DViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // References to keep Three.js instances alive without re-instantiating WebGL contexts
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cylinderAxisGroupRef = useRef<THREE.Group | null>(null); // The cylinder parts that spin around the shaft axis
  const animFrameIdRef = useRef<number | null>(null);

  // Sync refs to avoid stale closures in animation loop & event handlers
  const rotationDegRef = useRef<number>(cylinderRotation);
  rotationDegRef.current = cylinderRotation;

  const isAutoSpinningRef = useRef<boolean>(isAutoSpinning);
  isAutoSpinningRef.current = isAutoSpinning;

  // Drag-to-rotate interaction state
  const isDraggingRef = useRef<boolean>(false);
  const prevMouseYRef = useRef<number>(0);

  // When parent slider/presets change, update the 3D cylinder orientation immediately
  useEffect(() => {
    if (cylinderAxisGroupRef.current) {
      // Cylinder axis is horizontal along X, so rotation around its own shaft is cylinderAxisGroup.rotation.x
      cylinderAxisGroupRef.current.rotation.x = (cylinderRotation * Math.PI) / 180;
    }
  }, [cylinderRotation]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 450;

    // 1. Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#090d16");
    sceneRef.current = scene;

    // 2. Camera setup - isometric angle looking at cylinder
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 2000);
    camera.position.set(0, 45, 230);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    rendererRef.current = renderer;

    container.replaceChildren(renderer.domElement);

    // 4. Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 2.4);
    mainLight.position.set(80, 120, 100);
    mainLight.castShadow = true;
    scene.add(mainLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.8);
    rimLight.position.set(-100, -50, -80);
    scene.add(rimLight);

    const bottomFill = new THREE.PointLight(0x93c5fd, 0.9, 300);
    bottomFill.position.set(0, -70, 70);
    scene.add(bottomFill);

    // 5. Build Dynamic 3D Printing Cylinder Roller Assembly
    // Outer static group for stage tilt (gives natural 3D view of horizontal machine roller)
    const stageGroup = new THREE.Group();
    stageGroup.rotation.y = -Math.PI / 14; // slight horizontal angle
    stageGroup.rotation.x = Math.PI / 22; // slight downward view angle
    scene.add(stageGroup);

    // Inner group containing the rotating cylinder, gear, shafts and plate
    // Its longitudinal axis is strictly oriented along X axis (horizontal press roller)
    const spinningRollerGroup = new THREE.Group();
    cylinderAxisGroupRef.current = spinningRollerGroup;
    stageGroup.add(spinningRollerGroup);

    // Physical dimensions (scaled for 3D units)
    const cylDiameter = Math.max(30, result.cylinderDiameter || 80);
    const radius = cylDiameter / 2;
    const webWidth = Math.max(25, result.webWidth || 60);
    const barrelLength = Math.max(140, webWidth + 70);
    const plateThickness = Math.max(1.0, result.plateThickness || 1.7);
    const plateRadius = radius + plateThickness;
    const teethCount = Math.max(12, result.gearTeeth || 100);

    // CylinderGeometry in Three.js aligns with Y axis by default.
    // To make cylinder roll strictly around its own longitudinal axis X,
    // we build cylinder elements inside a sub-container aligned to X.
    const rollerGeoGroup = new THREE.Group();
    rollerGeoGroup.rotation.z = Math.PI / 2; // aligns CylinderGeometry (Y) with X-axis
    spinningRollerGroup.add(rollerGeoGroup);

    // A. Main Steel Cylinder Barrel
    const barrelGeom = new THREE.CylinderGeometry(radius, radius, barrelLength, 64);
    const steelMaterial = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.88,
      roughness: 0.22,
    });
    const barrelMesh = new THREE.Mesh(barrelGeom, steelMaterial);
    barrelMesh.castShadow = true;
    barrelMesh.receiveShadow = true;
    rollerGeoGroup.add(barrelMesh);

    // B. Left & Right Chrome Drive Shafts
    const shaftRadius = radius * 0.38;
    const shaftLength = 48;
    const shaftGeom = new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLength, 32);
    const chromeMaterial = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.95,
      roughness: 0.1,
    });

    const leftShaft = new THREE.Mesh(shaftGeom, chromeMaterial);
    leftShaft.position.y = barrelLength / 2 + shaftLength / 2;
    rollerGeoGroup.add(leftShaft);

    const rightShaft = new THREE.Mesh(shaftGeom, chromeMaterial);
    rightShaft.position.y = -barrelLength / 2 - shaftLength / 2;
    rollerGeoGroup.add(rightShaft);

    // C. Drive Spur Gear (Bronze / Hardened Steel)
    const gearRadius = radius * 1.08;
    const gearWidth = 22;
    const gearGeom = new THREE.CylinderGeometry(gearRadius, gearRadius, gearWidth, teethCount * 2);
    const gearMaterial = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.72,
      roughness: 0.3,
    });
    const gearMesh = new THREE.Mesh(gearGeom, gearMaterial);
    gearMesh.position.y = barrelLength / 2 + gearWidth / 2 + 4;
    rollerGeoGroup.add(gearMesh);

    // Simulated gear teeth spurs
    const teethGroup = new THREE.Group();
    const toothGeom = new THREE.BoxGeometry(gearRadius * 0.12, gearWidth, gearRadius * 0.15);
    for (let i = 0; i < Math.min(teethCount, 72); i++) {
      const angle = (i / Math.min(teethCount, 72)) * Math.PI * 2;
      const tooth = new THREE.Mesh(toothGeom, gearMaterial);
      tooth.position.x = Math.sin(angle) * (gearRadius + 0.5);
      tooth.position.z = Math.cos(angle) * (gearRadius + 0.5);
      tooth.rotation.y = angle;
      teethGroup.add(tooth);
    }
    gearMesh.add(teethGroup);

    // D. Canvas Texture with Generated Flexo Labels & Prepress Layout
    const canvas = document.createElement("canvas");
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      // 1. Photopolymer plate base background
      ctx.fillStyle = "rgba(59, 130, 246, 0.4)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Web area boundaries
      const webRatio = webWidth / barrelLength;
      const webH = canvas.height * webRatio;
      const webTop = (canvas.height - webH) / 2;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, webTop, canvas.width, webH);

      // Plate Joint / Mounting Seam
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(0, webTop, 8, webH);
      ctx.fillStyle = "#dc2626";
      ctx.font = "bold 20px monospace";
      ctx.fillText("PLATE SEAM / REPEAT ZERO", 18, webTop + 28);

      // Render Labels
      const repeatLength = Math.max(40, result.printingLength);
      if (result.positions.length > 0 && result.acrossCount > 0) {
        for (const pos of result.positions) {
          // Circumference mapping (along X)
          const normX = (pos.y / repeatLength) * canvas.width;
          const normW = (pos.height / repeatLength) * canvas.width;

          // Axial mapping (along Y across web width)
          const normY = webTop + (pos.x / webWidth) * webH;
          const normH = (pos.width / webWidth) * webH;

          // Label rectangle fill & stroke
          ctx.fillStyle = "#eff6ff";
          ctx.strokeStyle = "#2563eb";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.roundRect(normX + 2, normY + 2, normW - 4, normH - 4, 8);
          ctx.fill();
          ctx.stroke();

          // Label Text
          ctx.fillStyle = "#1e3a8a";
          ctx.font = "bold 32px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const labelTitle = orderMeta.productName ? orderMeta.productName.slice(0, 14) : "LABEL";
          ctx.fillText(labelTitle, normX + normW / 2, normY + normH / 2 - 12);

          ctx.fillStyle = "#64748b";
          ctx.font = "bold 24px monospace";
          ctx.fillText(`${pos.width} × ${pos.height} mm`, normX + normW / 2, normY + normH / 2 + 20);
        }
      }

      // Prepress registration eye mark
      ctx.fillStyle = "#09090b";
      ctx.fillRect(canvas.width / 2 - 20, webTop + 10, 40, 20);
    }

    const dynamicTexture = new THREE.CanvasTexture(canvas);
    dynamicTexture.wrapS = THREE.RepeatWrapping;
    dynamicTexture.wrapT = THREE.ClampToEdgeWrapping;

    // E. Mounted Flexo Photopolymer Plate Mesh
    const plateGeom = new THREE.CylinderGeometry(plateRadius, plateRadius, webWidth, 64, 1, true);
    const plateMaterial = new THREE.MeshStandardMaterial({
      map: dynamicTexture,
      transparent: true,
      roughness: 0.3,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    const plateMesh = new THREE.Mesh(plateGeom, plateMaterial);
    plateMesh.castShadow = true;
    rollerGeoGroup.add(plateMesh);

    // Apply initial rotation strictly around X-axis
    spinningRollerGroup.rotation.x = (rotationDegRef.current * Math.PI) / 180;

    // 6. Interactive Drag & Spin Handlers: dragging rolls the cylinder on its own shaft!
    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      prevMouseYRef.current = e.clientY;
      if (isAutoSpinningRef.current) {
        onAutoSpinChange(false);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !cylinderAxisGroupRef.current) return;
      const deltaY = e.clientY - prevMouseYRef.current;

      // Dragging vertically rolls the cylinder around its horizontal axle
      const degDelta = deltaY * 0.8;
      let newDeg = (rotationDegRef.current + degDelta) % 360;
      if (newDeg < 0) newDeg += 360;

      rotationDegRef.current = newDeg;
      cylinderAxisGroupRef.current.rotation.x = (newDeg * Math.PI) / 180;
      onRotationChange(Math.round(newDeg));

      prevMouseYRef.current = e.clientY;
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    const domEl = renderer.domElement;
    domEl.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    // 7. Animation Loop (Strict axial rotation around cylinder shaft)
    const animate = () => {
      if (isAutoSpinningRef.current && !isDraggingRef.current && cylinderAxisGroupRef.current) {
        let newDeg = (rotationDegRef.current + 0.6) % 360;
        rotationDegRef.current = newDeg;
        cylinderAxisGroupRef.current.rotation.x = (newDeg * Math.PI) / 180;
        onRotationChange(Math.round(newDeg));
      }
      renderer.render(scene, camera);
      animFrameIdRef.current = requestAnimationFrame(animate);
    };
    animate();

    // Resize Observer
    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    });
    resizeObserver.observe(container);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      resizeObserver.disconnect();
      domEl.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      renderer.dispose();
      dynamicTexture.dispose();
    };
  }, [result, orderMeta, onRotationChange, onAutoSpinChange]);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#090d16] rounded-md overflow-hidden border border-slate-800">
      {/* 3D Top Header Overlay */}
      <div className="absolute top-2 left-2 z-10 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded border border-slate-700/60 pointer-events-none">
        <div className="text-[11px] font-bold text-sky-400 flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-sky-300" />
          <span>WEBGL 3D CYLINDER ROLLER</span>
        </div>
        <div className="text-[9px] text-slate-300 mt-0.5">
          {result.gearTeeth}T Gear · Ø {result.cylinderDiameter}mm · Web {result.webWidth}mm · Drag vertically to roll
        </div>
      </div>

      {/* WebGL Canvas Mount Node */}
      <div ref={containerRef} className="flex-1 w-full h-full cursor-ns-resize min-h-[380px]" />

      {/* Bottom Status Bar */}
      <div className="absolute bottom-2 left-2 right-2 z-10 flex items-center justify-between text-[10px] text-slate-400 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded border border-slate-700/50 pointer-events-none">
        <span>Cylinder Roll Angle: <strong className="text-sky-300 font-mono">{Math.round(cylinderRotation)}°</strong></span>
        <span>Plate: {result.plateThickness}mm photopolymer</span>
        <span>Circumference / Repeat: {result.printingLength}mm</span>
        <span>Axial Spin: Locked to roller shaft</span>
      </div>
    </div>
  );
}
