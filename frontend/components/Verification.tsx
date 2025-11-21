"use client";

import { useState } from "react";

interface Location {
    type: string;
    tag: string;
    x?: number; // Optional for backward compatibility
    y?: number; // Optional for backward compatibility
    bbox?: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000 scale
    confidence: number;
    page?: number;
}

interface VerificationProps {
    planData: {
        images: string[]; // Changed from 'image: string' to 'images: string[]'
        locations: string | Location[];
    };
    onReset: () => void;
}

export default function Verification({ planData, onReset }: VerificationProps) {
    let locations: Location[] = [];
    try {
        const potentialLocations = typeof planData.locations === 'string'
            ? JSON.parse(planData.locations)
            : planData.locations;

        if (Array.isArray(potentialLocations)) {
            locations = potentialLocations;
        } else {
            console.error("Parsed locations is not an array:", potentialLocations);
            locations = [];
        }
    } catch (e) {
        console.error("Failed to parse locations:", e);
        locations = [];
    }

    const [verifiedCount, setVerifiedCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [zoom, setZoom] = useState(1);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [reviewStatus, setReviewStatus] = useState<Record<number, 'correct' | 'incorrect' | 'duplicate'>>({});
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawStart, setDrawStart] = useState<{ x: number, y: number } | null>(null);
    const [drawCurrent, setDrawCurrent] = useState<{ x: number, y: number } | null>(null);
    const [manualMode, setManualMode] = useState(false);

    const totalPages = planData.images ? planData.images.length : 1;
    const currentImage = planData.images ? planData.images[currentPage - 1] : '';

    // Filter locations for current page
    const currentLocations = locations.filter(loc => (loc.page || 1) === currentPage);

    const handleReview = (status: 'correct' | 'incorrect' | 'duplicate') => {
        if (selectedIndex === null) return;

        setReviewStatus(prev => ({
            ...prev,
            [selectedIndex]: status
        }));

        // Auto-advance
        const nextIndex = currentLocations.findIndex((_, i) => i > currentLocations.indexOf(currentLocations[selectedIndex!]));
        if (nextIndex !== -1) {
            setSelectedIndex(currentLocations.indexOf(currentLocations[nextIndex]));
        }
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!manualMode) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width * 1000;
        const y = (e.clientY - rect.top) / rect.height * 1000;
        setIsDrawing(true);
        setDrawStart({ x, y });
        setDrawCurrent({ x, y });
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDrawing || !manualMode) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width * 1000;
        const y = (e.clientY - rect.top) / rect.height * 1000;
        setDrawCurrent({ x, y });
    };

    const handleMouseUp = () => {
        if (!isDrawing || !manualMode || !drawStart || !drawCurrent) return;
        setIsDrawing(false);

        // Create new location
        const ymin = Math.min(drawStart.y, drawCurrent.y);
        const xmin = Math.min(drawStart.x, drawCurrent.x);
        const ymax = Math.max(drawStart.y, drawCurrent.y);
        const xmax = Math.max(drawStart.x, drawCurrent.x);

        // Only add if box is big enough
        if (xmax - xmin > 10 && ymax - ymin > 10) {
            const tag = prompt("Enter equipment tag (e.g., WSHP-1):");
            if (tag) {
                const newLoc: Location = {
                    type: "Manual Entry",
                    tag: tag,
                    bbox: [ymin, xmin, ymax, xmax],
                    confidence: 1.0,
                    page: currentPage
                };
                locations.push(newLoc); // Mutating for simplicity in this demo, ideally use state
                setSelectedIndex(locations.length - 1);
                setReviewStatus(prev => ({ ...prev, [locations.length - 1]: 'correct' }));
            }
        }
        setDrawStart(null);
        setDrawCurrent(null);
        setManualMode(false);
    };

    const selectedLocation = selectedIndex !== null ? locations[selectedIndex] : null;

    return (
        <div className="w-full max-w-[1600px] mx-auto h-screen flex flex-col p-4">
            <div className="flex justify-between items-center mb-4 shrink-0">
                <h2 className="text-2xl font-bold text-neutral-900">Verify Equipment Locations</h2>
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1 bg-white border border-neutral-200 rounded-lg p-1 shadow-sm">
                        <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="px-2 py-1 hover:bg-neutral-50">-</button>
                        <span className="text-xs font-mono w-12 text-center">{(zoom * 100).toFixed(0)}%</span>
                        <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="px-2 py-1 hover:bg-neutral-50">+</button>
                    </div>
                    <button
                        onClick={() => setManualMode(!manualMode)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${manualMode ? 'bg-bv-blue-600 text-white' : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'}`}
                    >
                        {manualMode ? 'Cancel Manual Add' : '+ Add Missing'}
                    </button>
                </div>
            </div>

            <div className="flex flex-1 gap-6 min-h-0">
                {/* Left Column: Floor Plan */}
                <div className="flex-1 relative border border-neutral-200 rounded-xl overflow-hidden bg-neutral-100 shadow-inner flex flex-col">
                    <div className="flex-1 overflow-auto relative" style={{ cursor: manualMode ? 'crosshair' : 'grab' }}>
                        <div
                            className="relative origin-top-left transition-transform duration-200 ease-out"
                            style={{
                                transform: `scale(${zoom})`,
                                width: '100%',
                            }}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                        >
                            {currentImage ? (
                                <img src={currentImage} alt={`Page ${currentPage}`} className="w-full h-auto mix-blend-multiply opacity-95" draggable={false} />
                            ) : (
                                <div className="h-96 flex items-center justify-center text-neutral-400">No image available</div>
                            )}

                            {/* Existing Locations */}
                            {currentLocations.map((loc, index) => {
                                const globalIndex = locations.indexOf(loc);
                                const status = reviewStatus[globalIndex];
                                const isSelected = globalIndex === selectedIndex;

                                if (status === 'incorrect') return null;

                                let style: React.CSSProperties = {};
                                if (loc.bbox) {
                                    style = {
                                        top: `${loc.bbox[0] / 10}%`,
                                        left: `${loc.bbox[1] / 10}%`,
                                        height: `${(loc.bbox[2] - loc.bbox[0]) / 10}%`,
                                        width: `${(loc.bbox[3] - loc.bbox[1]) / 10}%`,
                                    };
                                }

                                return (
                                    <div
                                        key={globalIndex}
                                        onClick={(e) => { e.stopPropagation(); setSelectedIndex(globalIndex); }}
                                        className={`absolute cursor-pointer transition-all duration-200 ${isSelected ? 'border-2 border-bv-blue-600 bg-bv-blue-500/40 z-20' :
                                                status === 'correct' ? 'border-2 border-green-500 bg-green-500/20' :
                                                    status === 'duplicate' ? 'border-2 border-yellow-500 bg-yellow-500/20' :
                                                        'border border-bv-blue-400 bg-bv-blue-500/10 hover:bg-bv-blue-500/20'
                                            }`}
                                        style={style}
                                    >
                                        {isSelected && (
                                            <div className="absolute -top-6 left-0 bg-bv-blue-600 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap z-30" style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'bottom left' }}>
                                                {loc.tag}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Drawing Box */}
                            {isDrawing && drawStart && drawCurrent && (
                                <div
                                    className="absolute border-2 border-bv-blue-600 bg-bv-blue-500/30 z-50"
                                    style={{
                                        top: `${Math.min(drawStart.y, drawCurrent.y) / 10}%`,
                                        left: `${Math.min(drawStart.x, drawCurrent.x) / 10}%`,
                                        height: `${Math.abs(drawCurrent.y - drawStart.y) / 10}%`,
                                        width: `${Math.abs(drawCurrent.x - drawStart.x) / 10}%`,
                                    }}
                                />
                            )}
                        </div>
                    </div>

                    {/* Page Controls */}
                    {totalPages > 1 && (
                        <div className="p-2 bg-white border-t border-neutral-200 flex justify-center gap-4">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 text-sm font-medium disabled:opacity-50">Prev</button>
                            <span className="text-sm text-neutral-600 self-center">Page {currentPage} of {totalPages}</span>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 text-sm font-medium disabled:opacity-50">Next</button>
                        </div>
                    )}
                </div>

                {/* Right Column: Review Panel */}
                <div className="w-80 bg-white border border-neutral-200 rounded-xl shadow-sm flex flex-col shrink-0">
                    <div className="p-4 border-b border-neutral-100">
                        <h3 className="font-bold text-neutral-900">Review Panel</h3>
                        <p className="text-xs text-neutral-500 mt-1">Verify each detection</p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                        {selectedLocation ? (
                            <div className="space-y-6">
                                {/* Cropped View */}
                                <div className="aspect-square bg-neutral-100 rounded-lg border border-neutral-200 overflow-hidden relative">
                                    {selectedLocation.bbox && currentImage && (
                                        <div
                                            className="w-full h-full bg-no-repeat"
                                            style={{
                                                backgroundImage: `url(${currentImage})`,
                                                backgroundPosition: `${(selectedLocation.bbox[1] / 10) * (100 / ((selectedLocation.bbox[3] - selectedLocation.bbox[1]) / 10))}% ${(selectedLocation.bbox[0] / 10) * (100 / ((selectedLocation.bbox[2] - selectedLocation.bbox[0]) / 10))}%`,
                                                backgroundSize: `${10000 / (selectedLocation.bbox[3] - selectedLocation.bbox[1])}% ${10000 / (selectedLocation.bbox[2] - selectedLocation.bbox[0])}%`
                                            }}
                                        />
                                    )}
                                </div>

                                <div>
                                    <div className="text-sm text-neutral-500 mb-1">Tag</div>
                                    <div className="text-xl font-bold text-neutral-900">{selectedLocation.tag}</div>
                                    <div className="text-xs text-neutral-400 mt-1">{selectedLocation.type}</div>
                                    <div className="text-xs text-neutral-400">Confidence: {(selectedLocation.confidence * 100).toFixed(0)}%</div>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        onClick={() => handleReview('correct')}
                                        className={`p-2 rounded-lg flex flex-col items-center gap-1 transition-colors ${reviewStatus[selectedIndex!] === 'correct' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-neutral-50 hover:bg-green-50 text-neutral-600 hover:text-green-600'}`}
                                    >
                                        <span className="text-lg">✓</span>
                                        <span className="text-xs font-medium">Correct</span>
                                    </button>
                                    <button
                                        onClick={() => handleReview('duplicate')}
                                        className={`p-2 rounded-lg flex flex-col items-center gap-1 transition-colors ${reviewStatus[selectedIndex!] === 'duplicate' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 'bg-neutral-50 hover:bg-yellow-50 text-neutral-600 hover:text-yellow-600'}`}
                                    >
                                        <span className="text-lg">⚠️</span>
                                        <span className="text-xs font-medium">Duplicate</span>
                                    </button>
                                    <button
                                        onClick={() => handleReview('incorrect')}
                                        className={`p-2 rounded-lg flex flex-col items-center gap-1 transition-colors ${reviewStatus[selectedIndex!] === 'incorrect' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-neutral-50 hover:bg-red-50 text-neutral-600 hover:text-red-600'}`}
                                    >
                                        <span className="text-lg">✕</span>
                                        <span className="text-xs font-medium">Incorrect</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-neutral-400 text-center">
                                <p>Select an item on the plan<br />to review details</p>
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t border-neutral-100 bg-neutral-50">
                        <div className="flex justify-between text-sm text-neutral-600 mb-4">
                            <span>Progress</span>
                            <span className="font-medium">{Object.keys(reviewStatus).length} / {locations.length}</span>
                        </div>
                        <div className="w-full bg-neutral-200 rounded-full h-2 mb-4">
                            <div
                                className="bg-bv-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${(Object.keys(reviewStatus).length / locations.length) * 100}%` }}
                            />
                        </div>
                        <button onClick={onReset} className="w-full py-2 text-neutral-500 hover:text-neutral-900 text-sm font-medium">
                            Start Over
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
