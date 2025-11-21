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
    const [currentPage, setCurrentPage] = useState(1); // New state for current page
    const [zoom, setZoom] = useState(1);
    const totalPages = planData.images ? planData.images.length : 1; // Calculate total pages

    // Filter locations for current page
    // Note: Backend returns 1-indexed page numbers
    const currentLocations = locations.filter(loc => (loc.page || 1) === currentPage); // Filter locations

    return (
        <div className="w-full max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-neutral-900">Verify Equipment Locations</h2>
                <div className="flex items-center space-x-4">
                    <div className="text-sm text-neutral-600 font-medium">
                        Found {locations.length} items total
                    </div>

                    {/* Zoom Controls */}
                    <div className="flex items-center space-x-1 bg-white border border-neutral-200 rounded-lg p-1 shadow-sm">
                        <button
                            onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                            className="px-2.5 py-1 hover:bg-neutral-50 rounded text-neutral-600 font-medium transition-colors"
                            title="Zoom Out"
                        >
                            -
                        </button>
                        <span className="text-xs font-mono w-12 text-center text-neutral-500">{(zoom * 100).toFixed(0)}%</span>
                        <button
                            onClick={() => setZoom(z => Math.min(3, z + 0.25))}
                            className="px-2.5 py-1 hover:bg-neutral-50 rounded text-neutral-600 font-medium transition-colors"
                            title="Zoom In"
                        >
                            +
                        </button>
                        <div className="w-px h-4 bg-neutral-200 mx-1"></div>
                        <button
                            onClick={() => setZoom(1)}
                            className="px-2 py-1 hover:bg-neutral-50 rounded text-neutral-500 text-xs font-medium transition-colors"
                        >
                            Reset
                        </button>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center space-x-2 bg-white border border-neutral-200 rounded-lg p-1 shadow-sm">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 rounded hover:bg-neutral-50 disabled:opacity-50 text-sm font-medium text-neutral-700 transition-colors"
                            >
                                Prev
                            </button>
                            <span className="text-sm font-medium px-2 text-neutral-600">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 rounded hover:bg-neutral-50 disabled:opacity-50 text-sm font-medium text-neutral-700 transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="relative border border-neutral-200 rounded-xl overflow-auto bg-neutral-100 mb-8 h-[80vh] shadow-inner">
                <div
                    className="relative origin-top-left transition-transform duration-200 ease-out"
                    style={{
                        transform: `scale(${zoom})`,
                        width: '100%', // Base width
                    }}
                >
                    {planData.images && planData.images.length > 0 ? (
                        <img src={planData.images[currentPage - 1]} alt={`Floor Plan Page ${currentPage}`} className="w-full h-auto mix-blend-multiply opacity-95" />
                    ) : (
                        <div className="h-96 flex items-center justify-center text-neutral-400">No image available</div>
                    )}

                    {currentLocations.map((loc, index) => {
                        // Handle both old (x,y) and new (bbox) formats for backward compatibility during dev
                        let style: React.CSSProperties = {};
                        let isBbox = false;

                        if (loc.bbox) {
                            isBbox = true;
                            style = {
                                top: `${loc.bbox[0] / 10}%`,
                                left: `${loc.bbox[1] / 10}%`,
                                height: `${(loc.bbox[2] - loc.bbox[0]) / 10}%`,
                                width: `${(loc.bbox[3] - loc.bbox[1]) / 10}%`,
                            };
                        } else {
                            style = {
                                left: `${loc.x}%`,
                                top: `${loc.y}%`,
                                width: '20px',
                                height: '20px',
                                transform: 'translate(-50%, -50%)'
                            };
                        }

                        return (
                            <div
                                key={index}
                                className={`absolute group ${isBbox ? 'border-2 border-bv-blue-500 bg-bv-blue-500/20' : ''}`}
                                style={style}
                            >
                                {/* Tag - Positioned top-right of the box, scale inverted to maintain size */}
                                <div
                                    className="absolute bg-bv-blue-600 text-white text-xs font-bold px-2 py-1 rounded shadow-md z-10 whitespace-nowrap hover:bg-bv-blue-700 transition-colors cursor-pointer flex items-center justify-center"
                                    style={{
                                        // Position relative to the box's top-right corner
                                        // We use negative margins or translations that scale inversely with zoom
                                        // actually, the easiest way is to position it at top: 0, right: 0 of the box
                                        // and then translate it out by a fixed pixel amount (which needs to be scaled by 1/zoom)
                                        top: 0,
                                        right: 0,
                                        transform: `translate(100%, -100%) scale(${1 / zoom})`,
                                        transformOrigin: 'bottom left'
                                    }}
                                >
                                    {loc.tag}
                                </div>

                                {/* Tooltip */}
                                <div
                                    className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-white p-3 rounded-lg shadow-xl border border-neutral-100 text-xs hidden group-hover:block z-20"
                                    style={{
                                        transform: `translateX(-50%) scale(${1 / zoom})`,
                                        transformOrigin: 'bottom center'
                                    }}
                                >
                                    <p className="font-bold text-neutral-900 text-sm mb-1">{loc.type}</p>
                                    <div className="space-y-1 text-neutral-600">
                                        <p>Tag: <span className="font-mono text-neutral-900">{loc.tag}</span></p>
                                        <div className="flex items-center justify-between">
                                            <span>Confidence:</span>
                                            <span className={`font-medium ${loc.confidence > 0.8 ? 'text-green-600' : 'text-yellow-600'}`}>
                                                {(loc.confidence * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
                <h3 className="text-lg font-bold mb-4 text-neutral-900">Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-bv-blue-50 rounded-lg border border-bv-blue-100">
                        <p className="text-sm font-medium text-bv-blue-600">Total Equipment Found</p>
                        <p className="text-3xl font-bold text-bv-blue-800 mt-1">{locations.length}</p>
                    </div>
                    {/* Add more stats here */}
                </div>

                <div className="mt-8 flex justify-end space-x-4 pt-6 border-t border-neutral-100">
                    <button
                        onClick={onReset}
                        className="px-6 py-2.5 text-neutral-600 hover:text-neutral-900 font-medium transition-colors"
                    >
                        Start Over
                    </button>
                    <button className="bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 px-8 rounded-lg shadow-sm transition-all">
                        Export Report
                    </button>
                </div>
            </div>
        </div>
    );
}
