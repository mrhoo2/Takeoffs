"use client";

import { useRef, useEffect, useState, useMemo, memo } from "react";

interface SvgPageViewerProps {
    svgContent: string;
    width: number;
    height: number;
    onLoad?: (dimensions: { width: number; height: number }) => void;
    className?: string;
}

// Memoize the component to prevent unnecessary re-renders
const SvgPageViewer = memo(function SvgPageViewer({
    svgContent,
    width,
    height,
    onLoad,
    className = "",
}: SvgPageViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [loaded, setLoaded] = useState(false);
    
    // Memoize processed SVG content to avoid re-processing
    const processedSvg = useMemo(() => {
        if (!svgContent) return null;
        
        // Parse the SVG and optimize it
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgContent, "image/svg+xml");
        const svgElement = doc.querySelector("svg");
        
        if (svgElement) {
            // Set dimensions
            svgElement.setAttribute("width", `${width}`);
            svgElement.setAttribute("height", `${height}`);
            
            // Add performance optimization attributes
            svgElement.style.display = "block";
            svgElement.style.maxWidth = "none";
            
            // Prevent text selection which can slow things down
            svgElement.style.userSelect = "none";
            svgElement.style.webkitUserSelect = "none";
            
            return svgElement.outerHTML;
        }
        
        return svgContent;
    }, [svgContent, width, height]);

    useEffect(() => {
        if (containerRef.current && processedSvg) {
            // Insert the processed SVG
            containerRef.current.innerHTML = processedSvg;
            
            setLoaded(true);
            
            if (onLoad) {
                onLoad({ width, height });
            }
        }
    }, [processedSvg, width, height, onLoad]);

    return (
        <div 
            ref={containerRef}
            className={`svg-page-viewer ${className}`}
            style={{ 
                width: width,
                height: height,
                lineHeight: 0,
                // GPU acceleration hints
                willChange: 'transform',
                transform: 'translateZ(0)',
                backfaceVisibility: 'hidden',
                // Prevent layout thrashing
                contain: 'layout style paint',
            }}
        />
    );
});

export default SvgPageViewer;
