import {
  AbsoluteFill,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { brand } from "../brand";

// The real production signer recording (390x844) inside a minimal phone frame,
// floating on the brand ink background. startFrom trims to the best beats.
export const SignerPhone = ({
  startFrom,
  playbackRate = 1.6,
  caption,
}: {
  startFrom: number;
  playbackRate?: number;
  caption?: string;
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const entry = spring({ frame, fps, config: { damping: 100, stiffness: 120 } });
  const exit = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const drift = interpolate(frame, [0, durationInFrames], [6, -6]);

  // phone: 390x844 content scaled to ~76% of 1080 height
  const phoneH = 820;
  const phoneW = (390 / 844) * phoneH;

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
          width: 900,
          height: 560,
          borderRadius: "50%",
          background: brand.blue,
          opacity: 0.1,
          filter: "blur(150px)",
        }}
      />
      <div
        style={{
          width: phoneW,
          height: phoneH,
          transform: `translateY(${(1 - entry) * 60 + drift}px) scale(${0.96 + entry * 0.04})`,
          borderRadius: 44,
          border: "10px solid #1a1d24",
          boxShadow:
            "0 50px 140px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04), inset 0 0 0 2px #000",
          overflow: "hidden",
          backgroundColor: "#000",
        }}
      >
        <OffthreadVideo
          src={staticFile("signer/signer-flow.mp4")}
          muted
          startFrom={startFrom}
          playbackRate={playbackRate}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
      {caption && (
        <div
          style={{
            position: "absolute",
            bottom: 64,
            color: brand.white,
            fontFamily: brand.font.sans,
            fontSize: 44,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            textShadow: "0 2px 24px rgba(0,0,0,0.65)",
          }}
        >
          {caption}
        </div>
      )}
    </AbsoluteFill>
  );
};
