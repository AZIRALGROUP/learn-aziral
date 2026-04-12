interface LogoProps {
  variant?: "full" | "icon";
  className?: string;
  height?: number;
}

// The A mark: solid shape with crossbar cut through (fill-rule evenodd)
const AMark = ({ fill = "currentColor" }: { fill?: string }) => (
  <path
    fillRule="evenodd"
    d="M80,8 L152,152 L124,152 L80,62 L36,152 L8,152 Z M32,102 L128,102 L128,113 L32,113 Z"
    fill={fill}
  />
);

export function Logo({ variant = "full", className = "", height = 40 }: LogoProps) {
  if (variant === "icon") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 160 160"
        width={height}
        height={height}
        className={className}
        aria-label="Aziral"
      >
        <AMark />
      </svg>
    );
  }

  // Full horizontal logo
  const w = Math.round(height * (360 / 56));
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 360 56"
      width={w}
      height={height}
      className={className}
      aria-label="Aziral"
    >
      {/* Mark scaled to 56px tall, viewBox 0 0 160 160 → scaled by 56/160 = 0.35 */}
      <g transform="scale(0.35)">
        <AMark />
      </g>
      {/* Wordmark */}
      <text
        x="72"
        y="30"
        fontFamily="'SF Pro Display','Inter',-apple-system,'Helvetica Neue',Arial,sans-serif"
        fontSize="30"
        fontWeight="800"
        fill="currentColor"
        letterSpacing="7"
        dominantBaseline="middle"
      >
        AZIRAL
      </text>
      {/* Tagline */}
      <text
        x="73"
        y="47"
        fontFamily="'SF Pro Display','Inter',-apple-system,'Helvetica Neue',Arial,sans-serif"
        fontSize="7.5"
        fontWeight="400"
        fill="currentColor"
        opacity="0.45"
        letterSpacing="3.5"
        dominantBaseline="middle"
      >
        IT SOLUTIONS · АСТАНА
      </text>
    </svg>
  );
}
