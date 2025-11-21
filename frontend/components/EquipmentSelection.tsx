"use client";

import { useState } from "react";

interface Equipment {
    type: string;
    tag_prefix: string;
    is_typical: boolean;
    tags: string[];
    page?: number;
    bbox?: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000 scale
}

interface EquipmentSelectionProps {
    equipmentList: Equipment[];
    images?: string[]; // Base64 images of schedule pages
    onConfirm: (selected: Equipment[]) => void;
}

export default function EquipmentSelection({ equipmentList, images, onConfirm }: EquipmentSelectionProps) {
    const [selected, setSelected] = useState<Set<string>>(new Set());

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

    return (
        <div className="w-full max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Select Equipment to Locate</h2>
            <div className="grid grid-cols-1 gap-6 mb-8">
                {parsedList.map((item: Equipment, index: number) => (
                    <div
                        key={index}
                        className={`p-4 border rounded-lg transition-all flex flex-col md:flex-row gap-4 ${selected.has(item.type)
                            ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                            : "border-gray-200 hover:border-blue-300"
                            }`}
                    >
                        <div className="flex-1 cursor-pointer" onClick={() => toggleSelection(item.type)}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-semibold text-gray-900 text-lg">{item.type}</h3>
                                    <p className="text-sm text-gray-500">Prefix: {item.tag_prefix}</p>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded-full ${item.is_typical ? "bg-purple-100 text-purple-800" : "bg-green-100 text-green-800"
                                    }`}>
                                    {item.is_typical ? "Typical" : "Instance"}
                                </span>
                            </div>
                            <div className="mt-2 text-sm text-gray-600">
                                Examples: {item.tags.join(", ")}
                            </div>
                        </div>

                        {/* Visual Verification Snippet */}
                        {images && item.page && item.bbox && (
                            <div className="w-full md:w-96 h-40 relative border border-gray-300 bg-gray-100 rounded overflow-hidden flex-shrink-0 group-hover:border-blue-300 transition-colors">
                                <div className="absolute text-xs bg-black/60 text-white px-2 py-1 top-0 left-0 z-20 rounded-br">
                                    Page {item.page}
                                </div>

                                {/* 
                        Implementation:
                        We use a container with overflow hidden.
                        Inside, we place the image.
                        We scale the image up (e.g. 300% width) to make text readable.
                        We position the image so that the bbox is centered or visible.
                        
                        bbox coordinates are 0-1000 relative to the original page.
                        
                        If image width is 300% of container:
                        Scale factor S = 3.
                        
                        Target X (in original 0-1000) = item.bbox[1]
                        Target Y (in original 0-1000) = item.bbox[0]
                        
                        Left position = -1 * (Target X / 1000) * (Container Width * S)
                        But we don't know container width in pixels easily in CSS.
                        
                        Using percentages:
                        Left = -1 * (Target X / 1000) * 300%
                        Top = -1 * (Target Y / 1000) * 300% * AspectRatio?
                        
                        Let's try a simpler approach:
                        background-image with background-size and background-position.
                        
                        background-size: 300% auto.
                        background-position: x% y%.
                        
                        In CSS background-position percentages:
                        0% = left edge of image aligned with left edge of container.
                        100% = right edge of image aligned with right edge of container.
                        
                        We want to align the bbox left edge (bbox[1]) with the container left edge (mostly).
                        
                        Let's try the transform approach again, it's more robust for "cropping".
                    */}
                                <div
                                    className="absolute origin-top-left"
                                    style={{
                                        width: '300%', // Zoom factor
                                        top: `calc(-${item.bbox[0] / 10}% * 3 + 20px)`, // Position bbox y at top (plus padding)
                                        left: `calc(-${item.bbox[1] / 10}% * 3 + 20px)`, // Position bbox x at left (plus padding)
                                    }}
                                >
                                    <img
                                        src={images[item.page - 1]}
                                        alt="Schedule Snippet"
                                        className="w-full h-auto opacity-90"
                                    />

                                    {/* Highlight overlay on the image itself */}
                                    <div
                                        className="absolute border-2 border-red-500 bg-yellow-300/20 mix-blend-multiply"
                                        style={{
                                            top: `${item.bbox[0] / 10}%`,
                                            left: `${item.bbox[1] / 10}%`,
                                            height: `${(item.bbox[2] - item.bbox[0]) / 10}%`,
                                            width: `${(item.bbox[3] - item.bbox[1]) / 10}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="flex justify-end">
                <button
                    onClick={handleConfirm}
                    disabled={selected.size === 0}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-8 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Continue to Floor Plans
                </button>
            </div>
        </div>
    );
}
