import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { Stage } from "./Stage";

// Kinetic word-by-word headline. Research-encoded: 2-3 frame word stagger,
// y 20->0, scale 0.96->1, spring damping 200 (critically damped snap, ~23f).
// Editorial size: ~10% of frame height.
export const WordSting = ({
  words,
  size = 112,
  startAt = 0,
  overlay = false,
  align = "center",
}: {
  words: string;
  size?: number;
  startAt?: number;
  overlay?: boolean; // true = transparent bg (over footage)
  align?: "center" | "left";
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const parts = words.split(" ");

  const exit = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const inner = (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: align === "center" ? "center" : "flex-start",
        paddingLeft: align === "left" ? 140 : 0,
        opacity: exit,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: align === "center" ? "center" : "flex-start",
          gap: "0 0.28em",
          maxWidth: 1560,
          fontFamily: brand.font.sans,
          fontWeight: 600,
          fontSize: size,
          letterSpacing: `${-(size * 0.0375)}px`,
          lineHeight: 1.06,
          textShadow: overlay ? "0 4px 40px rgba(0,0,0,0.8)" : "none",
        }}
      >
        {parts.map((w, i) => {
          const d = startAt + i * 3; // 3-frame word stagger
          const s = spring({ frame: frame - d, fps, config: { damping: 200 } });
          const o = interpolate(frame - d, [0, 6], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: o,
                transform: `translateY(${(1 - s) * 20}px) scale(${0.96 + s * 0.04})`,
                background: "linear-gradient(180deg, #ffffff 0%, #b9bdc9 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );

  return overlay ? inner : <Stage glow={0.22}>{inner}</Stage>;
};
