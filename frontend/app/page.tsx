"use client";

import { useState } from "react";
import UploadStep from "@/components/UploadStep";
import EquipmentSelection from "@/components/EquipmentSelection";
import PlanUpload from "@/components/PlanUpload";
import Verification from "@/components/Verification";

import SymbolExtraction from "@/components/SymbolExtraction";

export default function Home() {
  const [step, setStep] = useState(1);
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [scheduleText, setScheduleText] = useState<string | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<any[]>([]);
  const [symbolData, setSymbolData] = useState<{ image: string; examples: any[] } | undefined>(undefined);
  const [planData, setPlanData] = useState<any>(null);

  const handleScheduleUpload = (data: any) => {
    setScheduleData(data);
    if (data.text) {
      setScheduleText(data.text);
    }
    setStep(2);
  };

  const handleEquipmentSelection = (selected: any[]) => {
    setSelectedEquipment(selected);
    setStep(3);
  };

  const handleSymbolExtractionComplete = (data: { image: string; examples: any[] }) => {
    setSymbolData(data);
    setStep(4);
  };

  const handleSymbolExtractionSkip = () => {
    setStep(4);
  };

  const handlePlanUpload = (data: any) => {
    setPlanData(data);
    setStep(5);
  };

  return (
    <main className="min-h-screen bg-neutral-50 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12 border-b border-neutral-200 pb-6 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900 tracking-tight">Construction Drawing Processor</h1>
            <div className="flex mt-6 space-x-4 text-sm overflow-x-auto pb-2">
              <span className={`font-medium whitespace-nowrap transition-colors ${step >= 1 ? "text-bv-blue-600" : "text-neutral-400"}`}>1. Upload Schedule</span>
              <span className="text-neutral-300">→</span>
              <span className={`font-medium whitespace-nowrap transition-colors ${step >= 2 ? "text-bv-blue-600" : "text-neutral-400"}`}>2. Select Equipment</span>
              <span className="text-neutral-300">→</span>
              <span className={`font-medium whitespace-nowrap transition-colors ${step >= 3 ? "text-bv-blue-600" : "text-neutral-400"}`}>3. Extract Symbols</span>
              <span className="text-neutral-300">→</span>
              <span className={`font-medium whitespace-nowrap transition-colors ${step >= 4 ? "text-bv-blue-600" : "text-neutral-400"}`}>4. Upload Plans</span>
              <span className="text-neutral-300">→</span>
              <span className={`font-medium whitespace-nowrap transition-colors ${step >= 5 ? "text-bv-blue-600" : "text-neutral-400"}`}>5. Verify Locations</span>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Powered by</span>
            <img
              src="https://cdn.prod.website-files.com/66ed6fd402241302f1dafb02/66ed703fbaacce97115809fd_logo-full-color.png"
              alt="BuildVision"
              className="h-6 w-auto"
            />
          </div>
        </header>

        <div className="mt-8">
          {step === 1 && (
            <UploadStep onUploadComplete={handleScheduleUpload} />
          )}

          {step === 2 && scheduleData && (
            <EquipmentSelection
              equipmentList={scheduleData.equipment}
              images={scheduleData.images}
              onConfirm={handleEquipmentSelection}
            />
          )}

          {step === 3 && (
            <SymbolExtraction
              onComplete={handleSymbolExtractionComplete}
              onSkip={handleSymbolExtractionSkip}
            />
          )}

          {step === 4 && (
            <PlanUpload
              selectedEquipment={selectedEquipment}
              scheduleText={scheduleText}
              visualExamples={symbolData}
              onUploadComplete={handlePlanUpload}
            />
          )}

          {step === 5 && planData && (
            <Verification
              planData={planData}
              onReset={() => window.location.reload()}
            />
          )}
        </div>
      </div>
    </main>
  );
}
