"use client";

import { useEffect, useState } from "react";
import { Check, Claude } from "./icons";

type ScriptItem =
  | { k: "user"; t: string }
  | { k: "thinking"; t: string }
  | { k: "tool"; name: string; params: [string, string][] }
  | { k: "result"; t: string }
  | { k: "assistant"; t: string };

const SCRIPT: ScriptItem[] = [
  { k: "user", t: "send the NDA at ~/contracts/mutual-nda.pdf to steve@acme.com for signature" },
  { k: "thinking", t: "Reading PDF · finding signature anchors · preparing envelope" },
  {
    k: "tool",
    name: "swiftsign_send_envelope",
    params: [
      ["document", "~/contracts/mutual-nda.pdf"],
      ["recipient", "steve@acme.com"],
      ["fields[0]", "{type:'signature', anchor:'_____________'}"],
      ["fields[1]", "{type:'date', anchor:'Date:'}"],
    ],
  },
  { k: "result", t: "✓ Envelope ss_3f8a…c21 sent. Steve will be notified at steve@acme.com." },
  {
    k: "assistant",
    t: "Sent. Steve will get an email in a moment. I'll let you know when he signs — want a webhook set up for that?",
  },
];

function useTypewriter(text: string, speed: number, onDone?: () => void) {
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    let n = 0;
    const id = setInterval(() => {
      n++;
      setI(n);
      if (n >= text.length) {
        clearInterval(id);
        if (onDone) setTimeout(onDone, 400);
      }
    }, speed);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speed]);
  return text.slice(0, i);
}

function TypingLine({
  text,
  onDone,
  speed = 22,
  className = "",
  showCursor = true,
}: {
  text: string;
  onDone?: () => void;
  speed?: number;
  className?: string;
  showCursor?: boolean;
}) {
  const shown = useTypewriter(text, speed, onDone);
  const done = shown.length >= text.length;
  return (
    <div className={className}>
      <span>{shown}</span>
      {showCursor && !done && <span className="cursor" />}
    </div>
  );
}

function ToolCallPill({
  name,
  params,
  onDone,
  expanded,
}: {
  name: string;
  params: [string, string][];
  onDone?: () => void;
  expanded: boolean;
}) {
  const [dots, setDots] = useState(0);
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d + 1) % 4), 350);
    const t = setTimeout(() => {
      setFinished(true);
      if (onDone) onDone();
    }, 2200);
    return () => {
      clearInterval(id);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className={"tool-pill " + (finished ? "done" : "")}>
      <div className="tool-pill-head">
        <span className={"tool-ind " + (finished ? "done" : "")}>
          {finished ? <Check size={11} /> : "▸"}
        </span>
        <span className="tool-name mono">{name}</span>
        <span className="tool-status mono">
          {finished ? "completed" : "running" + ".".repeat(dots)}
        </span>
      </div>
      {expanded && (
        <div className="tool-params mono">
          {params.map(([k, v], i) => (
            <div key={i} className="tool-param">
              <span className="tk">{k}</span>
              <span className="tv">{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TerminalDemo() {
  const [step, setStep] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const [cycle, setCycle] = useState(0);

  const next = () => setStep((s) => s + 1);

  useEffect(() => {
    if (step >= SCRIPT.length) {
      const t = setTimeout(() => {
        setStep(0);
        setCycle((c) => c + 1);
      }, 5000);
      return () => clearTimeout(t);
    }
    const item = SCRIPT[step];
    if (item.k === "thinking") {
      const t = setTimeout(next, 1400);
      return () => clearTimeout(t);
    }
    if (item.k === "result") {
      const t = setTimeout(next, 900);
      return () => clearTimeout(t);
    }
    // user / assistant / tool advance themselves via callbacks
  }, [step]);

  return (
    <div className="term-wrap">
      <div className="term-chrome">
        <div className="term-lights">
          <span className="dot red" />
          <span className="dot yel" />
          <span className="dot grn" />
        </div>
        <div className="term-title mono">
          <Claude size={13} />
          <span>claude</span>
          <span className="term-sep">—</span>
          <span className="term-path">~/projects/acme-legal</span>
        </div>
        <div className="term-spacer" />
        <div className="term-model mono">claude-sonnet-4.5</div>
      </div>

      <div className="term-body" key={cycle}>
        {SCRIPT.slice(0, step + 1).map((item, i) => {
          const last = i === step;
          if (item.k === "user") {
            return (
              <div key={i} className="term-user">
                <span className="term-gutter mono">&gt;</span>
                {last ? (
                  <TypingLine
                    text={item.t}
                    speed={18}
                    onDone={next}
                    className="term-user-text"
                  />
                ) : (
                  <span className="term-user-text">{item.t}</span>
                )}
              </div>
            );
          }
          if (item.k === "thinking") {
            return (
              <div key={i} className="term-thinking mono">
                <span className="thinking-spin">✻</span>
                <span>{item.t}</span>
                <span className="thinking-dots">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            );
          }
          if (item.k === "tool") {
            return (
              <ToolCallPill
                key={i}
                name={item.name}
                params={item.params}
                expanded={expanded}
                onDone={last ? next : undefined}
              />
            );
          }
          if (item.k === "result") {
            return (
              <div key={i} className="term-result mono">
                <span className="term-check">✓</span>
                <span>{item.t}</span>
              </div>
            );
          }
          if (item.k === "assistant") {
            return (
              <div key={i} className="term-assistant">
                <span className="term-gutter term-gutter-ai">
                  <Claude size={12} />
                </span>
                {last ? (
                  <TypingLine text={item.t} speed={14} className="term-assistant-text" />
                ) : (
                  <span className="term-assistant-text">{item.t}</span>
                )}
              </div>
            );
          }
          return null;
        })}
      </div>

      <div className="term-footer">
        <div className="mono">
          <span className="term-badge">esc</span> interrupt
          <span className="term-badge" style={{ marginLeft: 12 }}>
            ⏎
          </span>{" "}
          send
        </div>
        <div className="mono">
          <button className="term-fbtn" onClick={() => setExpanded((e) => !e)}>
            {expanded ? "collapse tool" : "expand tool"}
          </button>
        </div>
      </div>
    </div>
  );
}
