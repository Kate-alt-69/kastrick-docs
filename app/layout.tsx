// app/layout.tsx — Root layout for Kastrick Documentation.

import type { Metadata, Viewport } from "next";
import React from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { siteMetadata } from "@/data/site";
import NavigationProgress from "@/components/NavigationProgress";
import "./docs.css";

export const metadata: Metadata = {
	title: siteMetadata.title,
	description: siteMetadata.description,
	applicationName: siteMetadata.applicationName,
	metadataBase: new URL(siteMetadata.url),
	keywords: siteMetadata.keywords,
	authors: siteMetadata.authors,
	creator: siteMetadata.creator,
	publisher: siteMetadata.publisher,
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	themeColor: siteMetadata.brand.background,
	colorScheme: "dark",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body suppressHydrationWarning>
				<React.Suspense fallback={null}>
					<NavigationProgress />
				</React.Suspense>
				{children}
				<Analytics />
				<SpeedInsights />
			</body>
		</html>
	);
}
