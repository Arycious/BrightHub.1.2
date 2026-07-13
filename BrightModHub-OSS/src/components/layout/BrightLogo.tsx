// ==========================================
// BrightModHub Logo — Sun & Moon
// ==========================================
// Inline SVG logo — no external file needed.

export function BrightLogo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="bright-logo"
    >
      {/* Glow filter */}
      <defs>
        <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fde047" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#fde047" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="moonGlow" cx="40%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sunBody" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id="moonBody" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5eead4" />
          <stop offset="50%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#14b8a6" />
        </linearGradient>
        <linearGradient id="rayGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="100%" stopColor="#eab308" />
        </linearGradient>
      </defs>

      {/* Ambient glow */}
      <circle cx="60" cy="60" r="55" fill="url(#sunGlow)" />

      {/* Sun rays */}
      {Array.from({ length: 16 }).map((_, i) => {
        const angle = (i * 360) / 16;
        const rad = (angle * Math.PI) / 180;
        const innerR = 32;
        const outerR = i % 2 === 0 ? 52 : 44;
        const x1 = 60 + Math.cos(rad) * innerR;
        const y1 = 60 + Math.sin(rad) * innerR;
        const x2 = 60 + Math.cos(rad) * outerR;
        const y2 = 60 + Math.sin(rad) * outerR;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="url(#rayGrad)"
            strokeWidth={i % 2 === 0 ? 4 : 2.5}
            strokeLinecap="round"
            opacity={i % 2 === 0 ? 1 : 0.7}
          />
        );
      })}

      {/* Sun body */}
      <circle cx="60" cy="60" r="28" fill="url(#sunBody)" />
      <circle cx="60" cy="60" r="28" fill="url(#sunBody)" opacity="0.8" />

      {/* Moon crescent overlay */}
      <circle cx="60" cy="60" r="26" fill="url(#moonGlow)" />
      <path
        d="M 72 38 
           A 26 26 0 0 1 72 82 
           A 18 18 0 0 0 72 38 Z"
        fill="url(#moonBody)"
        opacity="0.95"
      />

      {/* Moon inner shadow */}
      <path
        d="M 72 42 
           A 22 22 0 0 1 72 78 
           A 15 15 0 0 0 72 42 Z"
        fill="#0f766e"
        opacity="0.3"
      />

      {/* Stars */}
      <circle cx="78" cy="52" r="1.5" fill="white" opacity="0.9" />
      <circle cx="82" cy="62" r="1" fill="white" opacity="0.7" />
      <circle cx="76" cy="72" r="1.2" fill="white" opacity="0.8" />
      <circle cx="84" cy="55" r="0.8" fill="white" opacity="0.6" />

      {/* 4-point star sparkle */}
      <g transform="translate(80, 48)" opacity="0.9">
        <line x1="0" y1="-3" x2="0" y2="3" stroke="white" strokeWidth="1" strokeLinecap="round" />
        <line x1="-3" y1="0" x2="3" y2="0" stroke="white" strokeWidth="1" strokeLinecap="round" />
      </g>
      <g transform="translate(85, 68)" opacity="0.7">
        <line x1="0" y1="-2" x2="0" y2="2" stroke="white" strokeWidth="0.8" strokeLinecap="round" />
        <line x1="-2" y1="0" x2="2" y2="0" stroke="white" strokeWidth="0.8" strokeLinecap="round" />
      </g>
    </svg>
  );
}
