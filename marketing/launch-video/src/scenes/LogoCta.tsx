import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";

// Closing card: wordmark, URL, install command.
export const LogoCta = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 90, stiffness: 130 } });
  const sub = interpolate(frame, [16, 32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cmd = interpolate(frame, [30, 46], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: brand.ink,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: brand.font.sans,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 820,
          height: 480,
          borderRadius: "50%",
          background: brand.blue,
          opacity: 0.13,
          filter: "blur(140px)",
        }}
      />
      <div style={{ textAlign: "center", transform: `scale(${0.96 + pop * 0.04})` }}>
        <div
          style={{
            color: brand.white,
            fontSize: 120,
            fontWeight: 700,
            letterSpacing: "-0.03em",
          }}
        >
          Swift<span style={{ color: brand.blue }}>Sign</span>
        </div>
        <div style={{ color: brand.slate300, fontSize: 40, marginTop: 14, opacity: sub }}>
          swiftsign.ca
        </div>
        <div
          style={{
            marginTop: 44,
            display: "inline-block",
            fontFamily: brand.font.mono,
            fontSize: 34,
            color: brand.offwhite,
            background: "#0d0f13",
            border: "1px solid #242a35",
            borderRadius: 12,
            padding: "16px 34px",
            opacity: cmd,
          }}
        >
          <span style={{ color: brand.slate500 }}>$ </span>npm install swiftsign
        </div>
      </div>
    </AbsoluteFill>
  );
};
