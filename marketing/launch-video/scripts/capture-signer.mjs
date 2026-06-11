// Records the real SwiftSign signer flow at iPhone size, with video.
// Drives production with the demo envelope's signing token. Slow, deliberate
// pacing so the recording reads well in the launch cut.
import { chromium } from "playwright-core";
import fs from "node:fs";

const URL = process.argv[2];
if (!URL) {
  console.error("usage: node capture-signer.mjs <signing-url>");
  process.exit(1);
}

const OUT = "/Users/shahdad/Documents/Claude/Projects/Appfi/products/swiftsign/marketing/launch-video/assets/signer";
fs.mkdirSync(OUT, { recursive: true });

// Find an installed chromium build from the MCP cache.
const cache = `${process.env.HOME}/Library/Caches/ms-playwright`;
const builds = fs.readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort();
const latest = builds[builds.length - 1];
const exe = `${cache}/${latest}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

const browser = await chromium.launch({ executablePath: exe, headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3, // crisp retina recording
  // record at FULL retina pixels — recording at 390x844 threw away 9x the
  // resolution and made zoomed beats blurry (v2 lesson)
  recordVideo: { dir: OUT, size: { width: 1170, height: 2532 } },
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
});
const page = await ctx.newPage();
const pause = (ms) => page.waitForTimeout(ms);

try {
  await page.goto(URL, { waitUntil: "networkidle" });
  await pause(1500);
  await page.screenshot({ path: `${OUT}/01-consent.png` });

  const agree = page.getByRole("button", { name: "I Agree" });
  if (await agree.isVisible().catch(() => false)) {
    await pause(800);
    await agree.click();
    await pause(1800);
  }
  await page.screenshot({ path: `${OUT}/02-document.png` });

  // open signature modal
  const signHere = page.getByText("Sign here");
  if (await signHere.isVisible().catch(() => false)) {
    console.log("step: open signature modal");
    await signHere.scrollIntoViewIfNeeded();
    await pause(600);
    await signHere.click();
    await pause(1000);
    await page.getByRole("button", { name: "type", exact: true }).click();
    await pause(600);
    const box = page.getByRole("textbox", { name: /type your signature/i });
    await box.pressSequentially("Steve Park", { delay: 90 }); // visible typing
    await pause(900);
    await page.screenshot({ path: `${OUT}/03-adopt.png` });
    console.log("step: adopt and sign");
    await page.getByRole("button", { name: "Adopt and Sign" }).click();
    await pause(2000);
  }

  // remaining text fields: Title, Email. The "Type here" accessible name is an
  // aria-label that persists after typing, so placeholder-based re-query hits
  // the SAME box twice (caught on run 2: both values concatenated in one field).
  // Target by VALUE instead: always fill the first currently-empty textbox.
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
  for (const v of values) {
    const target = await emptyBox();
    if (!target) break;
    await target.scrollIntoViewIfNeeded({ timeout: 10000 }).catch(() => {});
    await pause(400);
    await target.click({ timeout: 10000 });
    await target.pressSequentially(v, { delay: 60 });
    await pause(400);
    await page.keyboard.press("Tab"); // blur to commit
    await pause(500);
  }
  // verify every textbox holds a value; log state for debugging
  {
    const all = page.getByRole("textbox");
    const count = await all.count();
    for (let j = 0; j < count; j++) {
      const v = await all.nth(j).inputValue().catch(() => null);
      console.log(`textbox[${j}] = ${JSON.stringify(v)}`);
    }
  }
  await page.screenshot({ path: `${OUT}/04-filled.png` });

  console.log("step: complete signing");
  const complete = page.getByRole("button", { name: "Complete Signing" });
  await complete.scrollIntoViewIfNeeded({ timeout: 10000 }).catch(() => {});
  for (let i = 0; i < 40; i++) {
    if (await complete.isEnabled().catch(() => false)) break;
    await pause(300);
  }
  await pause(700);
  await complete.click({ timeout: 15000 });
  await pause(1200);
  // confirmation modal: "Once signed, this cannot be undone."
  const confirm = page.getByRole("button", { name: "Sign and Complete" });
  if (await confirm.isVisible().catch(() => false)) {
    console.log("step: confirm sign and complete");
    await page.screenshot({ path: `${OUT}/05-confirm.png` });
    await confirm.click({ timeout: 15000 });
  }
  // sealing takes a few seconds server-side; record the completion state
  await pause(10000);
  await page.screenshot({ path: `${OUT}/06-done.png` });
  console.log("final url:", page.url());
} finally {
  await ctx.close(); // flushes the video
  await browser.close();
}

// rename the random-named video
const vids = fs.readdirSync(OUT).filter((f) => f.endsWith(".webm"));
if (vids.length) {
  fs.renameSync(`${OUT}/${vids[0]}`, `${OUT}/signer-flow.webm`);
  console.log("video: signer-flow.webm");
}
console.log("done");
