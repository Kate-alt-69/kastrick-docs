import type { Metadata } from "next";
import GenerationOneEasterEgg from "@/components/GenerationOneEasterEgg";

export const metadata: Metadata = {
	title: "Nothing happened here... · K8D",
	description: "An unlisted archive route.",
	robots: {
		index: false,
		follow: false,
	},
};

export default function GenerationOnePage() {
	return <GenerationOneEasterEgg />;
}
