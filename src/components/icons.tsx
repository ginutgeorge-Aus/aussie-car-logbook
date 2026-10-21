/** Inline stroke icons from the Odometer mockups (24×24, currentColor). Decorative only. */

type IconProps = { size?: number; className?: string };

/** Shared SVG wrapper so every icon is aria-hidden and themable via currentColor. */
function Svg({ size = 24, className, strokeWidth = 1.8, children }: IconProps & { strokeWidth?: number; children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

/** House — Home/Dashboard tab. */
export function HomeIcon(p: IconProps) {
  return <Svg {...p}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></Svg>;
}

/** Winding road — Trips tab. */
export function TripsIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="5" r="2" />
      <path d="M8 19h8a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h8" />
    </Svg>
  );
}

/** Receipt — Expenses tab. */
export function ExpensesIcon(p: IconProps) {
  return <Svg {...p}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></Svg>;
}

/** Bar chart — Reports tab. */
export function ReportsIcon(p: IconProps) {
  return <Svg {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Svg>;
}

/** Sliders — Settings tab. */
export function SettingsIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 6h10M4 12h4M12 12h8M4 18h12" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </Svg>
  );
}

/** Plus — primary "add" actions. */
export function PlusIcon(p: IconProps) {
  return <Svg strokeWidth={2} {...p}><path d="M12 5v14M5 12h14" /></Svg>;
}

/** Camera — receipt scan. */
export function CameraIcon(p: IconProps) {
  return <Svg {...p}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></Svg>;
}
