import { AbsoluteFill, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { Grain } from "../fx/Grain";
import { WordSting } from "../fx/WordSting";

// Full-bleed cinematic b-roll: letterboxed 2.39:1, continuous push-in
// (1.00->1.04), unified grade (navy lift + vignette + grain). Optional
// kinetic type overlay. Nothing static, ever.
const BAR = 138; // (1080 - 1920/2.39) / 2

export const CinematicClip = ({
  src,
  startFrom = 0,
  sting,
  stingSize = 112,
  zoomFrom = 1.0,
  zoomTo = 1.05,
}: {
  src: string;
  startFrom?: number;
  sting?: string;
  stingSize?: number;
  zoomFrom?: number;
  zoomTo?: number;
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [zoomFrom, zoomTo]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>
        <OffthreadVideo
          src={staticFile(src)}
          muted
          startFrom={startFrom}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>
      {/* unified grade */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, transparent 50%, ${brand.ink}d9 135%)`,
          mixBlendMode: "multiply",
        }}
      />
      <AbsoluteFill
        style={{ backgroundColor: "#0a1430", opacity: 0.14, mixBlendMode: "overlay" }}
      />
      <Grain opacity={0.07} />
      {/* letterbox 2.39:1 */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: BAR, background: "#000" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: BAR, background: "#000" }} />
      {sting && <WordSting words={sting} size={stingSize} overlay startAt={4} />}
    </AbsoluteFill>
  );
};
