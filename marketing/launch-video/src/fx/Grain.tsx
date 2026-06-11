import { AbsoluteFill, useCurrentFrame } from "remotion";

// Fine film grain overlay — the unifier between AI footage and UI captures.
// SVG turbulence tiled and jittered per frame. Low opacity, overlay blend.
const NOISE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix type='saturate' values='0'/></filter><rect width='300' height='300' filter='url(#n)'/></svg>`,
  );

export const Grain = ({ opacity = 0.06 }: { opacity?: number }) => {
  const frame = useCurrentFrame();
  const x = (frame * 97) % 300;
  const y = (frame * 53) % 300;
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url("${NOISE}")`,
        backgroundPosition: `${x}px ${y}px`,
        opacity,
        mixBlendMode: "overlay",
        pointerEvents: "none",
      }}
    />
  );
};
