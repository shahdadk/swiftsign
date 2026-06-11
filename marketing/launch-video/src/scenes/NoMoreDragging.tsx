import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { Stage } from "../fx/Stage";
import { displayType } from "../fx/type";

// The landing page's sharpest selling point, as a video beat.
// Left: the old way — a cursor pixel-hunting a Signature box (jittery, misaligned).
// Right: NO instruction at all — SwiftSign reads the document and finds the
// anchors itself. The smartness IS the product (Shahdad's note, v5).
// Then the left side dims and the right side wins the frame.

export const NoMoreDragging = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const cam = interpolate(frame, [0, durationInFrames], [1.0, 1.04]);

  // ----- left: dragging struggle (loops a jittery move + misalign) -----
  const t = frame % 90;
  const dragX = interpolate(t, [0, 30, 45, 70, 90], [30, 150, 142, 148, 145]);
  const dragY = interpolate(t, [0, 30, 45, 70, 90], [40, 168, 150, 162, 158]);
  const misaligned = t > 30 && t < 70;

  // ----- right: autonomous anchor-finding, zero instruction -----
  const scanStart = 12; // "reading mutual-nda.pdf" appears
  const scanY = interpolate(frame, [scanStart + 6, 64], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }); // a scanline sweeps the mini PDF
  const sigFound = frame >= 56;
  const dateFound = frame >= 70;
  const snap = spring({ frame: frame - 58, fps, config: { damping: 200 } });
  const snapDate = spring({ frame: frame - 72, fps, config: { damping: 200 } });
  // left side loses once the right wins
  const leftDim = interpolate(frame, [88, 108], [1, 0.28], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headIn = (start: number) => ({
    opacity: interpolate(frame, [start, start + 8], [0, 1], {
      extrapolateLeft: "clamp" as const,
      extrapolateRight: "clamp" as const,
    }),
  });

  const card: React.CSSProperties = {
    width: 820,
    height: 590,
    borderRadius: 16,
    border: `1px solid ${brand.borderSoft}`,
    background: brand.surface1,
    overflow: "hidden",
    boxShadow: `inset 0 1px 0 ${brand.topEdge}, 0 40px 90px -20px rgba(0,0,0,0.65)`,
  };

  const pdf: React.CSSProperties = {
    margin: "26px auto",
    width: 560,
    height: 380,
    borderRadius: 8,
    background: "#f4f5f7",
    position: "relative",
    padding: 28,
  };

  const pdfLine = (w: number, i: number): React.CSSProperties => ({
    height: 9,
    width: `${w}%`,
    borderRadius: 4,
    background: "#d7dae0",
    marginBottom: 11,
  });

  return (
    <Stage glow={0.24}>
      <AbsoluteFill style={{ fontFamily: brand.font.sans, justifyContent: "center", alignItems: "center", transform: `scale(${cam})` }}>
        <div
          style={{
            ...headIn(0),
            position: "absolute",
            top: 74,
            ...displayType(92),
          }}
        >
          It finds the fields itself.
        </div>

        <div style={{ display: "flex", gap: 44, marginTop: 90 }}>
          {/* OLD WAY */}
          <div style={{ ...card, opacity: leftDim }}>
            <div
              style={{
                padding: "16px 24px",
                color: brand.slate500,
                fontFamily: brand.font.mono,
                fontSize: 21,
                borderBottom: `1px solid ${brand.borderSoft}`,
              }}
            >
              <span style={{ color: "#e5484d" }}>●</span>&nbsp; the old way
            </div>
            <div style={pdf}>
              {[78, 92, 85, 70, 88, 64].map((w, i) => (
                <div key={i} style={pdfLine(w, i)} />
              ))}
              <div style={{ ...pdfLine(40, 9), marginTop: 60 }} />
              {/* the dragged box */}
              <div
                style={{
                  position: "absolute",
                  left: dragX,
                  top: dragY + 120,
                  width: 200,
                  height: 46,
                  border: `2px dashed ${misaligned ? "#e5484d" : brand.blue}`,
                  background: "rgba(43,92,255,0.07)",
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: misaligned ? "#e5484d" : brand.blue,
                  fontFamily: brand.font.mono,
                  fontSize: 17,
                  transform: misaligned ? "rotate(-1.6deg)" : "none",
                }}
              >
                Signature ⋮⋮
              </div>
              {/* the cursor */}
              <svg
                width="22"
                height="27"
                viewBox="0 0 18 22"
                style={{ position: "absolute", left: dragX + 150, top: dragY + 140 }}
              >
                <path
                  d="M2 1.5v16l4.5-4h8L2 1.5Z"
                  fill="#0a0b0d"
                  stroke="#fff"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div
              style={{
                textAlign: "center",
                color: brand.slate500,
                fontFamily: brand.font.mono,
                fontSize: 19,
              }}
            >
              x: {Math.round(dragX)} &nbsp; y: {Math.round(dragY)} &nbsp;{" "}
              {misaligned ? "misaligned…" : "moving…"}
            </div>
          </div>

          {/* NEW WAY — no instruction. It reads the doc and finds the spots itself. */}
          <div style={card}>
            <div
              style={{
                padding: "16px 24px",
                color: brand.slate500,
                fontFamily: brand.font.mono,
                fontSize: 21,
                borderBottom: `1px solid ${brand.borderSoft}`,
              }}
            >
              <span style={{ color: brand.trafficGreen }}>●</span>&nbsp; swiftsign just knows
            </div>
            <div style={{ padding: "22px 32px 0", fontFamily: brand.font.mono, fontSize: 23 }}>
              <div style={{ color: brand.slate300, ...headIn(scanStart) }}>
                <span style={{ color: brand.clay }}>✻</span> reading mutual-nda.pdf
                <span style={{ color: brand.slate500 }}>
                  {" "}
                  · finding signature anchors{".".repeat(Math.max(0, Math.floor(frame / 10) % 4))}
                </span>
              </div>
              <div style={{ color: brand.trafficGreen, fontSize: 21, marginTop: 10, ...headIn(56) }}>
                ✓ signature → p.2 &nbsp;{dateFound ? "✓ date → p.2" : ""}
              </div>
            </div>
            <div style={{ ...pdf, height: 290, marginTop: 16, overflow: "hidden" }}>
              {[78, 92, 85, 64].map((w, i) => (
                <div key={i} style={pdfLine(w, i)} />
              ))}
              <div style={{ ...pdfLine(40, 9), marginTop: 40 }} />
              {/* the scanline sweeping the document */}
              {frame >= scanStart + 6 && scanY < 100 && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: `${scanY}%`,
                    height: 56,
                    background: `linear-gradient(180deg, transparent, ${brand.blue}26, transparent)`,
                    borderTop: `1px solid ${brand.blue}55`,
                  }}
                />
              )}
              {/* signature field snaps itself in */}
              {sigFound && (
                <div
                  style={{
                    position: "absolute",
                    left: 84,
                    top: 188,
                    width: 215,
                    height: 46,
                    borderRadius: 6,
                    border: `2px solid ${brand.trafficGreen}`,
                    background: "rgba(40,200,64,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#168f3e",
                    fontFamily: brand.font.mono,
                    fontSize: 17,
                    fontWeight: 700,
                    transform: `scale(${0.7 + snap * 0.3})`,
                    boxShadow: "0 0 40px rgba(40,200,64,0.25)",
                  }}
                >
                  signature ✓
                </div>
              )}
              {/* date field snaps in right after */}
              {dateFound && (
                <div
                  style={{
                    position: "absolute",
                    left: 330,
                    top: 188,
                    width: 130,
                    height: 46,
                    borderRadius: 6,
                    border: `2px solid ${brand.trafficGreen}`,
                    background: "rgba(40,200,64,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#168f3e",
                    fontFamily: brand.font.mono,
                    fontSize: 17,
                    fontWeight: 700,
                    transform: `scale(${0.7 + snapDate * 0.3})`,
                    boxShadow: "0 0 40px rgba(40,200,64,0.25)",
                  }}
                >
                  date ✓
                </div>
              )}
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </Stage>
  );
};
