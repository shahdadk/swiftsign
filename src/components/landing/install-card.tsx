"use client";

import { useState } from "react";
import { Check, Copy } from "./icons";

const TABS = [
  {
    id: "claude",
    label: "Claude Code",
    code: "claude mcp add swiftsign -- npx -y swiftsign-mcp",
  },
  {
    id: "mcp",
    label: ".mcp.json",
    code: `{
  "mcpServers": {
    "swiftsign": {
      "command": "npx",
      "args": ["-y", "swiftsign-mcp"]
    }
  }
}`,
  },
  {
    id: "cursor",
    label: "Cursor",
    code: "npx -y swiftsign-mcp --install cursor",
  },
  {
    id: "curl",
    label: "cURL",
    code: "curl -sSL https://swiftsign.dev/install | sh",
  },
];

export function InstallCard({ variant = "default" }: { variant?: "default" | "hero" }) {
  const [active, setActive] = useState("claude");
  const [copied, setCopied] = useState(false);
  const current = TABS.find((t) => t.id === active)!;

  const copy = () => {
    navigator.clipboard?.writeText(current.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className={"install-card " + (variant === "hero" ? "install-card-hero" : "")}>
      <div className="install-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={"install-tab mono " + (t.id === active ? "active" : "")}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
        <div className="install-tab-spacer" />
        <button className="install-copy mono" onClick={copy} aria-label="Copy">
          {copied ? (
            <>
              <Check /> copied
            </>
          ) : (
            <>
              <Copy /> copy
            </>
          )}
        </button>
      </div>
      <pre className="install-code mono">
        <span className="prompt">❯</span>
        <code>{current.code}</code>
      </pre>
    </div>
  );
}
