"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, File, X, FileText, Image, Plus } from "lucide-react";

interface FileUploadProps {
  label?: string;
  description?: string;
  onFileSelect: (file: File) => void;
  onFileRemove?: () => void;
  selectedFile?: File | null;
  isProcessing?: boolean;
  progress?: number;
  variant?: "schedule" | "plans" | "symbols";
  compact?: boolean;
  disabled?: boolean;
}

const acceptedMimeTypes: Record<string, string[]> = {
  "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
  "application/pdf": [".pdf"],
};

const variantConfig = {
  schedule: {
    bgColor: "bg-bv-blue-100",
    textColor: "text-bv-blue-600",
    hoverBorder: "hover:border-bv-blue-400",
    activeBg: "bg-bv-blue-100",
    activeBorder: "border-bv-blue-400",
  },
  plans: {
    bgColor: "bg-purple-100",
    textColor: "text-purple-600",
    hoverBorder: "hover:border-purple-400",
    activeBg: "bg-purple-100",
    activeBorder: "border-purple-400",
  },
  symbols: {
    bgColor: "bg-green-100",
    textColor: "text-green-600",
    hoverBorder: "hover:border-green-400",
    activeBg: "bg-green-100",
    activeBorder: "border-green-400",
  },
};

export default function FileUpload({
  label,
  description,
  onFileSelect,
  onFileRemove,
  selectedFile,
  isProcessing = false,
  progress = 0,
  variant = "schedule",
  compact = false,
  disabled = false,
}: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const config = variantConfig[variant];

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
      setDragOver(false);
    },
    [onFileSelect]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedMimeTypes,
    maxFiles: 1,
    disabled: isProcessing || disabled,
    onDragEnter: () => setDragOver(true),
    onDragLeave: () => setDragOver(false),
  });

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) {
      return <Image className="h-8 w-8 text-bv-blue-400" />;
    }
    if (file.type === "application/pdf") {
      return <FileText className="h-8 w-8 text-red-500" />;
    }
    return <File className="h-8 w-8 text-neutral-600" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Compact mode - just a button to add more
  if (compact && !selectedFile) {
    return (
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-3 transition-all duration-200 cursor-pointer
          ${config.hoverBorder} hover:${config.activeBg}
          ${isDragActive || dragOver
            ? `${config.activeBorder} ${config.activeBg}`
            : "border-neutral-200 bg-neutral-50"
          }
          ${(isProcessing || disabled) && "opacity-50 cursor-not-allowed"}
        `}
      >
        <input {...getInputProps()} />
        <div className="flex items-center justify-center gap-2 text-neutral-500">
          <Plus className="h-4 w-4" />
          <span className="text-sm">Add another document</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {label && (
        <label className="text-sm font-semibold text-neutral-800 mb-2 block">
          {label}
        </label>
      )}
      
      {!selectedFile ? (
        <div
          {...getRootProps()}
          className={`
            relative border-2 border-dashed rounded-lg p-6 transition-all duration-200 cursor-pointer
            ${config.hoverBorder} hover:${config.activeBg}
            ${isDragActive || dragOver
              ? `${config.activeBorder} ${config.activeBg}`
              : "border-neutral-200 bg-neutral-50"
            }
            ${(isProcessing || disabled) && "opacity-50 cursor-not-allowed"}
          `}
        >
          <input {...getInputProps()} />
          
          <div className="flex flex-col items-center justify-center text-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${config.bgColor}`}>
              <Upload className={`h-6 w-6 ${config.textColor}`} />
            </div>
            
            <p className="text-sm font-medium text-neutral-800 mb-1">
              {isDragActive ? "Drop the file here" : "Drag and drop your file here"}
            </p>
            {description && (
              <p className="text-xs text-neutral-500 mb-3">{description}</p>
            )}
            
            <button
              type="button"
              className={`text-sm font-medium px-4 py-2 rounded-lg border ${config.activeBorder} ${config.textColor} hover:${config.activeBg} transition-colors`}
            >
              Browse Files
            </button>
            
            <p className="text-xs text-neutral-400 mt-2">
              Supports: PDF, PNG, JPG
            </p>
          </div>
        </div>
      ) : (
        <div className="border border-neutral-200 rounded-lg p-3 bg-white">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">{getFileIcon(selectedFile)}</div>
            
            <div className="flex-grow min-w-0">
              <p className="text-sm font-medium text-neutral-800 truncate">
                {selectedFile.name}
              </p>
              <p className="text-xs text-neutral-500">
                {formatFileSize(selectedFile.size)}
              </p>
              
              {isProcessing && (
                <div className="mt-2">
                  <div className="w-full bg-neutral-200 rounded-full h-1.5">
                    <div 
                      className="bg-bv-blue-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">
                    Processing... {progress}%
                  </p>
                </div>
              )}
            </div>
            
            {!isProcessing && onFileRemove && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onFileRemove();
                }}
                className="flex-shrink-0 h-8 w-8 flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
