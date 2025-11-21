"use client";

import { useState } from "react";

interface UploadStepProps {
    onUploadComplete: (data: any) => void;
}

export default function UploadStep({ onUploadComplete }: UploadStepProps) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setUploading(true);
            setError(null);
            const file = e.target.files[0];
            const formData = new FormData();
            formData.append("file", file);

            try {
                const response = await fetch("http://localhost:8000/upload/schedule", {
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
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-neutral-200 rounded-xl bg-white hover:border-bv-blue-300 transition-colors">
            <h2 className="text-xl font-bold mb-3 text-neutral-900">Upload Mechanical Schedule</h2>
            <p className="text-sm text-neutral-500 mb-8">Select a PDF file containing the mechanical equipment schedule.</p>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700 rounded-lg w-full text-center text-sm font-medium">
                    {error}
                </div>
            )}

            <label className={`cursor-pointer bg-bv-blue-500 hover:bg-bv-blue-600 text-white font-medium py-2.5 px-6 rounded-lg transition-all shadow-sm hover:shadow-md ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {uploading ? "Processing..." : "Select PDF"}
                <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={uploading}
                />
            </label>
            {uploading && (
                <p className="mt-6 text-sm text-bv-blue-600 animate-pulse font-medium">
                    Gemini is analyzing the schedule...
                </p>
            )}
        </div>
    );
}
