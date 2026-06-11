import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { brand } from "../brand";
import { Grain } from "../fx/Grain";

// V2 terminal: full-bleed, oversized, continuous camera. The window is ~92%
// of frame width and the camera slowly pushes in and drifts toward the action.
// Compressed beats: type -> tool pill -> done -> sent, in ~10s.

const USER_TEXT =
  "send the NDA at ~/contracts/mutual-nda.pdf to steve@acme.com for signature";
const TOOL_NAME = "swiftsign_send_envelope";
const TOOL_PARAMS: [string, string][] = [
  ["document", "~/contracts/mutual-nda.pdf"],
  ["recipient", "steve@acme.com"],
  ["fields", "signature · date  (anchor-placed)"],
];
const RESULT_TEXT = "Envelope ss_3f8a…c21 sent. Steve will be notified.";

const BEAT = {
  userStart: 6,
  userSpeed: 2.6, // fast, confident typing
  thinkingStart: 38,
  toolStart: 60,
  toolDoneAt: 105,
  resultStart: 112,
};

const typed = (text: string, frame: number, start: number, speed: number) => {
  if (frame < start) return { shown: "", typing: false };
  const n = Math.min(Math.floor((frame - start) * speed), text.length);
  return { shown: text.slice(0, n), typing: n < text.length };
};

export const TerminalHeroV2 = () => {
  const frame = useCurrentFrame();

  // continuous camera: push 1.0 -> 1.06, drift down-left toward the tool pill
  const cam = interpolate(frame, [0, 300], [1.0, 1.06]);
  const panY = interpolate(frame, [0, 300], [0, -36]);

  const user = typed(USER_TEXT, frame, BEAT.userStart, BEAT.userSpeed);
  const cursorOn = Math.floor(frame / 14) % 2 === 0;
  const toolDone = frame >= BEAT.toolDoneAt;
  const dots = ".".repeat(Math.max(0, Math.floor((frame - BEAT.toolStart) / 9) % 4));
  const mono = brand.font.mono;

  const lineIn = (start: number) => ({
    opacity: interpolate(frame, [start, start + 7], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
    transform: `translateY(${interpolate(frame, [start, start + 7], [10, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })}px)`,
  });

  return (
    <AbsoluteFill style={{ backgroundColor: brand.ink, fontFamily: mono, overflow: "hidden" }}>
      {/* ambient glow follows the action */}
      <div
        style={{
          position: "absolute",
          width: 1200,
          height: 700,
          left: "50%",
          top: "40%",
          transform: "translate(-50%,-50%)",
          borderRadius: "50%",
          background: brand.blue,
          opacity: 0.12,
          filter: "blur(160px)",
        }}
      />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          transform: `scale(${cam}) translateY(${panY}px)`,
        }}
      >
        <div
          style={{
            width: 1780,
            borderRadius: 18,
            overflow: "hidden",
            border: "1px solid #232834",
            boxShadow: "0 60px 160px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.03)",
            background: "#0c0e12",
          }}
        >
          {/* chrome */}
          <div
            style={{
              height: 58,
              display: "flex",
              alignItems: "center",
              padding: "0 22px",
              gap: 16,
              background: "linear-gradient(180deg,#161a22 0%,#10131a 100%)",
              borderBottom: "1px solid #1e232e",
            }}
          >
            <div style={{ display: "flex", gap: 10 }}>
              {[brand.trafficRed, brand.trafficYellow, brand.trafficGreen].map((c) => (
                <span key={c} style={{ width: 14, height: 14, borderRadius: "50%", background: c }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 9, color: brand.slate300, fontSize: 19 }}>
              <span style={{ color: brand.clay }}>✻</span>
              <span style={{ color: brand.offwhite }}>claude</span>
              <span style={{ color: brand.slate500 }}>— ~/projects/acme-legal</span>
            </div>
            <div style={{ flex: 1 }} />
            <div
              style={{
                fontSize: 15,
                color: brand.slate300,
                background: "#1a1f29",
                border: "1px solid #262d3a",
                padding: "5px 13px",
                borderRadius: 8,
              }}
            >
              claude-opus-4.8
            </div>
          </div>

          {/* body — oversized type for full-bleed legibility */}
          <div style={{ padding: "44px 52px 40px", minHeight: 600, fontSize: 30, lineHeight: 1.62 }}>
            <div style={{ display: "flex", gap: 18, ...lineIn(BEAT.userStart) }}>
              <span style={{ color: brand.blue, fontWeight: 700 }}>&gt;</span>
              <span style={{ color: brand.offwhite }}>
                {user.shown}
                {user.typing && (
                  <span
                    style={{
                      display: "inline-block",
                      width: 13,
                      height: 30,
                      marginLeft: 3,
                      transform: "translateY(4px)",
                      backgroundColor: cursorOn ? brand.blue : "transparent",
                      borderRadius: 2,
                    }}
                  />
                )}
              </span>
            </div>

            {frame >= BEAT.thinkingStart && (
              <div
                style={{
                  display: "flex",
                  gap: 13,
                  alignItems: "center",
                  color: brand.slate500,
                  margin: "20px 0",
                  fontSize: 25,
                  ...lineIn(BEAT.thinkingStart),
                }}
              >
                <span
                  style={{
                    color: brand.clay,
                    display: "inline-block",
                    transform: `rotate(${frame * 5}deg)`,
                  }}
                >
                  ✻
                </span>
                <span>Reading PDF · finding signature anchors · preparing envelope</span>
              </div>
            )}

            {frame >= BEAT.toolStart && (
              <div style={{ margin: "20px 0", ...lineIn(BEAT.toolStart) }}>
                <div
                  style={{
                    border: `1px solid ${toolDone ? "#1f3a2a" : "#262d3a"}`,
                    background: toolDone ? "#0e1a13" : "#12151d",
                    borderRadius: 13,
                    padding: "20px 24px",
                    maxWidth: 1080,
                    boxShadow: toolDone ? "0 0 50px rgba(40,200,64,0.07)" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26 }}>
                    <span style={{ color: toolDone ? brand.trafficGreen : brand.blue, width: 22 }}>
                      {toolDone ? "✓" : "▸"}
                    </span>
                    <span style={{ color: brand.blue }}>{TOOL_NAME}</span>
                    <span style={{ color: brand.slate500, marginLeft: "auto" }}>
                      {toolDone ? "completed" : "running" + dots}
                    </span>
                  </div>
                  <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                    {TOOL_PARAMS.map(([k, v], i) => (
                      <div key={i} style={{ display: "flex", gap: 20, fontSize: 22 }}>
                        <span style={{ color: brand.slate500, minWidth: 130 }}>{k}</span>
                        <span style={{ color: brand.slate300 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {frame >= BEAT.resultStart && (
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  alignItems: "center",
                  color: brand.offwhite,
                  fontSize: 27,
                  ...lineIn(BEAT.resultStart),
                }}
              >
                <span style={{ color: brand.trafficGreen }}>✓</span>
                <span>{RESULT_TEXT}</span>
              </div>
            )}
          </div>
        </div>
      </AbsoluteFill>
      <Grain opacity={0.05} />
    </AbsoluteFill>
  );
};
