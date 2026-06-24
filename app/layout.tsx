// app/layout.tsx

import type { Metadata, Viewport } from "next";

import { EngineGlobalStyles } from "#module/engine";

import DefaultLayout from "@/data/header-footer/default";
import { siteMetadata } from "@/data/site";

export const metadata: Metadata = {
	title: siteMetadata.title,
	description: siteMetadata.description,

	applicationName: siteMetadata.applicationName,

	metadataBase: new URL(siteMetadata.url),

	keywords: siteMetadata.keywords,

	authors: siteMetadata.authors,

	creator: siteMetadata.creator,

	publisher: siteMetadata.publisher,

	robots: {
		index: true,
		follow: true,
	},

	openGraph: {
		title: siteMetadata.title,
		description: siteMetadata.description,
		url: siteMetadata.url,
		siteName: siteMetadata.applicationName,
		type: "website",
		images: [
			{
				url: siteMetadata.images.og,
				width: 1200,
				height: 630,
				alt: siteMetadata.title,
			},
		],
	},

	twitter: {
		card: "summary_large_image",
		title: siteMetadata.title,
		description: siteMetadata.description,
		images: [siteMetadata.images.og],
	},

	icons: {
		icon: siteMetadata.images.favicon,
	},

	alternates: {
		canonical: siteMetadata.url,
	},
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
				<EngineGlobalStyles />

				<DefaultLayout>
					{children}
				</DefaultLayout>
			</body>
		</html>
	);
}