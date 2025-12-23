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
    // Instead of DOMParser, we use string manipulation for basic attributes
    // and rely on dangerouslySetInnerHTML for performance.
    const processedSvg = useMemo(() => {
        if (!svgContent) return "";
        
        // Optimization: if it's already a string, we can inject it.
        // We ensure width/height are set on the outer container instead of
        // expensive attribute manipulation on every path.
        return svgContent;
    }, [svgContent]);

    useEffect(() => {
        if (svgContent && onLoad) {
            onLoad({ width, height });
            setLoaded(true);
        }
    }, [svgContent, width, height, onLoad]);

    return (
        <div 
            className={`svg-page-viewer ${className}`}
            style={{ 
                width: width,
                height: height,
                lineHeight: 0,
                willChange: 'transform',
                transform: 'translateZ(0)',
                backfaceVisibility: 'hidden',
                contain: 'layout style paint',
                userSelect: 'none',
                WebkitUserSelect: 'none',
            }}
            dangerouslySetInnerHTML={{ __html: processedSvg }}
        />
    );
});

export default SvgPageViewer;
