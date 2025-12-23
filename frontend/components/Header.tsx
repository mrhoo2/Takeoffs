"use client";

import { FileText, Download, Loader2, ZoomIn, ZoomOut, Maximize2, RotateCcw, LogIn } from "lucide-react";

interface HeaderProps {
  onGenerateReport?: () => void;
  canGenerateReport?: boolean;
  isGeneratingReport?: boolean;
  onDownloadSummary?: () => void;
  isDownloading?: boolean;
}

export default function Header({
  onGenerateReport,
  canGenerateReport = false,
  isGeneratingReport = false,
  onDownloadSummary,
  isDownloading = false,
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
      <div className="flex items-center">
        <div className="h-6 w-px bg-neutral-200" />
        
        {/* Download Summary (mirrors Generate Report styling) */}
        {onDownloadSummary && (
          <button
            onClick={onDownloadSummary}
            disabled={!canGenerateReport || isDownloading}
            className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] text-white h-8 rounded-md px-3 gap-2 bg-bv-blue-400 hover:bg-bv-blue-500 mx-3"
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Generate Report
          </button>
        )}

      </div>
    </header>
  );
}
