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

                        {/* Visual Verification Snippet */}
                        {images && item.page && item.bbox && (
                            <div className="w-full md:w-96 h-40 relative border border-neutral-200 bg-neutral-100 rounded-lg overflow-hidden flex-shrink-0 group-hover:border-bv-blue-300 transition-colors">
                                <div className="absolute text-xs bg-neutral-900/80 text-white px-2 py-1 top-0 left-0 z-20 rounded-br">
                                    Page {item.page}
                                </div>

                                <div
                                    className="absolute origin-top-left"
                                    style={{
                                        width: '300%', // Zoom factor
                                        transform: `translate(-${item.bbox[1] / 10}%, -${item.bbox[0] / 10}%)`, // Position bbox at top-left
                                    }}
                                >
                                    <img
                                        src={images[item.page - 1]}
                                        alt="Schedule Snippet"
                                        className="w-full h-auto opacity-95 mix-blend-multiply"
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
                    className="bg-bv-blue-600 hover:bg-bv-blue-700 text-white font-medium py-2.5 px-8 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                >
                    Continue to Floor Plans
                </button>
            </div>
        </div>
    );
}
