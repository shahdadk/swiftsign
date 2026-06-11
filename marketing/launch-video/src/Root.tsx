import { Composition } from "remotion";
import { Hello } from "./scenes/Hello";
import { TerminalHero } from "./scenes/TerminalHero";
import { Master, TOTAL_FRAMES } from "./Master";

const FPS = 30;
const MASTER_FRAMES = TOTAL_FRAMES; // 1095 = 36.5s, beat-grid locked

// The master timeline grows scene by scene. For now it renders the brand
// title card so the toolchain (render -> ffmpeg -> mp4) is proven end to end.
export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="LaunchMaster"
        component={Master}
        durationInFrames={MASTER_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="LaunchVertical"
        component={Hello}
        durationInFrames={FPS * 80}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="TerminalHero"
        component={TerminalHero}
        durationInFrames={FPS * 18}
        fps={FPS}
        width={1920}
        height={1080}
      />
    </>
  );
};
