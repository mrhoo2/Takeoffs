"use client";

import { FileText, Download, Loader2, ZoomIn, ZoomOut, Maximize2, RotateCcw } from "lucide-react";

interface HeaderProps {
  onGenerateReport?: () => void;
  canGenerateReport?: boolean;
  isGeneratingReport?: boolean;
  zoom?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  onFullscreen?: () => void;
}

export default function Header({
  onGenerateReport,
  canGenerateReport = false,
  isGeneratingReport = false,
  zoom = 100,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onFullscreen,
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-neutral-200">
      {/* Left: Logo and title */}
      <div className="flex items-center gap-4">
        <img
          src="https://cdn.prod.website-files.com/66ed6fd402241302f1dafb02/66ed703fbaacce97115809fd_logo-full-color.png"
          alt="BuildVision"
          className="h-7 w-auto"
        />
        <div className="h-6 w-px bg-neutral-200" />
        <h1 className="text-lg font-semibold text-neutral-800">Mechanical Takeoffs</h1>
      </div>

      {/* Right: Actions and controls */}
      <div className="flex items-center gap-3">
        {/* Zoom controls */}
        {(onZoomIn || onZoomOut) && (
          <div className="flex items-center gap-1 mr-2">
            <button
              onClick={onZoomOut}
              className="h-8 w-8 flex items-center justify-center text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-sm text-neutral-600 min-w-[3rem] text-center">
              {zoom}%
            </span>
            <button
              onClick={onZoomIn}
              className="h-8 w-8 flex items-center justify-center text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            {onFullscreen && (
              <button
                onClick={onFullscreen}
                className="h-8 w-8 flex items-center justify-center text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors ml-1"
                title="Fullscreen"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            )}
            {onZoomReset && (
              <button
                onClick={onZoomReset}
                className="h-8 w-8 flex items-center justify-center text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                title="Reset zoom"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        <div className="h-6 w-px bg-neutral-200" />

        {/* Generate Report button */}
        {onGenerateReport && (
          <button
            onClick={onGenerateReport}
            disabled={!canGenerateReport || isGeneratingReport}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
              transition-all duration-200
              ${canGenerateReport && !isGeneratingReport
                ? "bg-bv-blue-500 hover:bg-bv-blue-600 text-white shadow-sm hover:shadow-md"
                : "bg-neutral-100 text-neutral-400 cursor-not-allowed"
              }
            `}
          >
            {isGeneratingReport ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Generate Report
              </>
            )}
          </button>
        )}
      </div>
    </header>
  );
}
