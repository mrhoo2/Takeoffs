"use client";

import { useState } from "react";

interface PlanUploadProps {
    selectedEquipment: any[];
    onUploadComplete: (data: any) => void;
}

export default function PlanUpload({ selectedEquipment, onUploadComplete }: PlanUploadProps) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setUploading(true);
            setError(null);
            const file = e.target.files[0];
            const formData = new FormData();
            formData.append("file", file);
            formData.append("equipment", JSON.stringify(selectedEquipment));

            try {
                const response = await fetch("http://localhost:8000/upload/plans", {
                    method: "POST",
                    body: formData,
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || "Upload failed");
                }

                const data = await response.json();
                onUploadComplete(data);
            } catch (error: any) {
                console.error("Error uploading file:", error);
                setError(error.message || "An unexpected error occurred.");
            } finally {
                setUploading(false);
            }
        }
    };

    return (
        <div className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">Upload Floor Plans</h2>
            <p className="text-sm text-gray-500 mb-6">Select a PDF file containing the floor plans.</p>

            {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded w-full text-center text-sm">
                    {error}
                </div>
            )}

            <label className={`cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {uploading ? "Processing & Locating..." : "Select PDF"}
                <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={uploading}
                />
            </label>
            {uploading && (
                <p className="mt-4 text-sm text-blue-600 animate-pulse">
                    Gemini is scanning the plans for equipment...
                </p>
            )}
        </div>
    );
}
