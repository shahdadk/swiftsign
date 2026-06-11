import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { brand } from "../brand";

// Placeholder brand title card. Proves the render pipeline; replaced by the
// real scene sequence (terminal hero, signer flow, b-roll) during assembly.
export const Hello = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  const lift = interpolate(frame, [0, 24], [16, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: brand.ink,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${lift}px)`,
          color: brand.white,
          fontFamily: brand.font.sans,
          fontSize: 112,
          fontWeight: 700,
          letterSpacing: "-0.03em",
        }}
      >
        Swift<span style={{ color: brand.blue }}>Sign</span>
      </div>
    </AbsoluteFill>
  );
};
