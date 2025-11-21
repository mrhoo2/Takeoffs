"use client";

import { useState } from "react";

interface Location {
    type: string;
    tag: string;
    x: number;
    y: number;
    confidence: number;
    page?: number; // Added page property
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
                <h2 className="text-2xl font-bold text-gray-800">Verify Equipment Locations</h2>
                <div className="flex items-center space-x-4">
                    <div className="text-sm text-gray-600">
                        Found {locations.length} items total
                    </div>

                    {/* Zoom Controls */}
                    <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
                        <button
                            onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                            className="px-2 py-1 hover:bg-white rounded text-gray-600"
                            title="Zoom Out"
                        >
                            -
                        </button>
                        <span className="text-xs font-medium w-12 text-center">{(zoom * 100).toFixed(0)}%</span>
                        <button
                            onClick={() => setZoom(z => Math.min(3, z + 0.25))}
                            className="px-2 py-1 hover:bg-white rounded text-gray-600"
                            title="Zoom In"
                        >
                            +
                        </button>
                        <button
                            onClick={() => setZoom(1)}
                            className="px-2 py-1 hover:bg-white rounded text-gray-600 text-xs"
                        >
                            Reset
                        </button>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 rounded hover:bg-white disabled:opacity-50 text-sm font-medium"
                            >
                                Prev
                            </button>
                            <span className="text-sm font-medium px-2">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 rounded hover:bg-white disabled:opacity-50 text-sm font-medium"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="relative border rounded-lg overflow-auto bg-gray-100 mb-8 h-[80vh]">
                <div
                    className="relative origin-top-left transition-transform duration-200 ease-out"
                    style={{
                        transform: `scale(${zoom})`,
                        width: '100%', // Base width
                    }}
                >
                    {planData.images && planData.images.length > 0 ? (
                        <img src={planData.images[currentPage - 1]} alt={`Floor Plan Page ${currentPage}`} className="w-full h-auto" />
                    ) : (
                        <div className="h-96 flex items-center justify-center text-gray-400">No image available</div>
                    )}

                    {currentLocations.map((loc, index) => ( // Changed to currentLocations
                        <div
                            key={index}
                            className="absolute transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                            style={{
                                left: `${loc.x}%`,
                                top: `${loc.y}%`,
                                // Counter-scale the markers so they stay the same visual size?
                                // Or let them scale? Let's let them scale for now so they stay precise relative to the map.
                                // Actually, if we zoom in, we usually want markers to stay readable size (not get huge).
                                // transform: `translate(-50%, -50%) scale(${1/zoom})` 
                            }}
                        >
                            <div
                                className="w-6 h-6 bg-red-500 rounded-full border-2 border-white shadow-md flex items-center justify-center text-white text-xs font-bold hover:bg-red-600 transition-colors"
                                style={{
                                    transform: `scale(${1 / zoom})`, // Keep marker size constant visually
                                    transformOrigin: 'center'
                                }}
                            >
                                {index + 1}
                            </div>

                            {/* Tooltip */}
                            <div
                                className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-white p-3 rounded shadow-lg text-xs hidden group-hover:block z-10"
                                style={{
                                    transform: `translateX(-50%) scale(${1 / zoom})`, // Keep tooltip constant size
                                    transformOrigin: 'bottom center'
                                }}
                            >
                                <p className="font-bold">{loc.type}</p>
                                <p>Tag: {loc.tag}</p>
                                <p>Confidence: {(loc.confidence * 100).toFixed(0)}%</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg border shadow-sm">
                <h3 className="text-lg font-semibold mb-4">Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 rounded border border-blue-100">
                        <p className="text-sm text-blue-600">Total Equipment Found</p>
                        <p className="text-2xl font-bold text-blue-800">{locations.length}</p>
                    </div>
                    {/* Add more stats here */}
                </div>

                <div className="mt-6 flex justify-end space-x-4">
                    <button
                        onClick={onReset}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                        Start Over
                    </button>
                    <button className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-md">
                        Export Report
                    </button>
                </div>
            </div>
        </div>
    );
}
