import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { Stage } from "../fx/Stage";

// Animated closer: the wordmark assembles from a typed cursor beat, the
// install command stamps in on the beat. No footage.
export const LogoCtaV2 = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const markIn = spring({ frame, fps, config: { damping: 90, stiffness: 120 } });
  // "Sign" slides in from behind "Swift"
  const signSlide = spring({ frame: frame - 10, fps, config: { damping: 200 } });
  const urlIn = interpolate(frame, [26, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cmdPop = spring({ frame: frame - 44, fps, config: { damping: 85, stiffness: 150 } });
  const cam = interpolate(frame, [0, 150], [1.0, 1.04]);

  return (
    <Stage glow={0.3} grid>
      <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        fontFamily: brand.font.sans,
      }}
    >
      <div style={{ textAlign: "center", transform: `scale(${cam})` }}>
        <div
          style={{
            fontSize: 128,
            fontWeight: 700,
            letterSpacing: "-0.035em",
            display: "flex",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <span
            style={{
              color: brand.white,
              transform: `translateY(${(1 - markIn) * 60}px)`,
              opacity: markIn,
              display: "inline-block",
            }}
          >
            Swift
          </span>
          <span
            style={{
              color: brand.blue,
              transform: `translateX(${(1 - signSlide) * -46}px)`,
              opacity: Math.min(1, signSlide * 1.4),
              display: "inline-block",
              textShadow: `0 0 60px ${brand.blue}55`,
            }}
          >
            Sign
          </span>
        </div>
        <div style={{ color: brand.slate300, fontSize: 38, marginTop: 12, opacity: urlIn }}>
          swiftsign.ca
        </div>
        <div
          style={{
            marginTop: 46,
            display: "inline-block",
            fontFamily: brand.font.mono,
            fontSize: 34,
            color: brand.offwhite,
            background: `linear-gradient(180deg, ${brand.surface3} 0%, ${brand.surface1} 100%)`,
            border: `1px solid ${brand.borderStrong}`,
            borderRadius: 12,
            padding: "17px 36px",
            opacity: Math.min(1, Math.max(0, cmdPop) * 1.2),
            transform: `scale(${0.85 + cmdPop * 0.15})`,
            boxShadow: `0 0 70px ${brand.blue}22`,
          }}
        >
          <span style={{ color: brand.slate500 }}>$ </span>npm install swiftsign
        </div>
      </div>
      </AbsoluteFill>
    </Stage>
  );
};
