import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { Grain } from "./Grain";

// The premium stage every scene sits on. Encodes the researched recipe:
// - navy near-black canvas (#05060a), never pure black
// - top-anchored radial glow decaying within ~55% (Resend's section-glow pattern)
// - secondary low ellipse for floor bounce
// - faint 1px grid (only when asked: climax beats)
// - 4% grain to kill H.264 banding on the dark gradients
export const Stage = ({
  children,
  glow = 0.26, // 0.18-0.34 band from the teardown
  glowColor = brand.blueGlow,
  grid = false,
  breathe = true, // slow glow intensity drift so the bg is never static
}: {
  children: React.ReactNode;
  glow?: number;
  glowColor?: string;
  grid?: boolean;
  breathe?: boolean;
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const drift = breathe
    ? 1 + 0.12 * Math.sin((frame / durationInFrames) * Math.PI)
    : 1;
  const a = Math.min(0.4, glow * drift);

  return (
    <AbsoluteFill style={{ backgroundColor: brand.ink, overflow: "hidden" }}>
      {/* primary light: overhead, top-anchored, decays fast */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 85% 55% at 50% -12%, ${glowColor.replace(
            /[\d.]+\)$/,
            `${a})`,
          )}, transparent 62%)`,
        }}
      />
      {/* floor bounce: dimmer, wider, from below the frame */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 110% 45% at 50% 118%, ${glowColor.replace(
            /[\d.]+\)$/,
            `${a * 0.35})`,
          )}, transparent 60%)`,
        }}
      />
      {grid && (
        <AbsoluteFill
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
            backgroundSize: "72px 72px",
            maskImage:
              "radial-gradient(ellipse 70% 60% at 50% 45%, black 30%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 70% 60% at 50% 45%, black 30%, transparent 75%)",
          }}
        />
      )}
      {children}
      <Grain opacity={0.045} />
    </AbsoluteFill>
  );
};

// Premium floating window: surface-ladder fill, hairline border, 1px top-edge
// light, huge-and-faint outer shadow (video legibility), optional rotateX tilt.
export const Window = ({
  children,
  width,
  tilt = 0, // degrees rotateX — the Remotion launch-video "floating object" trick
  oscillate = false,
  radius = 18,
}: {
  children: React.ReactNode;
  width: number;
  tilt?: number;
  oscillate?: boolean;
  radius?: number;
}) => {
  const frame = useCurrentFrame();
  const rotY = oscillate ? Math.sin(frame / 55) * 1.6 : 0;
  return (
    <div
      style={{
        width,
        borderRadius: radius,
        overflow: "hidden",
        background: brand.surface1,
        border: `1px solid ${brand.borderSoft}`,
        boxShadow: `inset 0 1px 0 ${brand.topEdge}, 0 40px 90px -20px rgba(0,0,0,0.65), 0 0 120px -30px ${brand.blueGlow}`,
        transform:
          tilt || oscillate
            ? `perspective(1600px) rotateX(${tilt}deg) rotateY(${rotY}deg)`
            : undefined,
        transformStyle: "preserve-3d",
      }}
    >
      {children}
    </div>
  );
};

// Standard mac chrome bar for Window
export const Chrome = ({ title }: { title?: React.ReactNode }) => (
  <div
    style={{
      height: 56,
      display: "flex",
      alignItems: "center",
      padding: "0 22px",
      gap: 16,
      background: `linear-gradient(180deg, ${brand.surface3} 0%, ${brand.surface1} 100%)`,
      borderBottom: `1px solid ${brand.borderSoft}`,
    }}
  >
    <div style={{ display: "flex", gap: 9 }}>
      {[brand.trafficRed, brand.trafficYellow, brand.trafficGreen].map((c) => (
        <span
          key={c}
          style={{
            width: 13,
            height: 13,
            borderRadius: "50%",
            background: `linear-gradient(180deg, ${c}, ${c}cc)`,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)",
          }}
        />
      ))}
    </div>
    {title}
  </div>
);
