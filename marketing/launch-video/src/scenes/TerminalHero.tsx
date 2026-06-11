import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { brand } from "../brand";

// Faithful recreation of the live swiftsign.ca landing terminal demo
// (src/components/landing/terminal-demo.tsx), re-authored as a deterministic,
// frame-driven Remotion timeline so it renders identically every time and
// never fumbles a keystroke. The hero of the launch video (~0:05-0:28).

const USER_TEXT =
  "send the NDA at ~/contracts/mutual-nda.pdf to steve@acme.com for signature";
const THINKING_TEXT =
  "Reading PDF · finding signature anchors · preparing envelope";
const TOOL_NAME = "swiftsign_send_envelope";
const TOOL_PARAMS: [string, string][] = [
  ["document", "~/contracts/mutual-nda.pdf"],
  ["recipient", "steve@acme.com"],
  ["fields[0]", "{ type: 'signature', anchor: '_____________' }"],
  ["fields[1]", "{ type: 'date', anchor: 'Date:' }"],
];
const RESULT_TEXT =
  "Envelope ss_3f8a…c21 sent. Steve will be notified at steve@acme.com.";
const ASSISTANT_TEXT =
  "Sent. Steve will get an email in a moment. I'll let you know when he signs.";

// Frame beats (30fps).
const BEAT = {
  windowIn: 0,
  userStart: 22,
  userSpeed: 1.7, // chars per frame
  thinkingStart: 78,
  toolStart: 128,
  toolDoneAt: 198,
  resultStart: 210,
  assistantStart: 230,
  assistantSpeed: 1.8,
};

const typed = (text: string, frame: number, start: number, speed: number) => {
  if (frame < start) return { shown: "", typing: false, started: false };
  const n = Math.min(Math.floor((frame - start) * speed), text.length);
  return { shown: text.slice(0, n), typing: n < text.length, started: true };
};

const Cursor = ({ on }: { on: boolean }) => (
  <span
    style={{
      display: "inline-block",
      width: 10,
      height: 22,
      marginLeft: 2,
      transform: "translateY(3px)",
      backgroundColor: on ? brand.blue : "transparent",
      borderRadius: 1,
    }}
  />
);

const ClaudeMark = ({ size = 14 }: { size?: number }) => (
  <span
    style={{
      color: brand.clay,
      fontSize: size,
      lineHeight: 1,
      display: "inline-block",
    }}
  >
    ✻
  </span>
);

const Line = ({
  start,
  children,
  style,
}: {
  start: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) => {
  const frame = useCurrentFrame();
  if (frame < start) return null;
  const o = interpolate(frame, [start, start + 8], [0, 1], {
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [start, start + 8], [6, 0], {
    extrapolateRight: "clamp",
  });
  return (
    <div style={{ opacity: o, transform: `translateY(${y}px)`, ...style }}>
      {children}
    </div>
  );
};

export const TerminalHero = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const winScale = spring({
    frame,
    fps,
    config: { damping: 200 },
    durationInFrames: 18,
  });
  const winOpacity = interpolate(frame, [0, 14], [0, 1], {
    extrapolateRight: "clamp",
  });

  const user = typed(USER_TEXT, frame, BEAT.userStart, BEAT.userSpeed);
  const assistant = typed(
    ASSISTANT_TEXT,
    frame,
    BEAT.assistantStart,
    BEAT.assistantSpeed,
  );

  const cursorOn = Math.floor(frame / 15) % 2 === 0;
  const toolRunning = frame >= BEAT.toolStart && frame < BEAT.toolDoneAt;
  const toolDone = frame >= BEAT.toolDoneAt;
  const dots = ".".repeat(
    Math.max(0, Math.floor((frame - BEAT.toolStart) / 10) % 4),
  );

  const mono = brand.font.mono;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(1200px 700px at 50% 38%, #14182100 0%, ${brand.ink} 70%), ${brand.ink}`,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: mono,
      }}
    >
      {/* soft brand glow */}
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 520,
          top: "26%",
          borderRadius: "50%",
          background: brand.blue,
          opacity: 0.1,
          filter: "blur(140px)",
        }}
      />

      <div
        style={{
          width: 1360,
          transform: `scale(${0.96 + winScale * 0.04})`,
          opacity: winOpacity,
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid #20242e",
          boxShadow:
            "0 40px 120px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.02)",
          background: "#0d0f13",
        }}
      >
        {/* chrome */}
        <div
          style={{
            height: 52,
            display: "flex",
            alignItems: "center",
            padding: "0 18px",
            gap: 14,
            background:
              "linear-gradient(180deg, #15181f 0%, #111319 100%)",
            borderBottom: "1px solid #1c2029",
          }}
        >
          <div style={{ display: "flex", gap: 9 }}>
            <span style={dot(brand.trafficRed)} />
            <span style={dot(brand.trafficYellow)} />
            <span style={dot(brand.trafficGreen)} />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: brand.slate300,
              fontSize: 17,
            }}
          >
            <ClaudeMark size={14} />
            <span style={{ color: brand.offwhite }}>claude</span>
            <span style={{ color: brand.slate500 }}>—</span>
            <span style={{ color: brand.slate500 }}>~/projects/acme-legal</span>
          </div>
          <div style={{ flex: 1 }} />
          <div
            style={{
              fontSize: 14,
              color: brand.slate300,
              background: "#181c24",
              border: "1px solid #242a35",
              padding: "4px 11px",
              borderRadius: 7,
            }}
          >
            claude-opus-4.8
          </div>
        </div>

        {/* body */}
        <div
          style={{
            padding: "30px 34px 26px",
            minHeight: 540,
            fontSize: 22,
            lineHeight: 1.65,
          }}
        >
          {/* user */}
          <Line start={BEAT.userStart} style={{ display: "flex", gap: 12 }}>
            <span style={{ color: brand.blue, fontWeight: 700 }}>&gt;</span>
            <span style={{ color: brand.offwhite }}>
              {user.shown}
              {user.typing && <Cursor on={cursorOn} />}
            </span>
          </Line>

          {/* thinking */}
          <Line
            start={BEAT.thinkingStart}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              color: brand.slate500,
              margin: "14px 0",
              fontSize: 19,
            }}
          >
            <span
              style={{
                color: brand.clay,
                display: "inline-block",
                transform: `rotate(${frame * 4}deg)`,
              }}
            >
              ✻
            </span>
            <span>{THINKING_TEXT}</span>
          </Line>

          {/* tool pill */}
          <Line start={BEAT.toolStart} style={{ margin: "14px 0" }}>
            <div
              style={{
                border: `1px solid ${toolDone ? "#1f3a2a" : "#242a35"}`,
                background: toolDone ? "#0e1a13" : "#11141b",
                borderRadius: 10,
                padding: "13px 16px",
                maxWidth: 760,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 18,
                }}
              >
                <span
                  style={{
                    color: toolDone ? brand.trafficGreen : brand.blue,
                    width: 16,
                  }}
                >
                  {toolDone ? "✓" : "▸"}
                </span>
                <span style={{ color: brand.blue }}>{TOOL_NAME}</span>
                <span style={{ color: brand.slate500, marginLeft: "auto" }}>
                  {toolDone ? "completed" : "running" + dots}
                </span>
              </div>
              <div style={{ marginTop: 10, display: "grid", gap: 5 }}>
                {TOOL_PARAMS.map(([k, v], i) => (
                  <div key={i} style={{ display: "flex", gap: 14, fontSize: 16 }}>
                    <span style={{ color: brand.slate500, minWidth: 96 }}>
                      {k}
                    </span>
                    <span style={{ color: brand.slate300 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </Line>

          {/* result */}
          <Line
            start={BEAT.resultStart}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              color: brand.slate300,
              margin: "14px 0",
              fontSize: 19,
            }}
          >
            <span style={{ color: brand.trafficGreen }}>✓</span>
            <span>{RESULT_TEXT}</span>
          </Line>

          {/* assistant */}
          <Line start={BEAT.assistantStart} style={{ display: "flex", gap: 12 }}>
            <span style={{ transform: "translateY(2px)" }}>
              <ClaudeMark size={16} />
            </span>
            <span style={{ color: brand.offwhite }}>
              {assistant.shown}
              {assistant.typing && <Cursor on={cursorOn} />}
            </span>
          </Line>
        </div>

        {/* footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "12px 18px",
            borderTop: "1px solid #1c2029",
            color: brand.slate500,
            fontSize: 14,
            background: "#0b0d11",
          }}
        >
          <span>
            <kbd style={kbd}>esc</kbd> interrupt&nbsp;&nbsp;&nbsp;
            <kbd style={kbd}>⏎</kbd> send
          </span>
          <span>swiftsign · sealed with ESIGN / UETA / PIPEDA audit trail</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const dot = (c: string): React.CSSProperties => ({
  width: 13,
  height: 13,
  borderRadius: "50%",
  backgroundColor: c,
  display: "inline-block",
});

const kbd: React.CSSProperties = {
  background: "#181c24",
  border: "1px solid #242a35",
  borderRadius: 5,
  padding: "1px 7px",
  color: brand.slate300,
  fontSize: 13,
};
