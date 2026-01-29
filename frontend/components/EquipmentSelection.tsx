"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Equipment {
    type: string;
    tag_prefix: string;
    is_typical: boolean;
    tags: string[];
    page?: number;
    bbox?: [number, number, number, number]; // [x_min, y_min, x_max, y_max] 0-1000 scale (standard format)
}

interface EquipmentSelectionProps {
    equipmentList: Equipment[];
    images?: string[]; // Base64 images of schedule pages
    onConfirm: (selected: Equipment[]) => void;
}

// Fixed ImageWithBbox that properly accounts for object-contain letterboxing
function ImageWithBbox({ 
    imageSrc, 
    bbox, 
    pageNum, 
    equipmentType 
}: { 
    imageSrc: string; 
    bbox: [number, number, number, number]; 
    pageNum: number;
    equipmentType: string;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [imageLayout, setImageLayout] = useState<{
        offsetX: number;
        offsetY: number;
        displayWidth: number;
        displayHeight: number;
    } | null>(null);

    // Calculate where the image is actually displayed within the container (accounting for object-contain)
    const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        const container = containerRef.current;
        if (!container) return;

        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const imgNaturalWidth = img.naturalWidth;
        const imgNaturalHeight = img.naturalHeight;

        // Calculate how object-contain scales the image
        const containerRatio = containerWidth / containerHeight;
        const imageRatio = imgNaturalWidth / imgNaturalHeight;

        let displayWidth: number;
        let displayHeight: number;
        let offsetX: number;
        let offsetY: number;

        if (imageRatio > containerRatio) {
            // Image is wider - fits to container width, letterboxed top/bottom
            displayWidth = containerWidth;
            displayHeight = containerWidth / imageRatio;
            offsetX = 0;
            offsetY = (containerHeight - displayHeight) / 2;
        } else {
            // Image is taller - fits to container height, letterboxed left/right
            displayHeight = containerHeight;
            displayWidth = containerHeight * imageRatio;
            offsetX = (containerWidth - displayWidth) / 2;
            offsetY = 0;
        }

        setImageLayout({ offsetX, offsetY, displayWidth, displayHeight });
        
        console.log(`ImageWithBbox layout for ${equipmentType}:`, {
            container: { containerWidth, containerHeight },
            image: { imgNaturalWidth, imgNaturalHeight },
            display: { displayWidth, displayHeight, offsetX, offsetY }
        });
    }, [equipmentType]);

    // bbox format from Gemini: [x_min, y_min, x_max, y_max] in 0-1000 scale
    const [xmin, ymin, xmax, ymax] = bbox;

    // Calculate bbox position relative to the displayed image area
    let bboxStyle: React.CSSProperties = { display: 'none' };
    
    if (imageLayout) {
        const { offsetX, offsetY, displayWidth, displayHeight } = imageLayout;
        
        // Convert 0-1000 scale to pixels relative to displayed image
        const left = offsetX + (xmin / 1000) * displayWidth;
        const top = offsetY + (ymin / 1000) * displayHeight;
        const width = ((xmax - xmin) / 1000) * displayWidth;
        const height = ((ymax - ymin) / 1000) * displayHeight;
        
        bboxStyle = {
            position: 'absolute',
            left: `${left}px`,
            top: `${top}px`,
            width: `${width}px`,
            height: `${height}px`,
        };
        
        console.log(`Bbox position for ${equipmentType}:`, {
            raw: bbox,
            pixels: { left, top, width, height }
        });
    }

    return (
        <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-neutral-50">
            <div className="absolute text-xs bg-neutral-900/80 text-white px-2 py-1 top-0 left-0 z-20 rounded-br">
                Page {pageNum} | [{xmin},{ymin},{xmax},{ymax}]
            </div>
            
            {/* Full page image scaled to fit with object-contain */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={imageSrc}
                alt="Schedule Page"
                className="w-full h-full object-contain"
                onLoad={handleImageLoad}
            />
            
            {/* Bbox overlay positioned relative to actual image display area */}
            {imageLayout && (
                <div
                    className="border-2 border-red-500 bg-red-500/20 pointer-events-none z-10"
                    style={bboxStyle}
                />
            )}
        </div>
    );
}

export default function EquipmentSelection({ equipmentList, images, onConfirm }: EquipmentSelectionProps) {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    
    // Debug logging
    console.log('EquipmentSelection - images prop:', {
        exists: !!images,
        length: images?.length || 0,
        firstImagePreview: images?.[0] ? images[0].substring(0, 50) + '...' : 'none'
    });
    console.log('EquipmentSelection - equipmentList:', equipmentList);

    const toggleSelection = (type: string) => {
        const newSelected = new Set(selected);
        if (newSelected.has(type)) {
            newSelected.delete(type);
        } else {
            newSelected.add(type);
        }
        setSelected(newSelected);
    };

    const handleConfirm = () => {
        const selectedEquipment = parsedList.filter(e => selected.has(e.type));
        onConfirm(selectedEquipment);
    };

    // Parse equipmentList if it's a string (JSON string from backend)
    let parsedList: Equipment[] = [];
    try {
        const potentialList = typeof equipmentList === 'string' ? JSON.parse(equipmentList) : equipmentList;
        if (Array.isArray(potentialList)) {
            parsedList = potentialList;
        } else {
            console.error("Parsed equipment list is not an array:", potentialList);
            parsedList = [];
        }
    } catch (e) {
        console.error("Failed to parse equipment list:", e);
        parsedList = [];
    }

    // Log raw Gemini bbox data for each equipment item
    console.log('=== RAW GEMINI BBOX DATA ===');
    parsedList.forEach((item, idx) => {
        console.log(`[${idx}] ${item.type}:`, {
            page: item.page,
            bbox: item.bbox,
            bbox_interpretation: item.bbox ? `x: ${item.bbox[0]}-${item.bbox[2]}, y: ${item.bbox[1]}-${item.bbox[3]}` : 'none'
        });
    });
    console.log('=== END BBOX DATA ===');

    return (
        <div className="w-full max-w-6xl mx-auto pb-12">
            <h2 className="text-2xl font-bold mb-6 text-neutral-900">Select Equipment to Locate</h2>
            <div className="grid grid-cols-1 gap-6 mb-8">
                {parsedList.map((item: Equipment, index: number) => (
                    <div
                        key={index}
                        className={`p-5 border rounded-xl transition-all flex flex-col md:flex-row gap-6 ${selected.has(item.type)
                            ? "border-bv-blue-500 bg-bv-blue-50 ring-1 ring-bv-blue-200 shadow-sm"
                            : "border-neutral-200 bg-white hover:border-bv-blue-300 hover:shadow-sm"
                            }`}
                    >
                        <div className="flex-1 cursor-pointer" onClick={() => toggleSelection(item.type)}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-neutral-900 text-lg">{item.type}</h3>
                                    <p className="text-sm text-neutral-500 mt-1">Prefix: <span className="font-mono text-neutral-700 bg-neutral-100 px-1.5 py-0.5 rounded">{item.tag_prefix}</span></p>
                                </div>
                                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${item.is_typical ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"
                                    }`}>
                                    {item.is_typical ? "Typical" : "Instance"}
                                </span>
                            </div>
                            <div className="mt-3 text-sm text-neutral-600">
                                <span className="font-medium text-neutral-900">Examples:</span> {item.tags.join(", ")}
                            </div>
                        </div>

                        {/* Visual Verification Snippet - show if we have images and bbox */}
                        {images && images.length > 0 && item.bbox && item.bbox.length === 4 ? (
                            <div className="w-full md:w-96 h-48 relative border border-neutral-200 bg-neutral-100 rounded-lg overflow-hidden flex-shrink-0">
                                <ImageWithBbox
                                    imageSrc={images[(item.page || 1) - 1] || images[0]}
                                    bbox={item.bbox}
                                    pageNum={images[(item.page || 1) - 1] ? (item.page || 1) : 1}
                                    equipmentType={item.type}
                                />
                            </div>
                        ) : (
                            <div className="w-full md:w-96 h-48 relative border border-neutral-200 bg-neutral-100 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center text-sm text-neutral-500">
                                {!images || images.length === 0 ? (
                                    <span>No images available</span>
                                ) : !item.bbox ? (
                                    <span>No bbox data</span>
                                ) : (
                                    <span>Invalid bbox: {JSON.stringify(item.bbox)}</span>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="flex justify-end">
                <button
                    onClick={handleConfirm}
                    disabled={selected.size === 0}
                    className="bg-bv-blue-600 hover:bg-bv-blue-700 text-white font-medium py-2.5 px-8 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                >
                    Continue to Floor Plans
                </button>
            </div>
        </div>
    );
}
