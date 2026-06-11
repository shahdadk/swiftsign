// v3: true-retina capture of the signer flow via CDP screencast.
// Playwright's recordVideo does NOT upscale (390px page on gray canvas — v2
// lesson). CDP Page.startScreencast captures the compositor surface at
// physical pixels (dsf=3 → 1170x2532). Frames + timestamps → ffmpeg concat.
import { chromium } from "playwright-core";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const URL = process.argv[2];
if (!URL) {
  console.error("usage: node capture-signer-v3.mjs <signing-url>");
  process.exit(1);
}

const OUT = "/Users/shahdad/Documents/Claude/Projects/Appfi/products/swiftsign/marketing/launch-video/assets/signer";
const FRAMES = `${OUT}/frames`;
fs.rmSync(FRAMES, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });

const cache = `${process.env.HOME}/Library/Caches/ms-playwright`;
const builds = fs.readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort();
const exe = `${cache}/${builds[builds.length - 1]}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

const browser = await chromium.launch({ executablePath: exe, headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
});
const page = await ctx.newPage();
const pause = (ms) => page.waitForTimeout(ms);

// --- screencast plumbing ---
const cdp = await ctx.newCDPSession(page);
const frames = []; // { idx, ts }
let idx = 0;
const t0 = Date.now();
const mark = (name) => console.log(`STEP ${((Date.now() - t0) / 1000).toFixed(2)}s ${name}`);
cdp.on("Page.screencastFrame", async ({ data, sessionId, metadata }) => {
  const i = idx++;
  fs.writeFileSync(`${FRAMES}/f${String(i).padStart(5, "0")}.jpg`, Buffer.from(data, "base64"));
  frames.push({ i, ts: metadata.timestamp });
  try {
    await cdp.send("Page.screencastFrameAck", { sessionId });
  } catch {}
});
await cdp.send("Page.startScreencast", {
  format: "jpeg",
  quality: 92,
  maxWidth: 1170,
  maxHeight: 2532,
  everyNthFrame: 1,
});

try {
  await page.goto(URL, { waitUntil: "networkidle" });
  mark("loaded");
  await pause(1500);

  const agree = page.getByRole("button", { name: "I Agree" });
  if (await agree.isVisible().catch(() => false)) {
    await pause(600);
    mark("consent-click");
    await agree.click();
    await pause(1800);
  }
  mark("document-visible");
  await pause(1200);

  const signHere = page.getByText("Sign here");
  if (await signHere.isVisible().catch(() => false)) {
    await signHere.scrollIntoViewIfNeeded();
    await pause(500);
    mark("open-sign-modal");
    await signHere.click();
    await pause(900);
    await page.getByRole("button", { name: "type", exact: true }).click();
    await pause(500);
    mark("typing-signature");
    const box = page.getByRole("textbox", { name: /type your signature/i });
    await box.pressSequentially("Steve Park", { delay: 110 });
    await pause(900);
    mark("adopt-click");
    await page.getByRole("button", { name: "Adopt and Sign" }).click();
    await pause(1600);
  }

  const values = ["VP Operations", "steve@acme.com"];
  const emptyBox = async () => {
    const all = page.getByRole("textbox");
    const count = await all.count();
    for (let j = 0; j < count; j++) {
      const v = await all.nth(j).inputValue().catch(() => null);
      if (v === "") return all.nth(j);
    }
    return null;
  };
  mark("fill-fields");
  for (const v of values) {
    const target = await emptyBox();
    if (!target) break;
    await target.scrollIntoViewIfNeeded({ timeout: 10000 }).catch(() => {});
    await pause(350);
    await target.click({ timeout: 10000 });
    await target.pressSequentially(v, { delay: 70 });
    await pause(350);
    await page.keyboard.press("Tab");
    await pause(400);
  }

  mark("complete-click");
  const complete = page.getByRole("button", { name: "Complete Signing" });
  await complete.scrollIntoViewIfNeeded({ timeout: 10000 }).catch(() => {});
  for (let i = 0; i < 40; i++) {
    if (await complete.isEnabled().catch(() => false)) break;
    await pause(300);
  }
  await pause(500);
  await complete.click({ timeout: 15000 });
  await pause(1000);
  const confirm = page.getByRole("button", { name: "Sign and Complete" });
  if (await confirm.isVisible().catch(() => false)) {
    mark("confirm-click");
    await confirm.click({ timeout: 15000 });
  }
  await pause(2500);
  mark("signing-complete");
  await pause(4500);
} finally {
  await cdp.send("Page.stopScreencast").catch(() => {});
  await pause(300);
  await ctx.close();
  await browser.close();
}

// --- assemble variable-timestamp frames into CFR 30fps mp4 ---
if (frames.length < 10) {
  console.error("too few frames:", frames.length);
  process.exit(1);
}
const list = [];
for (let k = 0; k < frames.length; k++) {
  const dur = k < frames.length - 1 ? frames[k + 1].ts - frames[k].ts : 1 / 15;
  list.push(`file 'frames/f${String(frames[k].i).padStart(5, "0")}.jpg'`);
  list.push(`duration ${Math.max(dur, 0.01).toFixed(4)}`);
}
list.push(`file 'frames/f${String(frames[frames.length - 1].i).padStart(5, "0")}.jpg'`);
fs.writeFileSync(`${OUT}/concat.txt`, list.join("\n"));
execFileSync("ffmpeg", [
  "-y", "-v", "error",
  "-f", "concat", "-safe", "0", "-i", `${OUT}/concat.txt`,
  "-vf", "scale=1170:2532:flags=lanczos,fps=30",
  "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p",
  `${OUT}/signer-flow.mp4`,
], { cwd: OUT });
console.log("frames:", frames.length, "→ signer-flow.mp4");
