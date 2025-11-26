"use client";

import { useState } from "react";

interface UploadStepProps {
    onUploadComplete: (data: any) => void;
}

export default function UploadStep({ onUploadComplete }: UploadStepProps) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progressMessage, setProgressMessage] = useState<string>("");

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setUploading(true);
            setError(null);
            const file = e.target.files[0];
            const formData = new FormData();
            formData.append("file", file);

            // Create AbortController with 10-minute timeout to prevent browser from closing connection
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10 minutes
            
            try {
                console.log("Starting upload to /upload/schedule (SSE)...");
                setProgressMessage("Starting upload...");
                
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                const response = await fetch(`${apiUrl}/upload/schedule`, {
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
                                } catch (parseErr) {
                                    console.warn("Failed to parse SSE event:", jsonStr.substring(0, 100), parseErr);
                                }
                            }
                        }
                    }
                }
                
                if (finalResult) {
                    console.log("Final result keys:", Object.keys(finalResult));
                    
                    // If images are stored server-side, fetch them
                    if (finalResult.scheduleId && !finalResult.images) {
                        setProgressMessage("Fetching images...");
                        try {
                            const imagesResponse = await fetch(`${apiUrl}/schedule/${finalResult.scheduleId}/images`);
                            if (imagesResponse.ok) {
                                const imagesData = await imagesResponse.json();
                                finalResult.images = imagesData.images;
                                console.log(`Fetched ${imagesData.images.length} images`);
                            } else {
                                console.warn("Could not fetch images, proceeding without them");
                                finalResult.images = [];
                            }
                        } catch (imgError) {
                            console.warn("Error fetching images:", imgError);
                            finalResult.images = [];
                        }
                    }
                    
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
                    errorMessage = "Request timed out after 10 minutes. The server may still be processing - check the backend logs.";
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
                <div className="mt-6 text-center">
                    <p className="text-sm text-bv-blue-600 animate-pulse font-medium">
                        {progressMessage || "BuildVision is analyzing the schedule..."}
                    </p>
                    <p className="text-xs text-neutral-400 mt-2">
                        AI analysis may take up to 2 minutes
                    </p>
                </div>
            )}
        </div>
    );
}
