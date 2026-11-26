// app/page.tsx — Public "Learn About Kastrick" landing page built with NES
// (Next.js Engine Schema) mounting the registered "kastrick-landing" component.

import { createPage, defineSchema } from "@/engine";
import { getDocsRegistry } from "@/components/EngineDocsComponents";
import { loadManifest } from "@/lib/content";

const manifest = loadManifest();

const HomeSchema = defineSchema({
	meta: {
		title: "Learn About Kastrick — Official Documentation",
		description:
			"Static per-build documentation and guides for RBE, Next.js Engine, PackageX, PackX, PackageX SDKs, and Kastrick's Utility.",
	},
	root: {
		type: "kastrick-landing" as never,
		props: {
			manifestJson: JSON.stringify(manifest),
		} as never,
	},
});

export default createPage({
	schema: HomeSchema,
	registry: getDocsRegistry(),
});
