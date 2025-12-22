"use client";

import { CheckCircle2 } from "lucide-react";

export type WorkflowStep = 1 | 2 | 3 | 4 | 5;

interface StepProgressProps {
  currentStep: WorkflowStep;
  completedSteps: WorkflowStep[];
  onStepClick: (step: WorkflowStep) => void;
  canNavigateToStep: (step: WorkflowStep) => boolean;
}

const stepLabels: Record<WorkflowStep, string> = {
  1: "Upload Schedule",
  2: "Select Equipment",
  3: "Extract Symbols",
  4: "Upload Plans",
  5: "Verify Locations",
};

const shortLabels: Record<WorkflowStep, string> = {
  1: "Schedule",
  2: "Equip",
  3: "Symbols",
  4: "Plans",
  5: "Verify",
};

export default function StepProgress({
  currentStep,
  completedSteps,
  onStepClick,
  canNavigateToStep,
}: StepProgressProps) {
  const steps: WorkflowStep[] = [1, 2, 3, 4, 5];

  const getStepState = (step: WorkflowStep): "completed" | "current" | "upcoming" | "disabled" => {
    if (completedSteps.includes(step)) return "completed";
    if (step === currentStep) return "current";
    if (canNavigateToStep(step)) return "upcoming";
    return "disabled";
  };

  const getStepStyles = (state: "completed" | "current" | "upcoming" | "disabled") => {
    switch (state) {
      case "completed":
        return {
          circle: "bg-green-500 text-white",
          label: "text-green-700 font-medium",
          line: "bg-green-500",
        };
      case "current":
        return {
          circle: "bg-bv-blue-500 text-white ring-2 ring-bv-blue-200",
          label: "text-bv-blue-700 font-semibold",
          line: "bg-neutral-200",
        };
      case "upcoming":
        return {
          circle: "bg-neutral-100 text-neutral-600 hover:bg-neutral-200",
          label: "text-neutral-600",
          line: "bg-neutral-200",
        };
      case "disabled":
        return {
          circle: "bg-neutral-100 text-neutral-400",
          label: "text-neutral-400",
          line: "bg-neutral-200",
        };
    }
  };

  return (
    <div className="p-4 bg-neutral-50 border-b border-neutral-100">
      {/* Steps with circles and labels aligned */}
      <div className="flex items-start justify-between">
        {steps.map((step, index) => {
          const state = getStepState(step);
          const styles = getStepStyles(state);
          const isClickable = state === "completed" || state === "upcoming" || state === "current";

          return (
            <div key={step} className="flex flex-col items-center relative" style={{ flex: 1 }}>
              {/* Step circle and connecting line */}
              <div className="flex items-center w-full">
                {/* Left line (for steps after first) */}
                {index > 0 && (
                  <div className={`h-0.5 flex-1 ${getStepStyles(getStepState((step - 1) as WorkflowStep)).line}`} />
                )}
                
                {/* Step circle */}
                <button
                  onClick={() => isClickable && onStepClick(step)}
                  disabled={!isClickable}
                  className={`
                    w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold
                    transition-all duration-200 flex-shrink-0
                    ${styles.circle}
                    ${isClickable ? "cursor-pointer" : "cursor-not-allowed"}
                  `}
                  title={stepLabels[step]}
                >
                  {state === "completed" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    step
                  )}
                </button>
                
                {/* Right line (for steps before last) */}
                {index < steps.length - 1 && (
                  <div className={`h-0.5 flex-1 ${styles.line}`} />
                )}
              </div>
              
              {/* Step label - aligned under circle */}
              <button
                onClick={() => isClickable && onStepClick(step)}
                disabled={!isClickable}
                className={`
                  mt-2 text-xs whitespace-nowrap transition-colors
                  ${styles.label}
                  ${isClickable ? "cursor-pointer hover:underline" : "cursor-not-allowed"}
                `}
              >
                {shortLabels[step]}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
