import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { Stage } from "../fx/Stage";
import { displayType } from "../fx/type";

// The trust beat: sealed + audit trail + compliance line, then the webhook
// event firing back into the terminal — closing the loop with the opener.
const ROWS = [
  { t: "Envelope sealed", d: "SHA-256 over signed PDF" },
  { t: "Certificate of Completion", d: "generated" },
  { t: "Audit trail written", d: "consent, view, sign, seal" },
  { t: "webhook: envelope.completed", d: "→ your terminal", mono: true },
];

export const SealAudit = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const exit = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // continuous push-in: nothing static, ever
  const cam = interpolate(frame, [0, durationInFrames], [1.0, 1.045]);

  return (
    <Stage glow={0.2} glowColor={brand.greenGlow}>
      <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: exit,
        fontFamily: brand.font.sans,
      }}
    >
      <div style={{ width: 980, transform: `scale(${cam})` }}>
        <div
          style={{
            textAlign: "center",
            ...displayType(96),
            marginBottom: 42,
            opacity: interpolate(frame, [0, 10], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          Fast. <span style={{ color: brand.trafficGreen, WebkitTextFillColor: brand.trafficGreen }}>Secure.</span>
        </div>
        {ROWS.map((r, i) => {
          const delay = i * 10; // rows land faster so all four read inside the beat
          const s = spring({ frame: frame - delay, fps, config: { damping: 100 } });
          const o = interpolate(frame - delay, [0, 10], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 22,
                padding: "20px 28px",
                marginBottom: 14,
                borderRadius: 14,
                border: `1px solid ${brand.borderSoft}`,
                background: `linear-gradient(180deg, ${brand.surface2} 0%, ${brand.surface1} 100%)`,
                boxShadow: `inset 0 1px 0 ${brand.topEdge}`,
                opacity: o,
                transform: `translateX(${(1 - s) * 40}px)`,
              }}
            >
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: "#0e1a13",
                  border: "1px solid #1f3a2a",
                  color: brand.trafficGreen,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                }}
              >
                ✓
              </span>
              <span
                style={{
                  color: brand.white,
                  fontSize: 40,
                  fontWeight: 700,
                  fontFamily: r.mono ? brand.font.mono : brand.font.sans,
                  letterSpacing: r.mono ? "0" : "-0.02em",
                }}
              >
                {r.t}
              </span>
              <span style={{ color: brand.slate300, fontSize: 28, marginLeft: "auto" }}>
                {r.d}
              </span>
            </div>
          );
        })}
        <div
          style={{
            marginTop: 30,
            textAlign: "center",
            color: brand.slate300,
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: "0.06em",
            opacity: interpolate(frame, [48, 62], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          ESIGN&nbsp;&nbsp;·&nbsp;&nbsp;UETA&nbsp;&nbsp;·&nbsp;&nbsp;PIPEDA
        </div>
      </div>
      </AbsoluteFill>
    </Stage>
  );
};
