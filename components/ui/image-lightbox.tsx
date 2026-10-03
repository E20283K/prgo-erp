"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  RotateCcw, 
  Download, 
  Maximize2,
  FileImage
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  src: string;
  alt?: string;
  title?: string;
  subtitle?: string;
}

export function ImageLightbox({
  isOpen,
  onClose,
  src,
  alt = "Sample Image",
  title = "Sample Proof Image",
  subtitle,
}: ImageLightboxProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const resetTransform = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (isOpen) {
      resetTransform();
    }
  }, [isOpen, resetTransform]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "+" || e.key === "=") {
        setZoom((z) => Math.min(z + 0.25, 4));
      } else if (e.key === "-" || e.key === "_") {
        setZoom((z) => Math.max(z - 0.25, 0.25));
      } else if (e.key.toLowerCase() === "r") {
        setRotation((r) => (r + 90) % 360);
      } else if (e.key === "0") {
        resetTransform();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, resetTransform]);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 4));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.25));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom((z) => Math.min(z + 0.15, 4));
    } else {
      setZoom((z) => Math.max(z - 0.15, 0.25));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDoubleClick = () => {
    if (zoom === 1) {
      setZoom(2);
    } else {
      resetTransform();
    }
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = src;
    a.download = alt.replace(/\s+/g, "_") || "sample_proof.jpg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isOpen || !mounted) return null;

  const content = (
    <div 
      className="fixed inset-0 z-[9999] flex flex-col bg-black/90 backdrop-blur-md select-none text-white animate-in fade-in-0 duration-150"
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Top Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-white/10 bg-black/40 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <FileImage className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white tracking-wide">{title}</h3>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/80">
                {Math.round(zoom * 100)}%
              </span>
            </div>
            {subtitle && (
              <p className="text-xs text-white/60 truncate max-w-[400px]">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleZoomOut}
            className="h-8 w-8 p-0 text-white/80 hover:text-white hover:bg-white/10 rounded-md"
            title="Zoom Out (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleZoomIn}
            className="h-8 w-8 p-0 text-white/80 hover:text-white hover:bg-white/10 rounded-md"
            title="Zoom In (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetTransform}
            className="h-8 w-8 p-0 text-white/80 hover:text-white hover:bg-white/10 rounded-md"
            title="Reset (0)"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRotate}
            className="h-8 w-8 p-0 text-white/80 hover:text-white hover:bg-white/10 rounded-md"
            title="Rotate 90° (R)"
          >
            <RotateCw className="w-4 h-4" />
          </Button>

          <div className="w-px h-4 bg-white/20 mx-1" />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="h-8 px-2.5 text-xs text-white/80 hover:text-white hover:bg-white/10 rounded-md gap-1.5 font-medium"
            title="Download Image"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Download</span>
          </Button>

          <div className="w-px h-4 bg-white/20 mx-1" />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 text-white/80 hover:text-white hover:bg-red-500/20 hover:text-red-400 rounded-md transition-colors"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div 
        className="flex-1 w-full h-full relative overflow-hidden flex items-center justify-center"
        onMouseDown={handleMouseDown}
        style={{ cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
      >
        <div
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
            transition: isDragging ? "none" : "transform 0.15s ease-out",
          }}
          className="max-w-[92vw] max-h-[85vh] flex items-center justify-center pointer-events-none"
        >
          <img
            src={src}
            alt={alt}
            onDoubleClick={handleDoubleClick}
            className="w-auto h-auto max-w-full max-h-[85vh] object-contain rounded shadow-2xl pointer-events-auto"
            draggable={false}
          />
        </div>
      </div>

      {/* Footer Hints */}
      <div className="h-9 px-4 flex items-center justify-between border-t border-white/10 bg-black/40 text-[11px] text-white/50 shrink-0 font-mono">
        <div className="flex items-center gap-4">
          <span>Double-click to toggle 2x zoom</span>
          <span>Scroll wheel to zoom</span>
          <span>Click & drag to pan</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/80 font-sans">Esc</kbd> to exit</span>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
