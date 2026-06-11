import {
  AbsoluteFill,
  OffthreadVideo,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { brand } from "../brand";

// B-roll player: fills the frame, strips generated audio (VO + music own the
// soundtrack), fades in/out, and applies a subtle unifying grade so AI clips
// sit next to real screen captures without a visible seam (the "LUT pass").
export const Broll = ({
  src,
  caption,
  fadeFrames = 10,
  startFrom = 0,
}: {
  src: string;
  caption?: string;
  fadeFrames?: number;
  startFrom?: number;
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = interpolate(
    frame,
    [0, fadeFrames, durationInFrames - fadeFrames, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const captionIn = interpolate(frame, [12, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const captionLift = interpolate(frame, [12, 30], [14, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: brand.ink, opacity }}>
      <OffthreadVideo
        src={staticFile(src)}
        muted
        startFrom={startFrom}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
      {/* unifying grade: cool navy lift + gentle vignette */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, transparent 55%, ${brand.ink}cc 130%)`,
          mixBlendMode: "multiply",
        }}
      />
      <AbsoluteFill
        style={{ backgroundColor: "#0a1430", opacity: 0.12, mixBlendMode: "overlay" }}
      />
      {caption && (
        <AbsoluteFill
          style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 110 }}
        >
          <div
            style={{
              opacity: captionIn,
              transform: `translateY(${captionLift}px)`,
              color: brand.white,
              fontFamily: brand.font.sans,
              fontSize: 46,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              textShadow: "0 2px 24px rgba(0,0,0,0.65)",
              textAlign: "center",
              maxWidth: 1300,
            }}
          >
            {caption}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
