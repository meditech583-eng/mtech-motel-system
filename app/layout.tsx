import type { Metadata, Viewport } from "next";
import "./globals.css";
import PWARegister from "./pwa-register";
import InstallAppButton from "./install-app-button";

export const metadata: Metadata = {
  title: "MTECH Stay",
  description: "Installable motel management system by MTECH",
  applicationName: "MTECH Stay",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MTECH Stay",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <PWARegister />
        <InstallAppButton />
        {children}
      </body>
    </html>
  );
}
