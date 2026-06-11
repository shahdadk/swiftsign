import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { Stage } from "../fx/Stage";

// The hook: the actual ask, typed at human pace in the void.
// "send steve the nda" — five words, lowercase, unhurried. No brand names;
// just a person asking and the thing happening.
// Beat 1: cursor alone, blinking twice (breathing room).
// Beat 2: the line types like a person typing, micro-pause after "steve".
// Beat 3: short hold; the terminal scene picks it up from here.
const LINE = "send steve the nda";
const PAUSE_AFTER = LINE.indexOf("steve") + "steve".length; // breathe mid-thought

export const CursorOpen = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // human typing: ~1 char per 2.8 frames, with a 12-frame pause mid-thought
  const typeStart = 34;
  const charsRaw = (frame - typeStart) / 2.8;
  const pauseChars = 12 / 2.8;
  const chars =
    charsRaw <= PAUSE_AFTER
      ? charsRaw
      : Math.max(PAUSE_AFTER, charsRaw - pauseChars);
  const shown = LINE.slice(0, Math.min(Math.max(0, Math.floor(chars)), LINE.length));
  const done = shown.length >= LINE.length;
  const cursorOn = Math.floor(frame / 16) % 2 === 0;

  const cam = interpolate(frame, [0, durationInFrames], [1.0, 1.045]);
  const glow = interpolate(frame, [typeStart, typeStart + 70], [0.04, 0.13], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exit = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <Stage glow={0.06 + glow}>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: exit,
        }}
      >
        <div
          style={{
            transform: `scale(${cam})`,
            fontFamily: brand.font.mono,
            fontWeight: 600,
            fontSize: 76,
            letterSpacing: "-1.4px",
            whiteSpace: "nowrap",
            background: "linear-gradient(180deg, #ffffff 0%, #b9bdc9 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          <span
            style={{
              color: brand.blue,
              WebkitTextFillColor: brand.blue,
              marginRight: 26,
              fontWeight: 700,
            }}
          >
            &gt;
          </span>
          {shown}
          <span
            style={{
              display: "inline-block",
              width: 30,
              height: 76,
              marginLeft: 8,
              transform: "translateY(9px)",
              backgroundColor: cursorOn || !done ? brand.blue : "transparent",
              borderRadius: 4,
              boxShadow: cursorOn ? `0 0 36px ${brand.blueGlow}` : "none",
            }}
          />
        </div>
      </AbsoluteFill>
    </Stage>
  );
};
