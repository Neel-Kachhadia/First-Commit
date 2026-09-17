import type { JSX, SVGProps } from "react";

export type KavachIcon = (props: SVGProps<SVGSVGElement>) => JSX.Element;

function Glyph({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function CommandGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
      <path d="M8 12h8M12 8v8" />
      <rect x="10" y="10" width="4" height="4" />
    </Glyph>
  );
}

export function AgentGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M5 8.5h14v10H5zM8 8.5V6h8v2.5" />
      <path d="M8.5 13h1M14.5 13h1M9 16h6" />
      <path d="M3 12h2M19 12h2" />
    </Glyph>
  );
}

export function AuthorityGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M12 5v5M5 19v-4h14v4M5 15v-3h14v3" />
      <rect x="9" y="3" width="6" height="4" />
      <rect x="3" y="18" width="4" height="3" />
      <rect x="10" y="18" width="4" height="3" />
      <rect x="17" y="18" width="4" height="3" />
    </Glyph>
  );
}

export function ApprovalGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M5 4h11l3 3v13H5zM16 4v4h3" />
      <path d="m8 14 2.5 2.5L16 11" />
    </Glyph>
  );
}

export function DecisionGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M5 5h14M5 12h14M5 19h14" />
      <path d="M5 3v4M12 10v4M19 17v4" />
    </Glyph>
  );
}

export function MandateGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M6 3h9l3 3v15H6zM15 3v4h3" />
      <path d="M9 11h6M9 15h6M9 18h4" />
    </Glyph>
  );
}

export function ExposureGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M4 17V7M4 17h16" />
      <path d="m7 14 3-4 3 2 4-6" />
      <path d="M17 6h3v3" />
    </Glyph>
  );
}

export function MerchantGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M4 9h16l-2-5H6zM5 9v11h14V9" />
      <path d="M9 20v-6h6v6M4 9c0 2 3 2 4 0 1 2 3 2 4 0 1 2 3 2 4 0 1 2 4 2 4 0" />
    </Glyph>
  );
}

export function MandatePlusGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M5 3h9l3 3v7M14 3v4h3M8 10h5M8 14h3" />
      <path d="M17 15v6M14 18h6" />
    </Glyph>
  );
}

export function SpendGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M4 6h16v12H4zM4 9h16" />
      <path d="M8 14h4" />
    </Glyph>
  );
}

export function ReviewGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M12 3a9 9 0 1 0 9 9" />
      <path d="M12 7v5l3 2M16 3h5v5" />
    </Glyph>
  );
}
