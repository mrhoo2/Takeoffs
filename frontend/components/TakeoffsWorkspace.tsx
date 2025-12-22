"use client";

import { useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import Header from "./Header";
import Sidebar from "./Sidebar";
import EmptyState from "./EmptyState";
import { WorkflowStep } from "./StepProgress";
import { UploadedDocument, DocumentType, DocumentStatus } from "./DocumentCard";

// Import existing step components
import EquipmentSelection from "./EquipmentSelection";
import SymbolExtraction from "./SymbolExtraction";
import PlanUpload from "./PlanUpload";
import Verification from "./Verification";

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 9);

export default function TakeoffsWorkspace() {
  // Step state
  const [currentStep, setCurrentStep] = useState<WorkflowStep>(1);
  const [completedSteps, setCompletedSteps] = useState<WorkflowStep[]>([]);

  // Document state
  const [scheduleDocuments, setScheduleDocuments] = useState<UploadedDocument[]>([]);
  const [planDocuments, setPlanDocuments] = useState<UploadedDocument[]>([]);
  const [symbolDocument, setSymbolDocument] = useState<UploadedDocument | null>(null);

  // Data state (from processing)
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [scheduleText, setScheduleText] = useState<string | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<any[]>([]);
  const [symbolData, setSymbolData] = useState<{ image: string; examples: any[] } | undefined>(undefined);
  const [planData, setPlanData] = useState<any>(null);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("");

  // Summary data
  const [summary, setSummary] = useState({
    totalEquipment: 0,
    selectedEquipment: 0,
    symbolsExtracted: 0,
    locationsVerified: 0,
    totalLocations: 0,
  });

  // Zoom state
  const [zoom, setZoom] = useState(100);

  // Can navigate to a step?
  const canNavigateToStep = useCallback((step: WorkflowStep): boolean => {
    // Can always go to completed steps
    if (completedSteps.includes(step)) return true;
    // Can go to current step
    if (step === currentStep) return true;
    // Can go to next step if current is completed
    if (step === currentStep + 1 && completedSteps.includes(currentStep as WorkflowStep)) return true;
    return false;
  }, [currentStep, completedSteps]);

  // Navigate to step
  const handleStepClick = useCallback((step: WorkflowStep) => {
    if (canNavigateToStep(step)) {
      setCurrentStep(step);
    }
  }, [canNavigateToStep]);

  // Mark step as complete
  const completeStep = useCallback((step: WorkflowStep) => {
    if (!completedSteps.includes(step)) {
      setCompletedSteps(prev => [...prev, step]);
    }
  }, [completedSteps]);

  // Handle schedule upload
  const handleAddSchedule = useCallback(async (file: File) => {
    const newDoc: UploadedDocument = {
      id: generateId(),
      file,
      type: "schedule",
      status: "uploading",
    };

    setScheduleDocuments(prev => [...prev, newDoc]);
    setIsProcessing(true);
    setProcessingMessage("Starting upload...");

    // Update to processing status
    setScheduleDocuments(prev =>
      prev.map(d => d.id === newDoc.id ? { ...d, status: "processing" as DocumentStatus } : d)
    );

    const formData = new FormData();
    formData.append("file", file);

    // Create AbortController with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/upload/schedule`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorDetail = errorData.detail || errorDetail;
        } catch {
          const text = await response.text();
          if (text) errorDetail += ` - ${text.substring(0, 200)}`;
        }
        throw new Error(errorDetail);
      }

      // Handle SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let finalResult = null;
      let buffer = "";

      while (true) {
        let readResult;
        try {
          readResult = await reader.read();
        } catch (readError: any) {
          if (finalResult) break;
          throw new Error(`Stream error: ${readError?.message || String(readError)}`);
        }

        const { done, value } = readResult;
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const eventSeparator = "\n\n";
        let eventEnd;

        while ((eventEnd = buffer.indexOf(eventSeparator)) !== -1) {
          const eventData = buffer.slice(0, eventEnd);
          buffer = buffer.slice(eventEnd + eventSeparator.length);

          const lines = eventData.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6);
              try {
                const event = JSON.parse(jsonStr);
                if (event.status === 'processing') {
                  setProcessingMessage(event.step || "Processing...");
                } else if (event.status === 'complete') {
                  finalResult = event.result;
                } else if (event.status === 'error') {
                  throw new Error(event.message || "Processing failed");
                }
              } catch (parseErr) {
                console.warn("Failed to parse SSE event:", jsonStr.substring(0, 100));
              }
            }
          }
        }
      }

      if (finalResult) {
        // Fetch images if needed
        if (finalResult.scheduleId && !finalResult.images) {
          setProcessingMessage("Fetching images...");
          try {
            const imagesResponse = await fetch(`${apiUrl}/schedule/${finalResult.scheduleId}/images`);
            if (imagesResponse.ok) {
              const imagesData = await imagesResponse.json();
              finalResult.images = imagesData.images;
            } else {
              finalResult.images = [];
            }
          } catch {
            finalResult.images = [];
          }
        }

        // Update state with results
        setScheduleData(finalResult);
        if (finalResult.text) {
          setScheduleText(finalResult.text);
        }

        // Update document status and item count
        const itemCount = finalResult.equipment?.length || 0;
        setScheduleDocuments(prev =>
          prev.map(d => d.id === newDoc.id ? { ...d, status: "complete" as DocumentStatus, itemCount } : d)
        );

        // Update summary
        setSummary(prev => ({ ...prev, totalEquipment: itemCount }));

        // Complete step 1 and move to step 2
        completeStep(1);
        setCurrentStep(2);
      } else {
        throw new Error("No result received from server");
      }
    } catch (error: any) {
      console.error("Error uploading schedule:", error);
      setScheduleDocuments(prev =>
        prev.map(d => d.id === newDoc.id ? { ...d, status: "error" as DocumentStatus, error: error.message } : d)
      );
    } finally {
      clearTimeout(timeoutId);
      setIsProcessing(false);
      setProcessingMessage("");
    }
  }, [completeStep]);

  // Handle schedule removal
  const handleRemoveSchedule = useCallback((id: string) => {
    setScheduleDocuments(prev => prev.filter(d => d.id !== id));
    // If no schedules left, reset to step 1
    if (scheduleDocuments.length <= 1) {
      setScheduleData(null);
      setScheduleText(null);
      setCompletedSteps(prev => prev.filter(s => s !== 1));
      setCurrentStep(1);
    }
  }, [scheduleDocuments.length]);

  // Handle equipment selection complete
  const handleEquipmentSelection = useCallback((selected: any[]) => {
    setSelectedEquipment(selected);
    setSummary(prev => ({ ...prev, selectedEquipment: selected.length }));
    completeStep(2);
    setCurrentStep(3);
  }, [completeStep]);

  // Handle symbol extraction complete
  const handleSymbolExtractionComplete = useCallback((data: { image: string; examples: any[] }) => {
    setSymbolData(data);
    setSummary(prev => ({ ...prev, symbolsExtracted: data.examples?.length || 0 }));
    completeStep(3);
    setCurrentStep(4);
  }, [completeStep]);

  // Handle symbol extraction skip
  const handleSymbolExtractionSkip = useCallback(() => {
    completeStep(3);
    setCurrentStep(4);
  }, [completeStep]);

  // Handle add symbol document
  const handleAddSymbol = useCallback((file: File) => {
    const newDoc: UploadedDocument = {
      id: generateId(),
      file,
      type: "symbols",
      status: "complete",
    };
    setSymbolDocument(newDoc);
  }, []);

  // Handle remove symbol document
  const handleRemoveSymbol = useCallback(() => {
    setSymbolDocument(null);
  }, []);

  // Handle plan upload
  const handleAddPlan = useCallback(async (file: File) => {
    const newDoc: UploadedDocument = {
      id: generateId(),
      file,
      type: "plans",
      status: "uploading",
    };

    setPlanDocuments(prev => [...prev, newDoc]);

    // Update to processing status
    setPlanDocuments(prev =>
      prev.map(d => d.id === newDoc.id ? { ...d, status: "processing" as DocumentStatus } : d)
    );

    // For now, just mark as complete - actual processing would happen in PlanUpload component
    setTimeout(() => {
      setPlanDocuments(prev =>
        prev.map(d => d.id === newDoc.id ? { ...d, status: "complete" as DocumentStatus } : d)
      );
    }, 1000);
  }, []);

  // Handle plan removal
  const handleRemovePlan = useCallback((id: string) => {
    setPlanDocuments(prev => prev.filter(d => d.id !== id));
  }, []);

  // Handle plan upload complete (from PlanUpload component)
  const handlePlanUploadComplete = useCallback((data: any) => {
    setPlanData(data);
    const totalLocations = data.equipment?.length || 0;
    setSummary(prev => ({ ...prev, totalLocations }));
    completeStep(4);
    setCurrentStep(5);
  }, [completeStep]);

  // Handle verification reset
  const handleReset = useCallback(() => {
    window.location.reload();
  }, []);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 25, 200));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 25, 25));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(100);
  }, []);

  // Determine what to show in main content area
  const hasContent = scheduleDocuments.some(d => d.status === "complete") || currentStep > 1;

  // Render step content
  const renderStepContent = () => {
    // Show empty state if on step 1 with no completed schedules
    if (currentStep === 1 && !scheduleDocuments.some(d => d.status === "complete")) {
      return <EmptyState step={1} />;
    }

    // Show loading state during processing
    if (isProcessing && currentStep === 1) {
      return (
        <div className="h-full flex items-center justify-center bg-neutral-50">
          <div className="text-center">
            <Loader2 className="h-10 w-10 animate-spin text-bv-blue-500 mx-auto mb-4" />
            <p className="text-neutral-600 font-medium">{processingMessage || "Processing..."}</p>
            <p className="text-sm text-neutral-400 mt-2">AI analysis may take up to 2 minutes</p>
          </div>
        </div>
      );
    }

    switch (currentStep) {
      case 2:
        if (scheduleData) {
          return (
            <EquipmentSelection
              equipmentList={scheduleData.equipment}
              images={scheduleData.images}
              onConfirm={handleEquipmentSelection}
            />
          );
        }
        return <EmptyState step={2} />;

      case 3:
        return (
          <SymbolExtraction
            onComplete={handleSymbolExtractionComplete}
            onSkip={handleSymbolExtractionSkip}
          />
        );

      case 4:
        if (!planDocuments.some(d => d.status === "complete")) {
          return <EmptyState step={4} />;
        }
        return (
          <PlanUpload
            selectedEquipment={selectedEquipment}
            scheduleText={scheduleText}
            visualExamples={symbolData}
            onUploadComplete={handlePlanUploadComplete}
          />
        );

      case 5:
        if (planData) {
          return (
            <Verification
              planData={planData}
              onReset={handleReset}
            />
          );
        }
        return <EmptyState step={5} />;

      default:
        return <EmptyState step={currentStep} />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-neutral-50">
      {/* Header */}
      <Header
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        canGenerateReport={completedSteps.includes(5)}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          currentStep={currentStep}
          completedSteps={completedSteps}
          onStepClick={handleStepClick}
          canNavigateToStep={canNavigateToStep}
          scheduleDocuments={scheduleDocuments}
          planDocuments={planDocuments}
          symbolDocument={symbolDocument}
          onAddSchedule={handleAddSchedule}
          onRemoveSchedule={handleRemoveSchedule}
          onAddPlan={handleAddPlan}
          onRemovePlan={handleRemovePlan}
          onAddSymbol={handleAddSymbol}
          onRemoveSymbol={handleRemoveSymbol}
          isProcessing={isProcessing}
          summary={summary}
        />

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-y-auto">
          {renderStepContent()}
        </main>
      </div>
    </div>
  );
}
