import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";

// Kinetic typography beat on the ink background. One line, fast, confident.
export const KineticLine = ({ text, accent }: { text: string; accent?: string }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const pop = spring({ frame, fps, config: { damping: 16, stiffness: 160 } });
  const exitStart = durationInFrames - 12;
  const exit = interpolate(frame, [exitStart, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const slide = interpolate(frame, [0, 14], [26, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: brand.ink,
        justifyContent: "center",
        alignItems: "center",
        opacity: exit,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 760,
          height: 420,
          borderRadius: "50%",
          background: brand.blue,
          opacity: 0.12,
          filter: "blur(130px)",
        }}
      />
      <div
        style={{
          transform: `scale(${0.94 + pop * 0.06}) translateY(${slide}px)`,
          color: brand.white,
          fontFamily: brand.font.sans,
          fontSize: 84,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          textAlign: "center",
          maxWidth: 1400,
          lineHeight: 1.12,
        }}
      >
        {text}
        {accent && (
          <div style={{ color: brand.blue, fontSize: 56, marginTop: 18, fontWeight: 600 }}>
            {accent}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
