"use client";

import { useState, useRef, useEffect } from "react";

interface Symbol {
    id: string;
    name: string;
    description?: string;
    bbox: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000
}

interface SymbolExtractionProps {
    onComplete: (data: { image: string; examples: Symbol[] }) => void;
    onSkip: () => void;
}

export default function SymbolExtraction({ onComplete, onSkip }: SymbolExtractionProps) {
    const [uploading, setUploading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [coverPageImage, setCoverPageImage] = useState<string | null>(null);
    const [symbols, setSymbols] = useState<Symbol[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Manual annotation state
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPoint, setStartPoint] = useState<{ x: number, y: number } | null>(null);
    const [currentBox, setCurrentBox] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
    const imageRef = useRef<HTMLImageElement>(null);

    // Zoom state
    const [zoom, setZoom] = useState(1);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setUploading(true);
            setAnalyzing(true);
            setError(null);

            const formData = new FormData();
            formData.append("file", e.target.files[0]);

            try {
                const response = await fetch("http://localhost:8000/upload/cover-page", {
                    method: "POST",
                    body: formData,
                });

                if (!response.ok) {
                    throw new Error("Failed to upload reference page");
                }

                const data = await response.json();
                setCoverPageImage(data.image);

                // We don't auto-extract symbols anymore, user defines them manually
                setSymbols([]);
                setZoom(1); // Reset zoom

            } catch (err: any) {
                setError(err.message);
            } finally {
                setUploading(false);
                setAnalyzing(false);
            }
        }
    };

    const handleDeleteSymbol = (id: string) => {
        setSymbols(symbols.filter(s => s.id !== id));
    };

    // Mouse events for drawing box
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!imageRef.current) return;
        e.preventDefault(); // Prevent default drag behavior

        const rect = imageRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        setIsDrawing(true);
        setStartPoint({ x, y });
        setCurrentBox({ x, y, w: 0, h: 0 });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDrawing || !startPoint || !imageRef.current) return;
        e.preventDefault();

        const rect = imageRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Constrain to image bounds
        const constrainedX = Math.max(0, Math.min(x, rect.width));
        const constrainedY = Math.max(0, Math.min(y, rect.height));

        setCurrentBox({
            x: Math.min(constrainedX, startPoint.x),
            y: Math.min(constrainedY, startPoint.y),
            w: Math.abs(constrainedX - startPoint.x),
            h: Math.abs(constrainedY - startPoint.y)
        });
    };

    const handleMouseUp = () => {
        if (!isDrawing || !currentBox || !imageRef.current) return;
        setIsDrawing(false);

        // Only add if box has some size
        if (currentBox.w < 5 || currentBox.h < 5) {
            setCurrentBox(null);
            setStartPoint(null);
            return;
        }

        // Convert to 0-1000 scale
        const rect = imageRef.current.getBoundingClientRect();
        const scaleX = 1000 / rect.width;
        const scaleY = 1000 / rect.height;

        const newBbox: [number, number, number, number] = [
            currentBox.y * scaleY,
            currentBox.x * scaleX,
            (currentBox.y + currentBox.h) * scaleY,
            (currentBox.x + currentBox.w) * scaleX
        ];

        // Add new symbol
        const newSymbol: Symbol = {
            id: `manual_${Date.now()}`,
            name: "New Example",
            description: "Manually added example",
            bbox: newBbox
        };

        setSymbols([...symbols, newSymbol]);
        setCurrentBox(null);
        setStartPoint(null);
    };

    const handleNameChange = (id: string, newName: string) => {
        setSymbols(symbols.map(s => s.id === id ? { ...s, name: newName } : s));
    };

    // Helper to resize image
    const resizeImage = (base64Str: string, maxWidth = 1024): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = base64Str;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compress to 70% quality
            };
        });
    };

    // Pass image along with symbols
    const handleComplete = async () => {
        if (!coverPageImage) return;

        // Resize image to avoid payload limits
        const resizedImage = await resizeImage(coverPageImage);

        const data = {
            image: resizedImage,
            examples: symbols
        };
        onComplete(data);
    };

    if (!coverPageImage) {
        return (
            <div className="max-w-4xl mx-auto p-8 bg-white rounded-xl shadow-sm border border-neutral-200">
                <h2 className="text-2xl font-bold mb-4 text-neutral-900">Visual Examples (Optional)</h2>
                <p className="text-neutral-600 mb-8">
                    Upload a reference page (e.g., legend, schedule, or plan) and manually select examples of equipment.
                    Gemini will use these visual examples to improve detection accuracy.
                </p>

                <div className="flex gap-4">
                    <label className="cursor-pointer bg-bv-blue-600 hover:bg-bv-blue-700 text-white px-6 py-2.5 rounded-lg transition-all shadow-sm font-medium">
                        {uploading ? "Uploading..." : "Upload Reference Page"}
                        <input
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            onChange={handleFileUpload}
                            disabled={uploading}
                        />
                    </label>
                    <button
                        onClick={onSkip}
                        className="px-6 py-2.5 text-neutral-600 hover:bg-neutral-50 border border-neutral-200 rounded-lg transition-colors font-medium"
                    >
                        Skip this step
                    </button>
                </div>
                {error && <p className="mt-4 text-red-600">{error}</p>}
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto h-[calc(100vh-100px)] flex flex-col">
            <div className="flex justify-between items-center mb-4 shrink-0">
                <h2 className="text-2xl font-bold text-neutral-900">Define Visual Examples</h2>
                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-white border border-neutral-200 rounded-lg shadow-sm">
                        <button
                            onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                            className="px-3 py-1.5 hover:bg-neutral-50 border-r border-neutral-200 text-neutral-600 font-medium"
                        >
                            -
                        </button>
                        <span className="px-3 py-1.5 text-sm font-mono w-16 text-center">
                            {(zoom * 100).toFixed(0)}%
                        </span>
                        <button
                            onClick={() => setZoom(z => Math.min(3, z + 0.25))}
                            className="px-3 py-1.5 hover:bg-neutral-50 text-neutral-600 font-medium"
                        >
                            +
                        </button>
                    </div>
                    <button
                        onClick={() => setCoverPageImage(null)}
                        className="text-neutral-600 hover:text-neutral-900 font-medium px-4 py-2"
                    >
                        Re-upload
                    </button>
                    <button
                        onClick={handleComplete}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg shadow-sm font-medium transition-all"
                    >
                        Confirm & Continue
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                {/* Image Area - Scrollable Container */}
                <div
                    ref={containerRef}
                    className="lg:col-span-2 relative border border-neutral-200 rounded-xl overflow-auto bg-neutral-100 shadow-inner select-none"
                >
                    {/* Scalable Canvas */}
                    <div
                        className="relative origin-top-left transition-all duration-200 ease-out"
                        style={{
                            width: `${zoom * 100}%`,
                            minHeight: '100%'
                        }}
                    >
                        <img
                            ref={imageRef}
                            src={coverPageImage}
                            alt="Reference Page"
                            className="w-full h-auto mix-blend-multiply opacity-95 block"
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            draggable={false}
                        />

                        {/* Overlays */}
                        {symbols.map((symbol) => (
                            <div
                                key={symbol.id}
                                className="absolute border-2 border-bv-blue-500 bg-bv-blue-200/30 hover:bg-bv-blue-200/50 transition-colors cursor-pointer group"
                                style={{
                                    top: `${symbol.bbox[0] / 10}%`,
                                    left: `${symbol.bbox[1] / 10}%`,
                                    height: `${(symbol.bbox[2] - symbol.bbox[0]) / 10}%`,
                                    width: `${(symbol.bbox[3] - symbol.bbox[1]) / 10}%`,
                                }}
                            >
                                <span className="absolute -top-8 left-0 bg-bv-blue-600 text-white text-xs px-2 py-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 font-medium pointer-events-none">
                                    {symbol.name}
                                </span>
                            </div>
                        ))}

                        {/* Drawing Box */}
                        {currentBox && (
                            <div
                                className="absolute border-2 border-green-500 bg-green-200/30 pointer-events-none"
                                style={{
                                    left: currentBox.x,
                                    top: currentBox.y,
                                    width: currentBox.w,
                                    height: currentBox.h
                                }}
                            />
                        )}
                    </div>

                    <div className="fixed bottom-8 left-8 bg-neutral-900/80 text-white px-3 py-1.5 rounded-lg text-sm pointer-events-none backdrop-blur-sm z-50">
                        Click and drag to select an example
                    </div>
                </div>

                {/* Sidebar List */}
                <div className="bg-white border border-neutral-200 rounded-xl p-5 overflow-y-auto shadow-sm flex flex-col">
                    <h3 className="font-bold mb-4 text-lg text-neutral-900 shrink-0">Examples ({symbols.length})</h3>
                    <div className="space-y-4 flex-1">
                        {symbols.map((symbol) => {
                            // Calculate zoom for thumbnail
                            const width = symbol.bbox[3] - symbol.bbox[1];
                            const height = symbol.bbox[2] - symbol.bbox[0];
                            // Target roughly 150% of the box size to show some context
                            const scale = Math.min(1000 / (width * 1.5), 1000 / (height * 1.5));
                            // Center the view
                            const xOffset = (symbol.bbox[1] + width / 2) / 10; // Center X in %
                            const yOffset = (symbol.bbox[0] + height / 2) / 10; // Center Y in %

                            return (
                                <div key={symbol.id} className="p-3 border border-neutral-200 rounded-lg bg-neutral-50 hover:border-bv-blue-300 transition-colors group">
                                    <div className="flex justify-between items-start mb-2">
                                        <input
                                            type="text"
                                            value={symbol.name}
                                            onChange={(e) => handleNameChange(symbol.id, e.target.value)}
                                            className="font-medium bg-transparent border-b border-transparent hover:border-neutral-300 focus:border-bv-blue-500 focus:outline-none w-full mr-2 text-neutral-900"
                                            placeholder="Name this example..."
                                        />
                                        <button
                                            onClick={() => handleDeleteSymbol(symbol.id)}
                                            className="text-neutral-400 hover:text-red-500 transition-colors"
                                        >
                                            ×
                                        </button>
                                    </div>

                                    {/* Mini Preview */}
                                    <div className="mt-3 h-24 w-full relative bg-white border border-neutral-200 rounded overflow-hidden flex items-center justify-center">
                                        <div className="w-full h-full relative overflow-hidden">
                                            <img
                                                src={coverPageImage}
                                                className="absolute max-w-none mix-blend-multiply"
                                                style={{
                                                    width: `${scale * 100}%`,
                                                    left: '50%',
                                                    top: '50%',
                                                    transform: `translate(-${xOffset * scale}%, -${yOffset * scale}%)`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {symbols.length === 0 && (
                            <div className="text-center py-12 px-4 border-2 border-dashed border-neutral-200 rounded-lg">
                                <p className="text-neutral-500 text-sm">
                                    No examples defined. Draw a box on the image to add one.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
