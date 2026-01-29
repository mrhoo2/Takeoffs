"use client";

import { useState, useRef, useEffect, useMemo, useCallback, memo } from "react";
import dynamic from 'next/dynamic';
import { SniperDot } from './SniperDot';

// Dynamically import the SVG viewer to avoid SSR issues
const SvgPageViewer = dynamic(() => import('./PdfSvgViewer'), {
    ssr: false,
    loading: () => <div className="h-96 flex items-center justify-center text-neutral-400">Loading viewer...</div>
});

interface Location {
    type: string;
    tag: string;
    x?: number;
    y?: number;
    bbox?: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000 scale
    confidence: number;
    page?: number;
}

interface PageInfo {
    width: number;
    height: number;
}

interface VerificationProps {
    planData: {
        pdfId?: string; // PDF ID for fetching SVG pages on-demand
        pageInfo?: PageInfo[]; // Page dimensions
        svgPages?: { svg: string; width: number; height: number }[]; // Legacy direct SVG
        pdf?: string; // Legacy: Base64 encoded PDF
        images?: string[]; // Fallback for backward compatibility
        locations: string | Location[];
        pageCount?: number;
        modelUsed?: string;
    };
    onReset: () => void;
    onRerun?: (model?: "flash" | "pro") => void;
    onStatusChange?: (status: Record<number, 'correct' | 'incorrect' | 'duplicate' | 'manual'>) => void;
    onAddLocation?: (location: Location) => void;
}

// Helper function to map review status to sniper dot status
const mapToSniperStatus = (reviewStatus?: 'correct' | 'incorrect' | 'duplicate' | 'manual'): 'pending' | 'confirmed' | 'declined' | 'duplicate' | 'manual' => {
    if (!reviewStatus) return 'pending';
    if (reviewStatus === 'correct') return 'confirmed';
    if (reviewStatus === 'incorrect') return 'declined';
    if (reviewStatus === 'manual') return 'manual';
    return 'duplicate';
};

// Memoized sniper dot wrapper component
const SniperDotWrapper = memo(function SniperDotWrapper({
    loc,
    globalIndex,
    isSelected,
    status,
    svgW,
    svgH,
    onSelect,
}: {
    loc: Location;
    globalIndex: number;
    isSelected: boolean;
    status?: 'correct' | 'incorrect' | 'duplicate' | 'manual';
    svgW: number;
    svgH: number;
    onSelect: (index: number) => void;
}) {
    if (!loc.bbox) return null;

    // Calculate center point from bbox
    const centerX = ((loc.bbox[1] + loc.bbox[3]) / 2 / 1000) * svgW;
    const centerY = ((loc.bbox[0] + loc.bbox[2]) / 2 / 1000) * svgH;
    
    const sniperStatus = mapToSniperStatus(status);

    return (
        <div 
            onClick={(e) => { e.stopPropagation(); onSelect(globalIndex); }}
            className="cursor-pointer"
        >
            <SniperDot
                x={centerX}
                y={centerY}
                isActive={isSelected}
                status={sniperStatus}
            />
            {/* Label for selected item - only render if selected */}
            {isSelected && (
                <div 
                    className="absolute bg-bv-blue-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none z-[110] shadow-lg" 
                    style={{ 
                        left: centerX,
                        top: centerY - 30,
                        transform: 'translateX(-50%)',
                        // Optimization: Avoid layout shifts
                        contain: 'content',
                    }}
                >
                    {loc.tag}
                </div>
            )}
        </div>
    );
});

// Memoized equipment list item
const EquipmentListItem = memo(function EquipmentListItem({
    loc,
    globalIndex,
    isSelected,
    status,
    onSelect,
}: {
    loc: Location;
    globalIndex: number;
    isSelected: boolean;
    status?: 'correct' | 'incorrect' | 'duplicate' | 'manual';
    onSelect: (index: number) => void;
}) {
    return (
        <button
            onClick={() => onSelect(globalIndex)}
            className={`w-full px-4 py-3 text-left flex items-center gap-3 ${
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
                status === 'manual' ? 'bg-purple-100 text-purple-700' :
                'bg-neutral-100 text-neutral-400'
            }`}>
                {status === 'correct' ? '✓' :
                 status === 'incorrect' ? '✕' :
                 status === 'duplicate' ? '!' :
                 status === 'manual' ? '+' : '?'}
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
});

export default function Verification({ planData, onReset, onRerun, onStatusChange, onAddLocation }: VerificationProps) {
    // Use images for background if available for better performance
    // If not explicitly provided, we could fall back to SVG
    const useImageBackground = true; 

    // Parse locations once with useMemo
    const locations = useMemo(() => {
        try {
            const potentialLocations = typeof planData.locations === 'string'
                ? JSON.parse(planData.locations)
                : planData.locations;

            if (Array.isArray(potentialLocations)) {
                return potentialLocations as Location[];
            } else {
                console.error("Parsed locations is not an array:", potentialLocations);
                return [];
            }
        } catch (e) {
            console.error("Failed to parse locations:", e);
            return [];
        }
    }, [planData.locations]);

    // Pre-compute location to index map to avoid O(n) indexOf calls
    const locationIndexMap = useMemo(() => {
        const map = new Map<Location, number>();
        locations.forEach((loc, index) => map.set(loc, index));
        return map;
    }, [locations]);

    const [currentPage, setCurrentPage] = useState(1);
    const [zoom, setZoom] = useState(1);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [reviewStatus, setReviewStatus] = useState<Record<number, 'correct' | 'incorrect' | 'duplicate' | 'manual'>>({});

    // Pass status up to parent
    useEffect(() => {
        if (onStatusChange) {
            onStatusChange(reviewStatus);
        }
    }, [reviewStatus, onStatusChange]);
    const [manualMode, setManualMode] = useState(false);
    const [pageWidth, setPageWidth] = useState(0);
    const [pageHeight, setPageHeight] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const sidebarListRef = useRef<HTMLDivElement>(null);

    const [svgContent, setSvgContent] = useState<string | null>(null);
    const [svgLoading, setSvgLoading] = useState(false);
    
    // Track actual image dimensions (natural size of loaded image)
    const [actualImageDimensions, setActualImageDimensions] = useState<{ width: number; height: number } | null>(null);

    const totalPages = planData.pageCount || planData.pageInfo?.length || planData.svgPages?.length || (planData.images?.length) || 1;
    
    // Get current page dimensions from pageInfo (fallback)
    const currentPageInfo = planData.pageInfo?.[currentPage - 1] || planData.svgPages?.[currentPage - 1];
    
    // Use actual image dimensions for the overlay (more accurate for coordinate alignment)
    const displayDimensions = actualImageDimensions || currentPageInfo || { width: 800, height: 600 };
    
    // Fetch SVG content when page changes
    useEffect(() => {
        const fetchSvg = async () => {
            // Update page dimensions first
            if (currentPageInfo) {
                setPageWidth(currentPageInfo.width);
                setPageHeight(currentPageInfo.height);
            }

            if (planData.pdfId) {
                setSvgLoading(true);
                setSvgContent(null);
                try {
                    const response = await fetch(`/api/pdf/${planData.pdfId}/page/${currentPage}/svg`);
                    if (response.ok) {
                        const svg = await response.text();
                        setSvgContent(svg);
                        
                        // Update dimensions from headers if available
                        const width = response.headers.get('X-Page-Width');
                        const height = response.headers.get('X-Page-Height');
                        if (width && height) {
                            setPageWidth(parseFloat(width));
                            setPageHeight(parseFloat(height));
                        }
                    } else {
                        console.error('Failed to fetch SVG page');
                    }
                } catch (error) {
                    console.error('Error fetching SVG:', error);
                } finally {
                    setSvgLoading(false);
                }
            } else if (planData.svgPages?.[currentPage - 1]) {
                // Legacy: use embedded SVG data
                setSvgContent(planData.svgPages[currentPage - 1].svg);
                setPageWidth(planData.svgPages[currentPage - 1].width);
                setPageHeight(planData.svgPages[currentPage - 1].height);
            }
        };
        
        fetchSvg();
    }, [planData.pdfId, planData.svgPages, currentPage]);

    // Filter locations for current page - memoized to prevent recalculation
    const currentLocations = useMemo(() => {
        return locations.filter(loc => (loc.page || 1) === currentPage);
    }, [locations, currentPage]);

    // Scroll sidebar to selected item
    useEffect(() => {
        if (selectedIndex !== null && sidebarListRef.current) {
            const selectedElement = sidebarListRef.current.querySelector(`[data-index="${selectedIndex}"]`);
            if (selectedElement) {
                selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }, [selectedIndex]);

    // Memoized handler for selecting equipment
    const handleSelectEquipmentCallback = useCallback((globalIndex: number) => {
        const loc = locations[globalIndex];
        if (!loc) return;

        // Navigate to the correct page if needed
        const targetPage = loc.page || 1;
        
        // Update selection first for immediate UI feedback
        setSelectedIndex(globalIndex);

        if (targetPage !== currentPage) {
            setCurrentPage(targetPage);
        }

        // Pan to the location if it has a bounding box
        if (loc.bbox && containerRef.current && pageWidth > 0 && pageHeight > 0) {
            const boxCenterX = ((loc.bbox[1] + loc.bbox[3]) / 2 / 1000) * pageWidth * zoom;
            const boxCenterY = ((loc.bbox[0] + loc.bbox[2]) / 2 / 1000) * pageHeight * zoom;
            const containerWidth = containerRef.current.clientWidth;
            const containerHeight = containerRef.current.clientHeight;
            const scrollLeft = boxCenterX - containerWidth / 2;
            const scrollTop = boxCenterY - containerHeight / 2;

            // Use requestAnimationFrame for smoother UI response
            requestAnimationFrame(() => {
                containerRef.current?.scrollTo({
                    left: Math.max(0, scrollLeft),
                    top: Math.max(0, scrollTop),
                    behavior: targetPage !== currentPage ? 'auto' : 'smooth'
                });
            });
        }
    }, [locations, currentPage, pageWidth, pageHeight, zoom]);

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

    // Click-to-add handler for manual mode
    const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!manualMode) return;
        
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width * 1000;
        const y = (e.clientY - rect.top) / rect.height * 1000;
        
        // Prompt for equipment tag
        const tag = prompt("Enter equipment tag (e.g., WSHP-1):");
        if (tag) {
            // Create a small bbox around the clicked point (±5 units)
            const newLoc: Location = {
                type: "Manual Entry",
                tag: tag,
                bbox: [y - 5, x - 5, y + 5, x + 5],
                confidence: 1.0,
                page: currentPage
            };
            
            // Call parent callback to add the new location
            if (onAddLocation) {
                onAddLocation(newLoc);
                // The new index will be locations.length (before the addition)
                const newIndex = locations.length;
                // Set status to 'manual' for the new item
                setReviewStatus(prev => ({
                    ...prev,
                    [newIndex]: 'manual'
                }));
                // Select the newly added item after a brief delay to allow state to update
                setTimeout(() => {
                    setSelectedIndex(newIndex);
                }, 50);
            }
        }
        setManualMode(false);
    }, [manualMode, currentPage, onAddLocation, locations.length]);

    const selectedLocation = selectedIndex !== null ? locations[selectedIndex] : null;

    const onPageLoadSuccess = useCallback((dimensions: { width: number; height: number }) => {
        setPageWidth(dimensions.width);
        setPageHeight(dimensions.height);
    }, []);

    return (
        <div className="w-full max-w-[1600px] mx-auto h-screen flex flex-col p-4">
            <div className="flex justify-between items-center mb-4 shrink-0">
                <h2 className="text-2xl font-bold text-neutral-900">Verify Equipment Locations</h2>
                <div className="flex items-center space-x-4">
                    {onRerun && (
                        <div className="flex gap-2">
                            {planData.modelUsed !== 'pro' && (
                                <button
                                    onClick={() => onRerun('pro')}
                                    className="px-4 py-2 bg-bv-blue-600 text-white hover:bg-bv-blue-700 rounded-lg font-medium transition-all shadow-sm hover:shadow-md border border-bv-blue-700 flex items-center gap-2"
                                >
                                    <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">Pro</span>
                                    Upgrade Accuracy
                                </button>
                            )}
                            <button
                                onClick={() => onRerun()}
                                className="px-4 py-2 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg font-medium transition-colors border border-purple-200"
                            >
                                Re-run {planData.modelUsed === 'pro' ? '(Pro)' : '(Flash)'}
                            </button>
                        </div>
                    )}
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
                            className="relative origin-top-left inline-block"
                            style={{ 
                                transform: `scale(${zoom})`,
                                // GPU acceleration for smooth zooming
                                willChange: 'transform',
                                backfaceVisibility: 'hidden',
                            }}
                        >
                            {svgLoading ? (
                                <div className="h-96 flex items-center justify-center text-neutral-400">Loading page...</div>
                            ) : (svgContent || planData.images?.[currentPage - 1]) && currentPageInfo ? (
                                <div className="relative">
                                    {/* Hybrid Viewer: Use high-res image for background if SVG is slow or if we prefer images */}
                                    {useImageBackground && planData.images?.[currentPage - 1] ? (
                                        <img 
                                            src={planData.images[currentPage - 1]} 
                                            alt={`Page ${currentPage}`}
                                            className="block"
                                            style={{
                                                // Explicitly set dimensions via style to override any CSS max-width constraints
                                                width: currentPageInfo.width,
                                                height: currentPageInfo.height,
                                                maxWidth: 'none', // Override any global max-width: 100%
                                                // Prevent the image from being draggable to allow panning the container
                                                userSelect: 'none',
                                                pointerEvents: 'none'
                                            }}
                                            onLoad={(e) => {
                                                const img = e.currentTarget;
                                                console.log(`Image loaded: displayed at ${img.clientWidth} x ${img.clientHeight}, natural: ${img.naturalWidth} x ${img.naturalHeight}, pageInfo: ${currentPageInfo?.width} x ${currentPageInfo?.height}`);
                                                onPageLoadSuccess({ width: currentPageInfo.width, height: currentPageInfo.height });
                                            }}
                                        />
                                    ) : svgContent ? (
                                        <SvgPageViewer
                                            svgContent={svgContent}
                                            width={currentPageInfo.width}
                                            height={currentPageInfo.height}
                                            onLoad={onPageLoadSuccess}
                                        />
                                    ) : null}
                                    
                                    {/* Overlay for sniper dots - must match image displayed dimensions exactly */}
                                    {currentPageInfo && currentPageInfo.width > 0 && (
                                        <div
                                            className="absolute top-0 left-0"
                                            style={{ width: currentPageInfo.width, height: currentPageInfo.height }}
                                            onClick={handleOverlayClick}
                                        >
                                            {/* Existing Locations - using memoized SniperDotWrapper component */}
                                            {currentLocations.map((loc) => {
                                                const globalIndex = locationIndexMap.get(loc) ?? -1;
                                                return (
                                                    <SniperDotWrapper
                                                        key={globalIndex}
                                                        loc={loc}
                                                        globalIndex={globalIndex}
                                                        isSelected={globalIndex === selectedIndex}
                                                        status={reviewStatus[globalIndex]}
                                                        svgW={currentPageInfo.width}
                                                        svgH={currentPageInfo.height}
                                                        onSelect={setSelectedIndex}
                                                    />
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
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

                    {/* Equipment List - using memoized EquipmentListItem component */}
                    <div 
                        ref={sidebarListRef}
                        className="flex-1 overflow-y-auto min-h-0 overscroll-contain"
                        style={{ 
                            WebkitOverflowScrolling: 'touch',
                            scrollBehavior: 'smooth',
                        }}
                    >
                        {currentLocations.length > 0 ? (
                            <div className="divide-y divide-neutral-100">
                                {currentLocations.map((loc) => {
                                    const globalIndex = locationIndexMap.get(loc) ?? -1;
                                    return (
                                        <div key={globalIndex} data-index={globalIndex}>
                                            <EquipmentListItem
                                                loc={loc}
                                                globalIndex={globalIndex}
                                                isSelected={globalIndex === selectedIndex}
                                                status={reviewStatus[globalIndex]}
                                                onSelect={handleSelectEquipmentCallback}
                                            />
                                        </div>
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
