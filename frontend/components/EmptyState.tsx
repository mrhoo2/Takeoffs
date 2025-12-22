"use client";

import { FileText, Upload, Table, Image, MapPin, CheckCircle2 } from "lucide-react";
import { WorkflowStep } from "./StepProgress";

interface EmptyStateProps {
  step: WorkflowStep;
}

const stepConfig: Record<WorkflowStep, {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  hint: string;
}> = {
  1: {
    icon: Table,
    title: "Upload a Schedule to View",
    description: "Upload a mechanical equipment schedule document in the sidebar to begin extracting requirements.",
    hint: "Ready to start your takeoff",
  },
  2: {
    icon: CheckCircle2,
    title: "Select Equipment",
    description: "Review the extracted equipment list and select items for your takeoff.",
    hint: "Equipment data is being processed",
  },
  3: {
    icon: Image,
    title: "Extract Symbols",
    description: "Optionally upload a symbol legend to help identify equipment on plans.",
    hint: "Symbol extraction is optional",
  },
  4: {
    icon: FileText,
    title: "Upload Floor Plans",
    description: "Upload floor plans in the sidebar to locate equipment on drawings.",
    hint: "Plans will be analyzed for equipment locations",
  },
  5: {
    icon: MapPin,
    title: "Verify Locations",
    description: "Review and verify equipment locations identified on the plans.",
    hint: "Click on markers to verify each location",
  },
};

export default function EmptyState({ step }: EmptyStateProps) {
  const config = stepConfig[step];
  const Icon = config.icon;

  return (
    <div className="h-full flex items-center justify-center bg-neutral-50 p-8">
      <div className="text-center max-w-md">
        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-6">
          <Icon className="h-8 w-8 text-neutral-400" />
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-neutral-800 mb-3">
          {config.title}
        </h2>

        {/* Description */}
        <p className="text-neutral-500 mb-6 leading-relaxed">
          {config.description}
        </p>

        {/* Workflow Steps */}
        <div className="flex items-center justify-center gap-3 mb-6">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold
                  ${s === step
                    ? "bg-bv-blue-500 text-white"
                    : s < step
                    ? "bg-green-500 text-white"
                    : "bg-neutral-200 text-neutral-500"
                  }
                `}
              >
                {s < step ? <CheckCircle2 className="h-4 w-4" /> : s}
              </div>
              {s < 5 && (
                <div
                  className={`w-6 h-0.5 ${
                    s < step ? "bg-green-500" : "bg-neutral-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Hint */}
        <p className="text-sm text-neutral-400 flex items-center justify-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-bv-blue-400" />
          {config.hint}
        </p>
      </div>
    </div>
  );
}
