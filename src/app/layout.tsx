import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Barlow_Condensed, Crimson_Text, IBM_Plex_Mono } from "next/font/google";
import Script from "next/script";
import { themeBootstrapScript } from "@/lib/theme";
import "./globals.css";
import "../styles.css";
import { configureAmplify } from "@/lib/auth/amplify-config";
import { AuthProvider } from "@/lib/auth/auth-context";
import { CustomCursor } from "@/components/cursor/CustomCursor";

// Configure Amplify once at module load time (runs on server + client).
configureAmplify();

const body = Crimson_Text({
  variable: "--font-crimson-text",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
});

const admin = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "KavachPay — Authority, bounded",
  description: "Agentic money control for mandates, delegation, budgets, approvals, revocation and replay.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className={`${body.variable} ${admin.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        <Script
          id="kavachpay-theme-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeBootstrapScript }}
        />
        <AuthProvider>
          {children}
          <CustomCursor />
        </AuthProvider>
      </body>
    </html>
  );
}
