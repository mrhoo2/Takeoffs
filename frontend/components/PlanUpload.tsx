"use client";

import { useState } from "react";

interface PlanUploadProps {
    selectedEquipment: any[];
    scheduleText: string | null;
    visualExamples?: { image: string; examples: any[] };
    onUploadComplete: (data: any) => void;
}

export default function PlanUpload({ selectedEquipment, scheduleText, visualExamples, onUploadComplete }: PlanUploadProps) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progressMessage, setProgressMessage] = useState<string>("");
    const [modelName, setModelName] = useState<"flash" | "pro">("flash");

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setUploading(true);
            setError(null);
            const file = e.target.files[0];
            const formData = new FormData();
            formData.append("file", file);
            formData.append("equipment", JSON.stringify(selectedEquipment));
            formData.append("model_name", modelName);
            if (scheduleText) {
                formData.append("schedule_text", scheduleText);
            }
            if (visualExamples) {
                formData.append("visual_examples", JSON.stringify(visualExamples));
            }

            // Create AbortController with 15-minute timeout to prevent browser from closing connection
            // (plans processing can take longer than schedule processing)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15 * 60 * 1000); // 15 minutes
            
            try {
                console.log("Starting upload to /upload/plans (SSE)...");
                console.log("Equipment:", JSON.stringify(selectedEquipment).substring(0, 200));
                
                setProgressMessage("Starting upload...");
                
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                const response = await fetch(`${apiUrl}/upload/plans`, {
                    method: "POST",
                    body: formData,
                    signal: controller.signal,
                });

                console.log("Response received:", {
                    status: response.status,
                    statusText: response.statusText,
                    contentType: response.headers.get('content-type'),
                    ok: response.ok,
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
                let buffer = "";  // Buffer to accumulate partial chunks

                while (true) {
                    let readResult;
                    try {
                        readResult = await reader.read();
                    } catch (readError: any) {
                        console.error("Error reading stream:", {
                            name: readError?.name,
                            message: readError?.message,
                            stack: readError?.stack,
                            type: typeof readError,
                            error: readError
                        });
                        // If we already have a result, don't throw
                        if (finalResult) {
                            console.log("Stream error but we have result, continuing");
                            break;
                        }
                        // Provide more detailed error info
                        const errorName = readError?.name || 'Unknown';
                        const errorMsg = readError?.message || String(readError);
                        throw new Error(`Stream error (${errorName}): ${errorMsg}. This usually means the server connection was interrupted during processing.`);
                    }
                    
                    const { done, value } = readResult;
                    
                    if (done) {
                        console.log("SSE stream ended");
                        break;
                    }
                    
                    const chunk = decoder.decode(value, { stream: true });
                    buffer += chunk;
                    
                    // Process complete SSE events (they end with \n\n)
                    const eventSeparator = "\n\n";
                    let eventEnd;
                    
                    while ((eventEnd = buffer.indexOf(eventSeparator)) !== -1) {
                        const eventData = buffer.slice(0, eventEnd);
                        buffer = buffer.slice(eventEnd + eventSeparator.length);
                        
                        // Parse the event
                        const lines = eventData.split('\n');
                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                const jsonStr = line.slice(6);
                                try {
                                    const event = JSON.parse(jsonStr);
                                    console.log("SSE event:", event.status);
                                    
                                    if (event.status === 'connected') {
                                        console.log("SSE connection established");
                                    } else if (event.status === 'processing') {
                                        setProgressMessage(event.step || "Processing...");
                                    } else if (event.status === 'complete') {
                                        console.log("Processing complete, got result");
                                        finalResult = event.result;
                                    } else if (event.status === 'error') {
                                        throw new Error(event.message || "Processing failed");
                                    }
                                } catch (parseErr: any) {
                                    // Only log if it's actually a parse error, not a re-thrown error
                                    if (parseErr.message && parseErr.message.includes("Processing failed")) {
                                        throw parseErr;
                                    }
                                    const preview = jsonStr ? jsonStr.substring(0, 100) : "(empty)";
                                    console.warn("Failed to parse SSE event:", preview, parseErr);
                                }
                            }
                        }
                    }
                }
                
                if (finalResult) {
                    console.log("Final result keys:", Object.keys(finalResult));
                    onUploadComplete(finalResult);
                } else {
                    throw new Error("No result received from server");
                }
                
            } catch (error: any) {
                console.error("Error uploading file:", error);
                console.error("Error type:", error.name);
                console.error("Error message:", error.message);
                
                let errorMessage = error.message || "An unexpected error occurred.";
                if (error.name === "AbortError") {
                    errorMessage = "Request timed out after 15 minutes. The server may still be processing - check the backend logs.";
                } else if (error.name === "TypeError" && error.message.includes("NetworkError")) {
                    errorMessage = "Network error: The connection was lost during processing. The server may still be processing - check the backend logs.";
                }
                setError(errorMessage);
            } finally {
                clearTimeout(timeoutId);
                setUploading(false);
                setProgressMessage("");
            }
        }
    };

    return (
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-neutral-200 rounded-xl bg-white hover:border-bv-blue-300 transition-colors">
            <h2 className="text-xl font-bold mb-3 text-neutral-900">Upload Floor Plans</h2>
            <p className="text-sm text-neutral-500 mb-8">Select a PDF file containing the floor plans.</p>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700 rounded-lg w-full text-center text-sm font-medium">
                    {error}
                </div>
            )}

            <div className="mb-8 w-full max-w-sm">
                <div className="flex items-center justify-between p-1 bg-neutral-100 rounded-lg mb-2">
                    <button
                        onClick={() => setModelName("flash")}
                        disabled={uploading}
                        className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-all ${modelName === "flash" ? 'bg-white text-bv-blue-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
                    >
                        Fast (Flash)
                    </button>
                    <button
                        onClick={() => setModelName("pro")}
                        disabled={uploading}
                        className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-all ${modelName === "pro" ? 'bg-white text-bv-blue-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
                    >
                        Accurate (Pro)
                    </button>
                </div>
                <p className="text-[10px] text-neutral-400 text-center">
                    {modelName === "flash" 
                        ? "Best for speed and initial drafts" 
                        : "Recommended for high-accuracy verification"}
                </p>
            </div>

            <label className={`cursor-pointer bg-bv-blue-500 hover:bg-bv-blue-600 text-white font-medium py-2.5 px-6 rounded-lg transition-all shadow-sm hover:shadow-md ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
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
                <div className="mt-6 text-center">
                    <p className="text-sm text-bv-blue-600 animate-pulse font-medium">
                        {progressMessage || "BuildVision is scanning the plans for equipment..."}
                    </p>
                    <p className="text-xs text-neutral-400 mt-2">
                        This may take several minutes for large floor plans
                    </p>
                </div>
            )}
        </div>
    );
}
