"use client";

import { FileText, Table, Image, Loader2, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";

export type DocumentType = "schedule" | "plans" | "symbols" | "unknown";
export type DocumentStatus = "uploading" | "processing" | "complete" | "error";

export interface UploadedDocument {
  id: string;
  file: File;
  type: DocumentType;
  status: DocumentStatus;
  itemCount?: number;
  error?: string;
}

interface DocumentCardProps {
  document: UploadedDocument;
  onRemove: () => void;
  compact?: boolean;
}

const typeConfig = {
  schedule: {
    icon: Table,
    label: "Schedule",
    bgColor: "bg-bv-blue-100",
    textColor: "text-bv-blue-700",
  },
  plans: {
    icon: FileText,
    label: "Plans",
    bgColor: "bg-purple-100",
    textColor: "text-purple-700",
  },
  symbols: {
    icon: Image,
    label: "Symbols",
    bgColor: "bg-green-100",
    textColor: "text-green-700",
  },
  unknown: {
    icon: FileText,
    label: "Document",
    bgColor: "bg-neutral-100",
    textColor: "text-neutral-600",
  },
};

export default function DocumentCard({
  document,
  onRemove,
  compact = false,
}: DocumentCardProps) {
  const config = typeConfig[document.type];
  const Icon = config.icon;

  const getStatusDisplay = () => {
    switch (document.status) {
      case "uploading":
        return (
          <span className="text-xs text-neutral-500 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Uploading...
          </span>
        );
      case "processing":
        return (
          <span className="text-xs text-bv-blue-600 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processing...
          </span>
        );
      case "complete":
        return (
          <span className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {document.itemCount !== undefined ? `${document.itemCount} items` : "Complete"}
          </span>
        );
      case "error":
        return (
          <span className="text-xs text-red-600 flex items-center gap-1" title={document.error}>
            <AlertCircle className="h-3 w-3" />
            Error
          </span>
        );
    }
  };

  const getBorderColor = () => {
    switch (document.status) {
      case "processing":
        return "border-bv-blue-400 bg-bv-blue-50";
      case "complete":
        return "border-neutral-200 bg-white";
      case "error":
        return "border-red-300 bg-red-50";
      default:
        return "border-neutral-200 bg-neutral-50";
    }
  };

  return (
    <div className={`rounded-lg border p-2 transition-all ${getBorderColor()}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className={`p-1.5 rounded ${config.bgColor}`}>
            <Icon className={`h-3.5 w-3.5 ${config.textColor}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-neutral-800 truncate">
              {document.file.name}
            </p>
            {!compact && (
              <div className="flex items-center gap-2 mt-0.5">
                {getStatusDisplay()}
              </div>
            )}
          </div>
        </div>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="h-6 w-6 p-0 flex items-center justify-center text-neutral-400 hover:text-red-600 flex-shrink-0 rounded hover:bg-red-50 transition-colors"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
