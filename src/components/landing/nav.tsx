"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Github, Logo } from "./icons";

export function NavBar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={"nav " + (scrolled ? "nav-scrolled" : "")}>
      <div className="container nav-inner">
        <Link href="/" className="nav-logo">
          <Logo />
          <span className="mono">swiftsign</span>
          <span className="nav-beta mono">beta</span>
        </Link>
        <nav className="nav-links mono">
          <Link href="/docs">Docs</Link>
          <Link href="/pricing">Pricing</Link>
          <a href="#" className="nav-dim">
            Changelog
          </a>
          <Link href="/dashboard" className="nav-dim">
            Dashboard
          </Link>
        </nav>
        <div className="nav-cta">
          <a
            href="https://github.com"
            className="icon-link"
            aria-label="GitHub"
            target="_blank"
            rel="noreferrer"
          >
            <Github />
          </a>
          <a href="#cta" className="btn btn-primary">
            Get started <ArrowRight />
          </a>
        </div>
      </div>
    </header>
  );
}
