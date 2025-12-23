/**
 * SniperDot component - Single pulsing dot indicator for equipment location.
 * Positioned in PDF coordinates as a child of the PDF container.
 */

import React from 'react';

interface SniperDotProps {
  x: number;  // X coordinate in PDF space
  y: number;  // Y coordinate in PDF space
  isActive: boolean;
  status: 'pending' | 'confirmed' | 'declined' | 'duplicate' | 'manual';
}

// BuildVision color tokens
const STATUS_COLORS = {
  pending: { bg: 'bg-bv-blue-600', hex: '#4A3AFF' },
  confirmed: { bg: 'bg-green-400', hex: '#16DA7C' },
  declined: { bg: 'bg-red-400', hex: '#EC4343' },
  duplicate: { bg: 'bg-yellow-400', hex: '#FFCC17' },
  manual: { bg: 'bg-purple-500', hex: '#8B5CF6' },
} as const;

export const SniperDot: React.FC<SniperDotProps> = React.memo(({
  x,
  y,
  isActive,
  status,
}) => {
  if (status === 'declined') return null;

  const colorConfig = STATUS_COLORS[status];
  const color = colorConfig.hex;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        // Position directly in PDF coordinates
        // The parent container handles all transforms
        left: x,
        top: y,
        // Center the dot on the coordinate
        transform: 'translate(-50%, -50%) translateZ(0)',
        zIndex: isActive ? 100 : 10, // Active dots should be above everything
        willChange: 'transform',
      }}
    >
      {/* Pulse rings for active item */}
      {isActive && status === 'pending' && (
        <div className="pointer-events-none">
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 80,
              height: 80,
              marginLeft: -40,
              marginTop: -40,
              borderRadius: '50%',
              border: `3px solid ${color}`,
              opacity: 0.4,
              animation: 'sniper-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
              willChange: 'transform, opacity',
              transform: 'translateZ(0)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 50,
              height: 50,
              marginLeft: -25,
              marginTop: -25,
              borderRadius: '50%',
              backgroundColor: `${color}30`,
              animation: 'sniper-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              willChange: 'transform, opacity',
              transform: 'translateZ(0)',
            }}
          />
        </div>
      )}

      {/* Center dot */}
      <div
        className="relative rounded-full cursor-pointer"
        style={{
          width: isActive ? 20 : 12,
          height: isActive ? 20 : 12,
          backgroundColor: color,
          border: '4px solid white',
          boxShadow: isActive
            ? `0 0 0 4px ${color}50, 0 4px 20px rgba(0,0,0,0.3)`
            : '0 2px 8px rgba(0,0,0,0.2)',
          transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: 'auto', // Enable clicks on the dot itself
          willChange: 'transform, width, height, box-shadow',
          transform: 'translateZ(0)',
        }}
      />

      {/* Checkmark badge for confirmed items */}
      {status === 'confirmed' && !isActive && (
        <div
          className="absolute bg-white rounded-full shadow-md flex items-center justify-center"
          style={{
            width: 16,
            height: 16,
            top: -6,
            right: -6,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M2 5L4 7L8 3"
              stroke={STATUS_COLORS.confirmed.hex}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}

      {/* Warning badge for duplicate items */}
      {status === 'duplicate' && !isActive && (
        <div
          className="absolute bg-white rounded-full shadow-md flex items-center justify-center"
          style={{
            width: 16,
            height: 16,
            top: -6,
            right: -6,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path
              d="M6 3v3m0 2h.01M6 11A5 5 0 106 1a5 5 0 000 10z"
              stroke={STATUS_COLORS.duplicate.hex}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}

      {/* Plus badge for manual items */}
      {status === 'manual' && !isActive && (
        <div
          className="absolute bg-white rounded-full shadow-md flex items-center justify-center"
          style={{
            width: 16,
            height: 16,
            top: -6,
            right: -6,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M5 2v6M2 5h6"
              stroke={STATUS_COLORS.manual.hex}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
    </div>
  );
});

// Display name for React DevTools
SniperDot.displayName = 'SniperDot';

export default SniperDot;
