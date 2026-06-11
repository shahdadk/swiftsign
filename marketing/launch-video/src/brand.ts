// SwiftSign brand tokens, lifted from products/swiftsign/src (verified 2026-05-30).
// Premium layer (2026-06-04) encoded from the Linear/Raycast/Resend teardown:
// navy-tinted near-black canvas (NEVER #000), 4-step surface ladder, depth from
// hairline borders + top-edge highlight (not blur), accent blue only as glow.
export const brand = {
  blue: "#2b5cff", // primary (lines, icons, accents — never large fills)
  blueGlow: "rgba(20,80,255,0.32)", // glow token: deeper + more saturated than the line blue
  ink: "#05060a", // canvas: navy-tinted near-black (Linear #010102 / Raycast #07080a pattern)
  // surface ladder — depth via luminance steps, not shadows
  surface1: "#0c0f17",
  surface2: "#11151f",
  surface3: "#161b27",
  // hairline borders (Resend: translucent white, not gray hex)
  borderSoft: "rgba(255,255,255,0.07)",
  borderStrong: "rgba(255,255,255,0.14)",
  topEdge: "rgba(255,255,255,0.12)", // 1px inset top highlight = light catching the panel lip
  slate900: "#0f172a",
  slate500: "#64748b",
  slate300: "#94a3b8",
  border: "#e5e7eb",
  white: "#ffffff",
  offwhite: "#fcfcfd",
  clay: "#d97757", // accent
  // macOS terminal traffic lights
  trafficRed: "#ff5f57",
  trafficYellow: "#febc2e",
  trafficGreen: "#28c840",
  greenGlow: "rgba(17,255,153,0.16)",
  font: {
    sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    mono: '"SF Mono", "JetBrains Mono", ui-monospace, Menlo, Monaco, monospace',
  },
} as const;
