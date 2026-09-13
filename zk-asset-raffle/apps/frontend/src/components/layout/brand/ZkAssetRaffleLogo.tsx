import React from "react";

export function ZkAssetRaffleLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="48" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1" />
      <path d="M50 50 L50 2 A48 48 0 0 1 91.5 26 Z" fill="#EC4899" />
      <path d="M50 50 L91.5 26 A48 48 0 0 1 91.5 74 Z" fill="#EAB308" />
      <path d="M50 50 L91.5 74 A48 48 0 0 1 50 98 Z" fill="#22C55E" />
      <path d="M50 50 L50 98 A48 48 0 0 1 8.5 74 Z" fill="#EC4899" />
      <path d="M50 50 L8.5 74 A48 48 0 0 1 8.5 26 Z" fill="#EAB308" />
      <path d="M50 50 L8.5 26 A48 48 0 0 1 50 2 Z" fill="#22C55E" />
      <circle cx="50" cy="50" r="48" fill="url(#gloss)" opacity="0.3" />
      <circle cx="50" cy="50" r="28" fill="white" stroke="#E2E8F0" strokeWidth="2" />
      <circle cx="50" cy="50" r="24" fill="#F8FAFC" />
      <g transform="translate(50, 52)">
        <rect x="-10" y="-4" width="20" height="16" rx="3" fill="#64748B" />
        <path
          d="M-6 -4V-10C-6 -13.3 -3.3 -16 0 -16C3.3 -16 6 -13.3 6 -10V-4"
          stroke="#64748B"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M-4 4L-1 7L5 1"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <defs>
        <linearGradient id="gloss" x1="0" y1="0" x2="100" y2="100">
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
    </svg>
  );
}
