import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { brand } from "../brand";
import { Stage, Window, Chrome } from "../fx/Stage";

// Premium pass: window fills ~88% of frame width on the surface ladder,
// rotateX tilt easing to flat (the "floating object" entrance), glow halo,
// continuous push-in. Content unchanged: ask → swiftsign MCP pill → "Sent."
const USER_TEXT = "send steve the nda";
const ASSISTANT_TEXT = "Sent. Steve just got the signing link.";

const BEAT = {
  pillStart: 26,
  pillDoneAt: 86,
  assistantStart: 98,
  assistantSpeed: 1.6,
};

export const TerminalHeroV3 = () => {
  const frame = useCurrentFrame();

  const cam = interpolate(frame, [0, 210], [1.0, 1.055]);
  // window arrives tilted, settles flat in the first second
  const tilt = interpolate(frame, [0, 34], [9, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const arrive = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const assistantChars = Math.min(
    Math.max(0, Math.floor((frame - BEAT.assistantStart) * BEAT.assistantSpeed)),
    ASSISTANT_TEXT.length,
  );
  const assistant = ASSISTANT_TEXT.slice(0, assistantChars);
  const cursorOn = Math.floor(frame / 14) % 2 === 0;
  const pillDone = frame >= BEAT.pillDoneAt;
  const dots = ".".repeat(Math.max(0, Math.floor((frame - BEAT.pillStart) / 9) % 4));

  const lineIn = (start: number): React.CSSProperties => ({
    opacity: interpolate(frame, [start, start + 7], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
    transform: `translateY(${interpolate(frame, [start, start + 7], [12, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })}px)`,
  });

  return (
    <Stage glow={0.3}>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          transform: `scale(${cam})`,
          opacity: arrive,
          fontFamily: brand.font.mono,
        }}
      >
        <Window width={1700} tilt={tilt} radius={18}>
          <Chrome
            title={
              <div style={{ display: "flex", gap: 10, color: brand.slate300, fontSize: 20 }}>
                <span style={{ color: brand.clay }}>✻</span>
                <span style={{ color: brand.offwhite }}>claude</span>
              </div>
            }
          />
          <div style={{ padding: "60px 70px 56px", minHeight: 540, fontSize: 40, lineHeight: 1.6 }}>
            {/* the ask — carried over from the opener, already typed */}
            <div style={{ display: "flex", gap: 24 }}>
              <span style={{ color: brand.blue, fontWeight: 700 }}>&gt;</span>
              <span style={{ color: brand.offwhite }}>{USER_TEXT}</span>
            </div>

            {/* swiftsign MCP pill — the proof moment, with a glow bloom on completion */}
            {frame >= BEAT.pillStart && (
              <div style={{ margin: "44px 0 0 46px", ...lineIn(BEAT.pillStart) }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 18,
                    fontSize: 32,
                    padding: "18px 30px",
                    borderRadius: 13,
                    border: `1px solid ${pillDone ? "rgba(40,200,64,0.35)" : brand.borderSoft}`,
                    background: pillDone
                      ? "linear-gradient(180deg, #0f2017 0%, #0b1710 100%)"
                      : `linear-gradient(180deg, ${brand.surface3} 0%, ${brand.surface1} 100%)`,
                    boxShadow: pillDone
                      ? `inset 0 1px 0 rgba(255,255,255,0.1), 0 0 80px ${brand.greenGlow}`
                      : `inset 0 1px 0 ${brand.topEdge}`,
                  }}
                >
                  <span style={{ color: pillDone ? brand.trafficGreen : brand.blue }}>
                    {pillDone ? "✓" : "▸"}
                  </span>
                  <span style={{ color: brand.blue, fontWeight: 700 }}>swiftsign</span>
                  <span style={{ color: brand.slate500 }}>MCP</span>
                  <span style={{ color: brand.slate500 }}>
                    {pillDone ? "envelope sent" : "sending" + dots}
                  </span>
                </div>
              </div>
            )}

            {/* confirmation */}
            {frame >= BEAT.assistantStart && (
              <div style={{ display: "flex", gap: 24, marginTop: 44, ...lineIn(BEAT.assistantStart) }}>
                <span style={{ color: brand.clay, transform: "translateY(3px)" }}>✻</span>
                <span style={{ color: brand.offwhite }}>
                  {assistant}
                  {assistantChars < ASSISTANT_TEXT.length && (
                    <span
                      style={{
                        display: "inline-block",
                        width: 17,
                        height: 40,
                        marginLeft: 4,
                        transform: "translateY(5px)",
                        backgroundColor: cursorOn ? brand.blue : "transparent",
                        borderRadius: 2,
                      }}
                    />
                  )}
                </span>
              </div>
            )}
          </div>
        </Window>
      </AbsoluteFill>
    </Stage>
  );
};
