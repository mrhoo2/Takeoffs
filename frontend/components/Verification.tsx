"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from 'next/dynamic';

// Dynamically import react-pdf components to avoid SSR issues
const Document = dynamic(() => import('react-pdf').then(mod => mod.Document), {
    ssr: false,
    loading: () => <div className="h-96 flex items-center justify-center text-neutral-400">Loading PDF viewer...</div>
});

const Page = dynamic(() => import('react-pdf').then(mod => mod.Page), {
    ssr: false,
});

// We need to set the worker source after the dynamic import
// This will be done in useEffect to ensure client-side execution

interface Location {
    type: string;
    tag: string;
    x?: number;
    y?: number;
    bbox?: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000 scale
    confidence: number;
    page?: number;
}

interface VerificationProps {
    planData: {
        pdf?: string; // Base64 encoded PDF
        images?: string[]; // Fallback for backward compatibility
        locations: string | Location[];
        pageCount?: number;
    };
    onReset: () => void;
}

export default function Verification({ planData, onReset }: VerificationProps) {
    const [pdfWorkerReady, setPdfWorkerReady] = useState(false);
    
    // Configure PDF.js worker on client side only
    useEffect(() => {
        const setupWorker = async () => {
            const pdfjs = await import('react-pdf').then(mod => mod.pdfjs);
            pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
            setPdfWorkerReady(true);
        };
        setupWorker();
    }, []);

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

    const [currentPage, setCurrentPage] = useState(1);
    const [zoom, setZoom] = useState(1);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [reviewStatus, setReviewStatus] = useState<Record<number, 'correct' | 'incorrect' | 'duplicate'>>({});
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawStart, setDrawStart] = useState<{ x: number, y: number } | null>(null);
    const [drawCurrent, setDrawCurrent] = useState<{ x: number, y: number } | null>(null);
    const [manualMode, setManualMode] = useState(false);
    const [pageWidth, setPageWidth] = useState(0);
    const [pageHeight, setPageHeight] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const totalPages = planData.pageCount || (planData.images?.length) || 1;
    
    // Convert base64 PDF to data URL
    const pdfDataUrl = planData.pdf ? `data:application/pdf;base64,${planData.pdf}` : null;

    // Filter locations for current page
    const currentLocations = locations.filter(loc => (loc.page || 1) === currentPage);

    const handleReview = (status: 'correct' | 'incorrect' | 'duplicate') => {
        if (selectedIndex === null) return;

        setReviewStatus(prev => ({
            ...prev,
            [selectedIndex]: status
        }));

        // Auto-advance
        const nextUnreviewed = locations.findIndex((loc, i) => i > selectedIndex && !reviewStatus[i]);
        if (nextUnreviewed !== -1) {
            setSelectedIndex(nextUnreviewed);
            // Navigate to that page if needed
            const nextPage = locations[nextUnreviewed].page || 1;
            if (nextPage !== currentPage) {
                setCurrentPage(nextPage);
            }
        }
    };

    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!manualMode) return;
        
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width * 1000;
        const y = (e.clientY - rect.top) / rect.height * 1000;
        
        if (!isDrawing) {
            setIsDrawing(true);
            setDrawStart({ x, y });
            setDrawCurrent({ x, y });
        }
    };

    const handleOverlayMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDrawing || !manualMode) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width * 1000;
        const y = (e.clientY - rect.top) / rect.height * 1000;
        setDrawCurrent({ x, y });
    };

    const handleOverlayUp = () => {
        if (!isDrawing || !manualMode || !drawStart || !drawCurrent) return;
        setIsDrawing(false);

        const ymin = Math.min(drawStart.y, drawCurrent.y);
        const xmin = Math.min(drawStart.x, drawCurrent.x);
        const ymax = Math.max(drawStart.y, drawCurrent.y);
        const xmax = Math.max(drawStart.x, drawCurrent.x);

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
                locations.push(newLoc);
                setSelectedIndex(locations.length - 1);
                setReviewStatus(prev => ({ ...prev, [locations.length - 1]: 'correct' }));
            }
        }
        setDrawStart(null);
        setDrawCurrent(null);
        setManualMode(false);
    };

    const selectedLocation = selectedIndex !== null ? locations[selectedIndex] : null;

    const onPageLoadSuccess = (page: any) => {
        const { width, height } = page;
        setPageWidth(width);
        setPageHeight(height);
    };

    // Function to select equipment and pan to its location
    const handleSelectEquipment = (globalIndex: number) => {
        const loc = locations[globalIndex];
        if (!loc) return;

        // Navigate to the correct page if needed
        const targetPage = loc.page || 1;
        if (targetPage !== currentPage) {
            setCurrentPage(targetPage);
        }

        setSelectedIndex(globalIndex);

        // Pan to the location if it has a bounding box
        if (loc.bbox && containerRef.current && pageWidth > 0 && pageHeight > 0) {
            // Calculate the center of the bounding box in pixels (accounting for zoom)
            const boxCenterX = ((loc.bbox[1] + loc.bbox[3]) / 2 / 1000) * pageWidth * zoom;
            const boxCenterY = ((loc.bbox[0] + loc.bbox[2]) / 2 / 1000) * pageHeight * zoom;

            // Get container dimensions
            const containerWidth = containerRef.current.clientWidth;
            const containerHeight = containerRef.current.clientHeight;

            // Calculate scroll position to center the box in the viewport
            const scrollLeft = boxCenterX - containerWidth / 2;
            const scrollTop = boxCenterY - containerHeight / 2;

            // Use setTimeout to allow page change to render first
            setTimeout(() => {
                containerRef.current?.scrollTo({
                    left: Math.max(0, scrollLeft),
                    top: Math.max(0, scrollTop),
                    behavior: 'smooth'
                });
            }, targetPage !== currentPage ? 100 : 0);
        }
    };

    return (
        <div className="w-full max-w-[1600px] mx-auto h-screen flex flex-col p-4">
            <div className="flex justify-between items-center mb-4 shrink-0">
                <h2 className="text-2xl font-bold text-neutral-900">Verify Equipment Locations</h2>
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1 bg-white border border-neutral-200 rounded-lg p-1 shadow-sm">
                        <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="px-2 py-1 hover:bg-neutral-50 rounded">-</button>
                        <span className="text-xs font-mono w-12 text-center">{(zoom * 100).toFixed(0)}%</span>
                        <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="px-2 py-1 hover:bg-neutral-50 rounded">+</button>
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
                    <div ref={containerRef} className="flex-1 overflow-auto relative" style={{ cursor: manualMode ? 'crosshair' : 'grab' }}>
                        <div
                            className="relative origin-top-left transition-transform duration-200 ease-out inline-block"
                            style={{ transform: `scale(${zoom})` }}
                        >
                            {pdfDataUrl && pdfWorkerReady ? (
                                <div className="relative">
                                    <Document
                                        file={pdfDataUrl}
                                        onLoadError={(error: Error) => console.error('Error loading PDF:', error)}
                                    >
                                        <Page
                                            pageNumber={currentPage}
                                            onLoadSuccess={onPageLoadSuccess}
                                            renderTextLayer={false}
                                            renderAnnotationLayer={false}
                                            // @ts-expect-error - react-pdf types may not include svg mode
                                            renderMode="svg"
                                        />
                                    </Document>
                                    
                                    {/* Overlay for bounding boxes and drawing */}
                                    {pageWidth > 0 && (
                                        <div
                                            className="absolute top-0 left-0"
                                            style={{ width: pageWidth, height: pageHeight }}
                                            onMouseDown={handleOverlayClick}
                                            onMouseMove={handleOverlayMove}
                                            onMouseUp={handleOverlayUp}
                                            onMouseLeave={handleOverlayUp}
                                        >
                                            {/* Existing Locations */}
                                            {currentLocations.map((loc, index) => {
                                                const globalIndex = locations.indexOf(loc);
                                                const status = reviewStatus[globalIndex];
                                                const isSelected = globalIndex === selectedIndex;

                                                if (status === 'incorrect') return null;
                                                if (!loc.bbox) return null;

                                                // Convert 0-1000 scale to pixel coordinates
                                                const style: React.CSSProperties = {
                                                    position: 'absolute',
                                                    top: (loc.bbox[0] / 1000) * pageHeight,
                                                    left: (loc.bbox[1] / 1000) * pageWidth,
                                                    height: ((loc.bbox[2] - loc.bbox[0]) / 1000) * pageHeight,
                                                    width: ((loc.bbox[3] - loc.bbox[1]) / 1000) * pageWidth,
                                                };

                                                return (
                                                    <div
                                                        key={globalIndex}
                                                        onClick={(e) => { e.stopPropagation(); setSelectedIndex(globalIndex); }}
                                                        className={`cursor-pointer transition-all duration-200 ${
                                                            isSelected ? 'border-2 border-bv-blue-600 bg-bv-blue-500/40 z-20' :
                                                            status === 'correct' ? 'border-2 border-green-500 bg-green-500/20' :
                                                            status === 'duplicate' ? 'border-2 border-yellow-500 bg-yellow-500/20' :
                                                            'border border-bv-blue-400 bg-bv-blue-500/10 hover:bg-bv-blue-500/20'
                                                        }`}
                                                        style={style}
                                                    >
                                                        {isSelected && (
                                                            <div 
                                                                className="absolute bg-bv-blue-600 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap z-30" 
                                                                style={{ 
                                                                    top: -24,
                                                                    left: 0,
                                                                    transform: `scale(${1 / zoom})`, 
                                                                    transformOrigin: 'bottom left' 
                                                                }}
                                                            >
                                                                {loc.tag}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}

                                            {/* Drawing Box */}
                                            {isDrawing && drawStart && drawCurrent && (
                                                <div
                                                    className="absolute border-2 border-bv-blue-600 bg-bv-blue-500/30 z-50 pointer-events-none"
                                                    style={{
                                                        top: (Math.min(drawStart.y, drawCurrent.y) / 1000) * pageHeight,
                                                        left: (Math.min(drawStart.x, drawCurrent.x) / 1000) * pageWidth,
                                                        height: (Math.abs(drawCurrent.y - drawStart.y) / 1000) * pageHeight,
                                                        width: (Math.abs(drawCurrent.x - drawStart.x) / 1000) * pageWidth,
                                                    }}
                                                />
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : pdfDataUrl && !pdfWorkerReady ? (
                                <div className="h-96 flex items-center justify-center text-neutral-400">Loading PDF viewer...</div>
                            ) : planData.images?.[currentPage - 1] ? (
                                // Fallback to image display for backward compatibility
                                <img 
                                    src={planData.images[currentPage - 1]} 
                                    alt={`Page ${currentPage}`} 
                                    className="w-full h-auto" 
                                    draggable={false} 
                                />
                            ) : (
                                <div className="h-96 flex items-center justify-center text-neutral-400">No content available</div>
                            )}
                        </div>
                    </div>

                    {/* Page Controls */}
                    {totalPages > 1 && (
                        <div className="p-2 bg-white border-t border-neutral-200 flex justify-center gap-4">
                            <button 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                                disabled={currentPage === 1} 
                                className="px-3 py-1 text-sm font-medium disabled:opacity-50 hover:bg-neutral-50 rounded"
                            >
                                Prev
                            </button>
                            <span className="text-sm text-neutral-600 self-center">Page {currentPage} of {totalPages}</span>
                            <button 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                                disabled={currentPage === totalPages} 
                                className="px-3 py-1 text-sm font-medium disabled:opacity-50 hover:bg-neutral-50 rounded"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>

                {/* Right Column: Review Panel */}
                <div className="w-80 bg-white border border-neutral-200 rounded-xl shadow-sm flex flex-col shrink-0">
                    <div className="p-4 border-b border-neutral-100">
                        <h3 className="font-bold text-neutral-900">Equipment on Page {currentPage}</h3>
                        <p className="text-xs text-neutral-500 mt-1">{currentLocations.length} item{currentLocations.length !== 1 ? 's' : ''} found</p>
                    </div>

                    {/* Equipment List */}
                    <div className="flex-1 overflow-y-auto min-h-0">
                        {currentLocations.length > 0 ? (
                            <div className="divide-y divide-neutral-100">
                                {currentLocations.map((loc) => {
                                    const globalIndex = locations.indexOf(loc);
                                    const status = reviewStatus[globalIndex];
                                    const isSelected = globalIndex === selectedIndex;

                                    return (
                                        <button
                                            key={globalIndex}
                                            onClick={() => handleSelectEquipment(globalIndex)}
                                            className={`w-full px-4 py-3 text-left transition-colors flex items-center gap-3 ${
                                                isSelected 
                                                    ? 'bg-bv-blue-50 border-l-4 border-l-bv-blue-600' 
                                                    : 'hover:bg-neutral-50 border-l-4 border-l-transparent'
                                            }`}
                                        >
                                            {/* Status indicator */}
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
                                                status === 'correct' ? 'bg-green-100 text-green-700' :
                                                status === 'incorrect' ? 'bg-red-100 text-red-700' :
                                                status === 'duplicate' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-neutral-100 text-neutral-400'
                                            }`}>
                                                {status === 'correct' ? '✓' :
                                                 status === 'incorrect' ? '✕' :
                                                 status === 'duplicate' ? '!' : '?'}
                                            </div>
                                            
                                            {/* Equipment info */}
                                            <div className="flex-1 min-w-0">
                                                <div className={`font-medium truncate ${isSelected ? 'text-bv-blue-700' : 'text-neutral-900'}`}>
                                                    {loc.tag}
                                                </div>
                                                <div className="text-xs text-neutral-400 truncate">
                                                    {loc.type} • {(loc.confidence * 100).toFixed(0)}%
                                                </div>
                                            </div>

                                            {/* Arrow indicator */}
                                            <span className={`text-neutral-300 ${isSelected ? 'text-bv-blue-400' : ''}`}>
                                                →
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="h-32 flex flex-col items-center justify-center text-neutral-400 text-center p-4">
                                <p>No equipment found<br />on this page</p>
                            </div>
                        )}
                    </div>

                    {/* Selected Item Details & Review Buttons */}
                    {selectedLocation && (
                        <div className="border-t border-neutral-200 p-4 bg-neutral-50">
                            <div className="mb-3">
                                <div className="text-xs text-neutral-500 mb-1">Selected</div>
                                <div className="font-bold text-neutral-900">{selectedLocation.tag}</div>
                                <div className="text-xs text-neutral-400">{selectedLocation.type}</div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    onClick={() => handleReview('correct')}
                                    className={`p-2 rounded-lg flex flex-col items-center gap-1 transition-colors ${reviewStatus[selectedIndex!] === 'correct' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-white border border-neutral-200 hover:bg-green-50 text-neutral-600 hover:text-green-600'}`}
                                >
                                    <span className="text-lg">✓</span>
                                    <span className="text-xs font-medium">Correct</span>
                                </button>
                                <button
                                    onClick={() => handleReview('duplicate')}
                                    className={`p-2 rounded-lg flex flex-col items-center gap-1 transition-colors ${reviewStatus[selectedIndex!] === 'duplicate' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 'bg-white border border-neutral-200 hover:bg-yellow-50 text-neutral-600 hover:text-yellow-600'}`}
                                >
                                    <span className="text-lg">⚠️</span>
                                    <span className="text-xs font-medium">Duplicate</span>
                                </button>
                                <button
                                    onClick={() => handleReview('incorrect')}
                                    className={`p-2 rounded-lg flex flex-col items-center gap-1 transition-colors ${reviewStatus[selectedIndex!] === 'incorrect' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-white border border-neutral-200 hover:bg-red-50 text-neutral-600 hover:text-red-600'}`}
                                >
                                    <span className="text-lg">✕</span>
                                    <span className="text-xs font-medium">Incorrect</span>
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="p-4 border-t border-neutral-100 bg-white">
                        <div className="flex justify-between text-sm text-neutral-600 mb-4">
                            <span>Progress</span>
                            <span className="font-medium">{Object.keys(reviewStatus).length} / {locations.length}</span>
                        </div>
                        <div className="w-full bg-neutral-200 rounded-full h-2 mb-4">
                            <div
                                className="bg-bv-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${locations.length > 0 ? (Object.keys(reviewStatus).length / locations.length) * 100 : 0}%` }}
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
