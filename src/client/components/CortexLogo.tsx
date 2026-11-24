import { useId } from "react";

interface CortexLogoProps {
  className?: string;
  title?: string;
}

export function CortexLogo({ className = "h-9 w-9", title }: CortexLogoProps) {
  const uid = useId().replace(/:/g, "");
  const bgId = `cortex-bg-${uid}`;
  const glowId = `cortex-glow-${uid}`;
  const auraId = `cortex-aura-${uid}`;
  const cId = `cortex-c-${uid}`;
  const synapseId = `cortex-synapse-${uid}`;
  const rimId = `cortex-rim-${uid}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient
          id={bgId}
          x1="4"
          y1="4"
          x2="60"
          y2="60"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="52%" stopColor="#4338ca" />
          <stop offset="100%" stopColor="#312e81" />
        </linearGradient>
        <radialGradient
          id={glowId}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(16 12) scale(38)"
        >
          <stop offset="0%" stopColor="#a5b4fc" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#a5b4fc" stopOpacity="0" />
        </radialGradient>
        <radialGradient
          id={auraId}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(36.5 32) scale(19)"
        >
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </radialGradient>
        <linearGradient
          id={cId}
          x1="31"
          y1="14"
          x2="31"
          y2="50"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#eef2ff" />
        </linearGradient>
        <linearGradient
          id={synapseId}
          x1="26"
          y1="32"
          x2="39"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#a5f3fc" />
        </linearGradient>
        <linearGradient
          id={rimId}
          x1="32"
          y1="2"
          x2="32"
          y2="62"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.08" />
        </linearGradient>
      </defs>

      {/* Squircle Container */}
      <rect x="2" y="2" width="60" height="60" rx="15" fill={`url(#${bgId})`} />
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="15"
        fill={`url(#${glowId})`}
      />
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="15"
        fill={`url(#${auraId})`}
      />
      <rect
        x="2.75"
        y="2.75"
        width="58.5"
        height="58.5"
        rx="14.25"
        stroke={`url(#${rimId})`}
        strokeWidth="1.5"
      />

      {/* Cerebral "C" Hemisphere */}
      <path
        d="M 42.73 19.42 A 17.2 17.2 0 1 0 42.73 44.58"
        stroke={`url(#${cId})`}
        strokeWidth="6.4"
        strokeLinecap="round"
      />

      {/* Inner Neural Synapse & Code Pulse (>) */}
      <path
        d="M 27.5 24.5 L 36.2 32 L 27.5 39.5"
        stroke={`url(#${synapseId})`}
        strokeWidth="4.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="27.5" cy="24.5" r="2.55" fill="#7dd3fc" />
      <circle cx="27.5" cy="39.5" r="2.55" fill="#7dd3fc" />
      <circle cx="36.5" cy="32" r="3.1" fill="#e0f7ff" />
    </svg>
  );
}
