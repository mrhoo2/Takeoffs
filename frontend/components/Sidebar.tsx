"use client";

import { Table, FileText, Image, PlusCircle, CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import StepProgress, { WorkflowStep } from "./StepProgress";
import FileUpload from "./FileUpload";
import DocumentCard, { UploadedDocument } from "./DocumentCard";

interface SidebarProps {
  // Step navigation
  currentStep: WorkflowStep;
  completedSteps: WorkflowStep[];
  onStepClick: (step: WorkflowStep) => void;
  canNavigateToStep: (step: WorkflowStep) => boolean;

  // Documents
  scheduleDocuments: UploadedDocument[];
  planDocuments: UploadedDocument[];
  symbolDocument: UploadedDocument | null;

  // Document actions
  onAddSchedule: (file: File) => void;
  onRemoveSchedule: (id: string) => void;
  onAddPlan: (file: File) => void;
  onRemovePlan: (id: string) => void;
  onAddSymbol: (file: File) => void;
  onRemoveSymbol: () => void;

  // Status
  isProcessing: boolean;
  
  // Summary data
  summary: {
    totalEquipment: number;
    selectedEquipment: number;
    symbolsExtracted: number;
    locationsVerified: number;
    totalLocations: number;
  };
}

export default function Sidebar({
  currentStep,
  completedSteps,
  onStepClick,
  canNavigateToStep,
  scheduleDocuments,
  planDocuments,
  symbolDocument,
  onAddSchedule,
  onRemoveSchedule,
  onAddPlan,
  onRemovePlan,
  onAddSymbol,
  onRemoveSymbol,
  isProcessing,
  summary,
}: SidebarProps) {
  const hasSchedules = scheduleDocuments.length > 0;
  const hasPlans = planDocuments.length > 0;
  const hasSymbols = symbolDocument !== null;

  return (
    <aside className="w-72 bg-white border-r border-neutral-200 flex flex-col h-full">
      {/* Step Progress */}
      <StepProgress
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={onStepClick}
        canNavigateToStep={canNavigateToStep}
      />

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">
        {/* Schedule Upload Section */}
        <div className="p-4 border-b border-neutral-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`p-1 rounded ${hasSchedules ? "bg-bv-blue-100" : "bg-neutral-100"}`}>
                <Table className={`h-4 w-4 ${hasSchedules ? "text-bv-blue-700" : "text-neutral-500"}`} />
              </div>
              <h3 className="text-sm font-semibold text-neutral-700">Schedule</h3>
            </div>
            {summary.totalEquipment > 0 && (
              <span className="text-xs bg-bv-blue-100 text-bv-blue-700 px-2 py-0.5 rounded-full font-medium">
                {summary.totalEquipment} items
              </span>
            )}
          </div>

          {/* Schedule Document Cards */}
          <div className="space-y-2 mb-3">
            {scheduleDocuments.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onRemove={() => onRemoveSchedule(doc.id)}
              />
            ))}
          </div>

          {/* Add Schedule Button - limit to 3 */}
          {scheduleDocuments.length < 3 && (
            <FileUpload
              onFileSelect={onAddSchedule}
              isProcessing={isProcessing && currentStep === 1}
              variant="schedule"
              compact={hasSchedules}
              description="Upload mechanical equipment schedule"
            />
          )}

          {!hasSchedules && (
            <p className="text-xs text-neutral-400 text-center mt-2">
              Upload a schedule to extract equipment data
            </p>
          )}
        </div>

        {/* Plans Upload Section - appears after step 2 */}
        {currentStep >= 3 && (
          <div className="p-4 border-b border-neutral-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`p-1 rounded ${hasPlans ? "bg-purple-100" : "bg-neutral-100"}`}>
                  <FileText className={`h-4 w-4 ${hasPlans ? "text-purple-700" : "text-neutral-500"}`} />
                </div>
                <h3 className="text-sm font-semibold text-neutral-700">Plans</h3>
              </div>
              {hasPlans && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                  {planDocuments.length} file{planDocuments.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Plan Document Cards */}
            <div className="space-y-2 mb-3">
              {planDocuments.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onRemove={() => onRemovePlan(doc.id)}
                />
              ))}
            </div>

            {/* Add Plan Button */}
            {planDocuments.length < 5 && (
              <FileUpload
                onFileSelect={onAddPlan}
                isProcessing={isProcessing && currentStep === 4}
                variant="plans"
                compact={hasPlans}
                description="Upload floor plans to locate equipment"
              />
            )}

            {!hasPlans && (
              <p className="text-xs text-neutral-400 text-center mt-2">
                Upload plans to verify equipment locations
              </p>
            )}
          </div>
        )}

        {/* Symbols Section - only on step 3 */}
        {currentStep === 3 && (
          <div className="p-4 border-b border-neutral-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`p-1 rounded ${hasSymbols ? "bg-green-100" : "bg-neutral-100"}`}>
                  <Image className={`h-4 w-4 ${hasSymbols ? "text-green-700" : "text-neutral-500"}`} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-700">Symbols</h3>
                  <span className="text-xs text-neutral-400">Optional</span>
                </div>
              </div>
              {summary.symbolsExtracted > 0 && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  {summary.symbolsExtracted} found
                </span>
              )}
            </div>

            {/* Symbol Document Card */}
            {symbolDocument ? (
              <DocumentCard
                document={symbolDocument}
                onRemove={onRemoveSymbol}
              />
            ) : (
              <>
                <FileUpload
                  onFileSelect={onAddSymbol}
                  isProcessing={isProcessing && currentStep === 3}
                  variant="symbols"
                  compact={false}
                  description="Upload symbol legend for better detection"
                />
                <p className="text-xs text-neutral-400 text-center mt-2">
                  Optional: Upload a symbol legend
                </p>
              </>
            )}
          </div>
        )}

        {/* Summary Section - after verification starts */}
        {currentStep >= 5 && summary.totalLocations > 0 && (
          <div className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-neutral-700">Verification Status</h3>

            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded-lg bg-green-100/50">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-700" />
                  <span className="text-sm text-neutral-700">Verified</span>
                </div>
                <span className="text-sm font-semibold text-green-700">
                  {summary.locationsVerified}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-yellow-100/50">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-700" />
                  <span className="text-sm text-neutral-700">Pending</span>
                </div>
                <span className="text-sm font-semibold text-yellow-700">
                  {summary.totalLocations - summary.locationsVerified}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-neutral-500">Progress</span>
                <span className="text-xs text-neutral-500">
                  {summary.locationsVerified} / {summary.totalLocations}
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-1.5">
                <div
                  className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${(summary.locationsVerified / summary.totalLocations) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Empty state hint */}
        {!hasSchedules && currentStep === 1 && (
          <div className="flex-1 flex items-center justify-center p-4 mt-8">
            <div className="text-center">
              <PlusCircle className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
              <p className="text-sm text-neutral-400">
                Start by uploading a<br />mechanical schedule
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
