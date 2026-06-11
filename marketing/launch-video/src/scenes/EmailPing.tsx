import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { Stage } from "../fx/Stage";

// Animated replacement for the signer-phone beats: a clean motion-graphics
// sequence. An email notification card springs in, then flips to the signed
// confirmation. Tells "client signs in seconds, no account" without footage.
export const EmailPing = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const cardIn = spring({ frame: frame - 4, fps, config: { damping: 90, stiffness: 140 } });
  // signature draws on (stroke dashoffset feel) 40-78
  const sigProgress = interpolate(frame, [40, 78], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const signedAt = 96;
  const signedPop = spring({ frame: frame - signedAt, fps, config: { damping: 80, stiffness: 160 } });
  const cam = interpolate(frame, [0, durationInFrames], [1.0, 1.05]);
  const exit = interpolate(frame, [durationInFrames - 9, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // simple bezier "signature" path, drawn by clipping width
  return (
    <Stage glow={0.26}>
      <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: exit,
        fontFamily: brand.font.sans,
      }}
    >
      <div style={{ transform: `scale(${cam})`, display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* the email card */}
        <div
          style={{
            width: 1040,
            borderRadius: 18,
            border: `1px solid ${brand.borderSoft}`,
            background: brand.surface1,
            boxShadow: `inset 0 1px 0 ${brand.topEdge}, 0 50px 110px -24px rgba(0,0,0,0.7), 0 0 140px -40px ${brand.blueGlow}`,
            transform: `translateY(${(1 - cardIn) * 70}px) scale(${0.94 + cardIn * 0.06})`,
            opacity: Math.min(1, cardIn * 1.3),
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "22px 30px",
              borderBottom: `1px solid ${brand.borderSoft}`,
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: brand.blue,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 800,
                fontSize: 26,
              }}
            >
              S
            </div>
            <div>
              <div style={{ color: brand.white, fontSize: 27, fontWeight: 700 }}>
                Please sign: Mutual NDA
              </div>
              <div style={{ color: brand.slate500, fontSize: 21 }}>via SwiftSign · just now</div>
            </div>
            <div style={{ flex: 1 }} />
            <div
              style={{
                color: brand.slate300,
                fontSize: 19,
                border: "1px solid #262d3a",
                borderRadius: 9,
                padding: "7px 14px",
              }}
            >
              no account needed
            </div>
          </div>

          {/* signature line, drawing itself */}
          <div style={{ padding: "38px 30px 30px" }}>
            <div
              style={{
                position: "relative",
                height: 110,
                borderBottom: "2px solid rgba(255,255,255,0.14)",
                overflow: "hidden",
              }}
            >
              <div style={{ width: `${sigProgress * 100}%`, overflow: "hidden", height: "100%" }}>
                <svg width="520" height="110" viewBox="0 0 520 110" style={{ display: "block" }}>
                  <path
                    d="M14 78 C 60 18, 96 95, 132 62 C 158 38, 175 30, 200 56 C 224 80, 246 84, 270 56 C 282 41, 300 34, 318 52 C 348 84, 380 80, 420 44 C 444 24, 470 38, 500 30"
                    fill="none"
                    stroke={brand.white}
                    strokeWidth="4.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <span
                style={{
                  position: "absolute",
                  right: 0,
                  bottom: 10,
                  color: brand.slate500,
                  fontSize: 19,
                  fontFamily: brand.font.mono,
                }}
              >
                Steve Park
              </span>
            </div>
          </div>
        </div>

        {/* signed confirmation pops under the card */}
        <div
          style={{
            marginTop: 36,
            display: "flex",
            alignItems: "center",
            gap: 16,
            opacity: Math.min(1, Math.max(0, signedPop) * 1.2),
            transform: `scale(${0.8 + signedPop * 0.2})`,
            color: brand.trafficGreen,
            fontSize: 44,
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          <span
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#0e1a13",
              border: "1px solid #1f3a2a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 50px rgba(40,200,64,0.25)",
            }}
          >
            ✓
          </span>
          Signed in seconds.
        </div>
      </div>
      </AbsoluteFill>
    </Stage>
  );
};
