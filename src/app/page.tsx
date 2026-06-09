import { NavBar } from "@/components/landing/nav";
import { InstallCard } from "@/components/landing/install-card";
import { TerminalDemo } from "@/components/landing/terminal-demo";
import { NoMoreDragging } from "@/components/landing/no-more-dragging";
import {
  DevGrid,
  FinalCTA,
  Footer,
  HowItWorks,
  Pricing,
} from "@/components/landing/sections";
import { RevealOnScroll } from "@/components/landing/reveal";
import { Shield, Terminal } from "@/components/landing/icons";
import { SignupCta } from "@/components/landing/signup-cta";

export default function Home() {
  return (
    <>
      <NavBar />

      <section className="hero">
        <div className="dotgrid" />
        <div className="blob blob-a" style={{ top: "-200px", left: "-120px" }} />
        <div className="blob blob-b" style={{ top: "-80px", right: "-160px" }} />

        <div className="container hero-inner">
          <div className="kicker">
            <span className="dot" />
            <span>Free during beta · instant API key</span>
          </div>

          <h1 className="hero-h1">
            AI-native
            <br />
            <span className="hero-accent">signatures.</span>
          </h1>

          <p className="hero-sub">
            Send, track, and seal contracts from your terminal.
            <br />
            No drag handles. No per-seat fees. No sales call.
          </p>

          <div className="hero-install">
            <InstallCard variant="hero" />
          </div>

          <div className="hero-ctas">
            <SignupCta />
            <a href="#demo" className="btn btn-ghost">
              <Terminal /> See the demo
            </a>
          </div>

          <div className="hero-trust mono">
            <span>
              <Shield size={12} /> ESIGN · UETA · PIPEDA compliant
            </span>
            <span className="sep">·</span>
            <span>SHA-256 sealed PDFs</span>
            <span className="sep">·</span>
            <span>open source MCP</span>
          </div>
        </div>
      </section>

      <section className="term-section reveal" id="demo">
        <div
          className="blob blob-a"
          style={{ top: 0, left: "50%", transform: "translateX(-50%)" }}
        />
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">Live demo</div>
            <h2>See it in your terminal.</h2>
            <p className="section-sub">
              The MCP tool calls, the anchor placement, the sealed PDF — all from a single prompt.
            </p>
          </div>
          <TerminalDemo />
        </div>
      </section>

      <div className="reveal">
        <NoMoreDragging />
      </div>
      <div className="reveal">
        <HowItWorks />
      </div>
      <div className="reveal">
        <DevGrid />
      </div>
      <div className="reveal">
        <Pricing />
      </div>
      <div className="reveal">
        <FinalCTA />
      </div>

      <Footer />

      <RevealOnScroll />
    </>
  );
}
