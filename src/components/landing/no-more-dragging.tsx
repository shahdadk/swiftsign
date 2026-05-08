"use client";

import { useEffect, useState } from "react";
import { Anchor, Check, Claude } from "./icons";

function OldWay() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    let t2: ReturnType<typeof setTimeout>;
    let t3: ReturnType<typeof setTimeout>;
    let t4: ReturnType<typeof setTimeout>;
    const loop = () => {
      setPhase(1);
      t2 = setTimeout(() => setPhase(2), 500);
      t3 = setTimeout(() => setPhase(3), 2400);
      t4 = setTimeout(() => setPhase(0), 3400);
      return setTimeout(loop, 5400);
    };
    const initial = loop();
    return () => {
      clearTimeout(initial);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  const positions: Record<number, { x: number; y: number }> = {
    0: { x: 44, y: 78 },
    1: { x: 44, y: 78 },
    2: { x: 172, y: 220 },
    3: { x: 172, y: 220 },
  };
  const pos = positions[phase];

  return (
    <div className="oldway">
      <div className="oldway-toolbar mono">
        <span className="oldway-crumb">Documents</span>
        <span className="oldway-crumb oldway-crumb-dim">/</span>
        <span className="oldway-crumb">mutual-nda.pdf</span>
        <div className="oldway-tools">
          <span className="oldway-tool">Signature</span>
          <span className="oldway-tool">Initials</span>
          <span className="oldway-tool">Date</span>
          <span className="oldway-tool">Text</span>
          <span className="oldway-tool oldway-tool-dim">Checkbox</span>
        </div>
      </div>

      <div className="oldway-canvas">
        <div className="pdfpage">
          <div className="pdf-title mono">MUTUAL NON-DISCLOSURE AGREEMENT</div>
          <div className="pdf-meta mono">Effective Date: March 14, 2026</div>
          <div className="pdf-lines">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="pdf-line"
                style={{ width: `${72 + ((i * 13) % 25)}%` }}
              />
            ))}
          </div>
          <div className="pdf-sig-block">
            <div className="pdf-sig-row">
              <div>
                <div className="pdf-sig-line" />
                <div className="pdf-sig-label mono">Party A — Signature</div>
              </div>
              <div>
                <div className="pdf-sig-line" />
                <div className="pdf-sig-label mono">Date</div>
              </div>
            </div>
            <div className="pdf-sig-row">
              <div>
                <div className="pdf-sig-line" />
                <div className="pdf-sig-label mono">Party B — Signature</div>
              </div>
              <div>
                <div className="pdf-sig-line" />
                <div className="pdf-sig-label mono">Date</div>
              </div>
            </div>
          </div>
        </div>

        <div
          className={"drag-handle drag-sig phase-" + phase}
          style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
        >
          <div className="handle-body">
            <span className="handle-label mono">Signature</span>
            <span className="handle-grip">⋮⋮</span>
          </div>
          <span className="handle-corner tl" />
          <span className="handle-corner tr" />
          <span className="handle-corner bl" />
          <span className="handle-corner br" />
        </div>

        <div className="drag-handle drag-date" style={{ transform: "translate(260px, 60px)" }}>
          <div className="handle-body">
            <span className="handle-label mono">Date</span>
            <span className="handle-grip">⋮⋮</span>
          </div>
          <span className="handle-corner tl" />
          <span className="handle-corner tr" />
          <span className="handle-corner bl" />
          <span className="handle-corner br" />
        </div>

        <div
          className={"oldway-cursor phase-" + phase}
          style={{ transform: `translate(${pos.x + 40}px, ${pos.y + 16}px)` }}
        >
          <svg width="18" height="22" viewBox="0 0 18 22">
            <path
              d="M2 1.5v16l4.5-4h8L2 1.5Z"
              fill="#0a0b0d"
              stroke="#fff"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
          {phase === 2 && <span className="oldway-grabbing mono">moving…</span>}
        </div>

        {phase === 2 && (
          <>
            <div className="guide guide-h" style={{ top: pos.y + 16 }} />
            <div className="guide guide-v" style={{ left: pos.x + 40 }} />
          </>
        )}
      </div>

      <div className="oldway-statusbar mono">
        <span>
          x: <b>{Math.round(pos.x)}</b>
        </span>
        <span>
          y: <b>{Math.round(pos.y)}</b>
        </span>
        <span>
          w: <b>164</b>
        </span>
        <span>
          h: <b>32</b>
        </span>
        <span className="oldway-zoom">100%</span>
      </div>
    </div>
  );
}

const PROMPTS = [
  "Put a signature field at the bottom of page 2, and a date field next to it.",
  "Add initials on every page in the top-right corner.",
  "Place Party B's signature below Party A's — same X.",
];

function NewWay() {
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setTyped("");
    setDone(false);
    const text = PROMPTS[idx];
    let n = 0;
    const id = setInterval(() => {
      n++;
      setTyped(text.slice(0, n));
      if (n >= text.length) {
        clearInterval(id);
        setDone(true);
      }
    }, 28);
    return () => clearInterval(id);
  }, [idx]);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setIdx((i) => (i + 1) % PROMPTS.length), 4200);
    return () => clearTimeout(t);
  }, [done]);

  return (
    <div className="newway">
      <div className="newway-chrome mono">
        <Claude size={12} />
        <span>claude</span>
        <span className="newway-sep">·</span>
        <span className="newway-path">mutual-nda.pdf</span>
      </div>

      <div className="newway-body">
        <div>
          <div className="newway-prompt-label mono">you</div>
          <div className="newway-prompt-text">
            {typed}
            {!done && <span className="cursor" />}
          </div>
        </div>

        <div className={"newway-response " + (done ? "in" : "")}>
          <div className="newway-prompt-label mono">swiftsign</div>
          <div className="newway-steps mono">
            <div className="newway-step">
              <Anchor size={12} />
              <span>
                findAnchorPosition(<span className="nw-str">&quot;Party B — Signature&quot;</span>)
              </span>
              <span className="nw-ok">→ page 2 · 112, 624</span>
            </div>
            <div className="newway-step">
              <Anchor size={12} />
              <span>
                findAnchorPosition(<span className="nw-str">&quot;Date&quot;</span>, near=prev)
              </span>
              <span className="nw-ok">→ page 2 · 362, 624</span>
            </div>
            <div className="newway-step newway-step-done">
              <Check size={12} />
              <span>2 fields placed</span>
            </div>
          </div>
        </div>
      </div>

      <div className="newway-preview">
        <div className="mini-pdf">
          <div className="mini-pdf-title mono">MUTUAL NDA · p.2</div>
          <div className="mini-lines">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="mini-line"
                style={{ width: `${60 + ((i * 11) % 30)}%` }}
              />
            ))}
          </div>
          <div className="mini-sig-row">
            <div className={"mini-field mini-sig " + (done ? "placed" : "")}>
              <span className="mono">signature</span>
            </div>
            <div className={"mini-field mini-date " + (done ? "placed" : "")}>
              <span className="mono">date</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NoMoreDragging() {
  return (
    <section className="nomore-section" id="nomore">
      <div className="container">
        <div className="nomore-head">
          <div className="eyebrow">Field placement</div>
          <h2>No more dragging.</h2>
          <p className="nomore-lede">
            DocuSign makes you pixel-hunt with a mouse. SwiftSign uses{" "}
            <span className="inline-code mono">findAnchorPosition</span> — point to a phrase in the
            document, we place the field. Even better: describe what you want.
          </p>
        </div>

        <div className="nomore-grid">
          <div className="nomore-col">
            <div className="nomore-col-label mono">
              <span className="nomore-dot-old" /> The old way
            </div>
            <OldWay />
            <p className="nomore-caption">
              Hunt for coordinates. Misalign. Undo. Scroll. Zoom in. Resize. Try again.
            </p>
          </div>

          <div className="nomore-col">
            <div className="nomore-col-label mono">
              <span className="nomore-dot-new" /> Describe it. We place it.
            </div>
            <NewWay />
            <p className="nomore-caption">
              Anchor-based placement means fields stay in the right spot even when the document
              reflows.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
