import { Audio, Series, interpolate, staticFile } from "remotion";
import { CursorOpen } from "./scenes/CursorOpen";
import { TerminalHeroV3 } from "./scenes/TerminalHeroV3";
import { NoMoreDragging } from "./scenes/NoMoreDragging";
import { WordSting } from "./fx/WordSting";
import { EmailPing } from "./scenes/EmailPing";
import { SealAudit } from "./scenes/SealAudit";
import { LogoCtaV2 } from "./scenes/LogoCtaV2";

// V7 — the hook IS the ask, brand-free: "send steve the nda" typed at human
// pace in the void; the terminal materializes around it and continues the
// same moment. Pure motion graphics. 120 BPM grid. Total 870f = 29s.
//
// Story order (Shahdad, v7 note): sender → client's journey → trust.
//   0-135   hook: "> send steve the nda" typing (4.5s)
// 135-345   terminal: same line carried over → MCP pill → "Sent." (7s)
// 345-405   sting: "Your client just got an email." (2s)
// 405-540   next page: It finds the fields itself. (4.5s)
// 540-660   the signature place: card, signature draws, ✓ signed (4s)
// 660-765   Fast. Secure. — seal + audit + webhook loop-close (3.5s)
// 765-870   animated wordmark CTA (3.5s)
export const TOTAL_FRAMES = 870;

export const Master = () => {
  return (
    <>
      <Audio
        src={staticFile("audio/beat-temp.wav")}
        volume={(f) =>
          interpolate(f, [0, 30, 810, 870], [0, 0.5, 0.5, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />
      <Series>
        <Series.Sequence durationInFrames={135}>
          <CursorOpen />
        </Series.Sequence>
        <Series.Sequence durationInFrames={210}>
          <TerminalHeroV3 />
        </Series.Sequence>
        <Series.Sequence durationInFrames={60}>
          <WordSting words="Your client just got an email." size={96} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={135}>
          <NoMoreDragging />
        </Series.Sequence>
        <Series.Sequence durationInFrames={120}>
          <EmailPing />
        </Series.Sequence>
        <Series.Sequence durationInFrames={105}>
          <SealAudit />
        </Series.Sequence>
        <Series.Sequence durationInFrames={105}>
          <LogoCtaV2 />
        </Series.Sequence>
      </Series>
    </>
  );
};
