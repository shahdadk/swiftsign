import Link from "next/link";
import { NavBar } from "@/components/landing/nav";
import { Footer } from "@/components/landing/sections";

const policies = [
  { href: "/legal", label: "Overview" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/dpa", label: "DPA" },
  { href: "/legal/acceptable-use", label: "Acceptable use" },
  { href: "/legal/subprocessors", label: "Subprocessors" },
];

export default function LegalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <NavBar />
      <div className="legal-shell">
        <nav className="legal-nav mono" aria-label="Legal documents">
          {policies.map((policy) => (
            <Link key={policy.href} href={policy.href}>
              {policy.label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
      <Footer />
    </>
  );
}
