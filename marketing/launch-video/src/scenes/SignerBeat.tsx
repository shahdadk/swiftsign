import {
  AbsoluteFill,
  OffthreadVideo,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { brand } from "../brand";
import { Grain } from "../fx/Grain";

// One BEAT of the real signer recording: oversized phone (fills frame height),
// cropped tight on the action, continuous push-in, editorial label on the left.
// Several of these cut together replace the old 16s static phone scene.
export const SignerBeat = ({
  startFrom,
  playbackRate = 2,
  label,
  focusY = 0.5, // 0 = top of phone in view, 1 = bottom
  zoom = 1.35, // how much the phone is oversized
}: {
  startFrom: number;
  playbackRate?: number;
  label?: string;
  focusY?: number;
  zoom?: number;
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const push = interpolate(frame, [0, durationInFrames], [zoom, zoom * 1.045]);
  const phoneH = 1080 * push;
  const phoneW = (1170 / 2532) * phoneH; // retina source aspect
  const travel = phoneH - 1080;
  const offsetY = -travel * focusY;

  const labelIn = interpolate(frame, [4, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const labelSlide = interpolate(frame, [4, 14], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: brand.ink, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          width: 1000,
          height: 640,
          left: "62%",
          top: "50%",
          transform: "translate(-50%,-50%)",
          borderRadius: "50%",
          background: brand.blue,
          opacity: 0.1,
          filter: "blur(160px)",
        }}
      />
      {/* phone, right-of-center, oversized, cropped by frame */}
      <div
        style={{
          position: "absolute",
          left: "58%",
          top: "50%",
          transform: `translate(-50%, -50%) translateY(${offsetY / 2}px)`,
          width: phoneW,
          height: phoneH,
          borderRadius: 54,
          border: "12px solid #181b22",
          overflow: "hidden",
          background: "#000",
          boxShadow: "0 60px 180px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
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
      {/* editorial label, left third */}
      {label && (
        <div
          style={{
            position: "absolute",
            left: 120,
            top: "44%",
            maxWidth: 560,
            opacity: labelIn,
            transform: `translateY(${labelSlide}px)`,
            color: brand.white,
            fontFamily: brand.font.sans,
            fontWeight: 700,
            fontSize: 76,
            lineHeight: 1.08,
            letterSpacing: "-0.03em",
            textShadow: "0 4px 40px rgba(0,0,0,0.7)",
          }}
        >
          {label}
        </div>
      )}
      <Grain opacity={0.05} />
    </AbsoluteFill>
  );
};
