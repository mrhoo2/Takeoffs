"use client";

import { useState } from "react";
import UploadStep from "@/components/UploadStep";
import EquipmentSelection from "@/components/EquipmentSelection";
import PlanUpload from "@/components/PlanUpload";
import Verification from "@/components/Verification";

export default function Home() {
  const [step, setStep] = useState(1);
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<any[]>([]);
  const [planData, setPlanData] = useState<any>(null);

  const handleScheduleUpload = (data: any) => {
    setScheduleData(data);
    setStep(2);
  };

  const handleEquipmentSelection = (selected: any[]) => {
    setSelectedEquipment(selected);
    setStep(3);
  };

  const handlePlanUpload = (data: any) => {
    setPlanData(data);
    setStep(4);
  };

  return (
    <main className="min-h-screen bg-white p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12 border-b pb-4">
          <h1 className="text-3xl font-bold text-gray-900">Construction Drawing Processor</h1>
          <div className="flex mt-4 space-x-4 text-sm">
            <span className={`font-medium ${step >= 1 ? "text-blue-600" : "text-gray-400"}`}>1. Upload Schedule</span>
            <span className="text-gray-300">→</span>
            <span className={`font-medium ${step >= 2 ? "text-blue-600" : "text-gray-400"}`}>2. Select Equipment</span>
            <span className="text-gray-300">→</span>
            <span className={`font-medium ${step >= 3 ? "text-blue-600" : "text-gray-400"}`}>3. Upload Plans</span>
            <span className="text-gray-300">→</span>
            <span className={`font-medium ${step >= 4 ? "text-blue-600" : "text-gray-400"}`}>4. Verify Locations</span>
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
            <PlanUpload
              selectedEquipment={selectedEquipment}
              onUploadComplete={handlePlanUpload}
            />
          )}

          {step === 4 && planData && (
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
