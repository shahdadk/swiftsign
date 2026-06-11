import { brand } from "../brand";

// Premium display type rules (Linear ramp): weight 600 (never 700+ on display),
// negative tracking scaled by size, white→grey vertical gradient fill.
export const displayType = (size: number): React.CSSProperties => ({
  fontFamily: brand.font.sans,
  fontWeight: 600,
  fontSize: size,
  lineHeight: 1.06,
  letterSpacing: `${-(size * 0.0375)}px`, // -3px @ 80px, scales linearly
  background: "linear-gradient(180deg, #ffffff 0%, #b9bdc9 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
});

// eyebrow/label: small, uppercase, positive tracking
export const eyebrowType: React.CSSProperties = {
  fontFamily: brand.font.sans,
  fontWeight: 500,
  fontSize: 22,
  letterSpacing: "2.5px",
  textTransform: "uppercase",
  color: brand.slate500,
};
