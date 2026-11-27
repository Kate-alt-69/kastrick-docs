import React from "react";

const articleLines = ["94%", "100%", "88%", "73%", "98%", "82%", "91%", "64%"];
const outlineLines = ["82%", "68%", "91%", "74%", "86%", "57%", "79%"];

export default function DocumentationLoading() {
	return (
		<div className="kd-root kd-loading-root" aria-busy="true">
			<header className="kd-topbar kd-doc-header kd-loading-header">
				<div className="kd-loading-header-left">
					<span className="kd-skeleton" style={{ width: 62, height: 18 }} />
					<div className="kd-loading-breadcrumb">
						<span className="kd-skeleton" style={{ width: 68, height: 12 }} />
						<span className="kd-skeleton" style={{ width: 104, height: 12 }} />
					</div>
				</div>
				<div className="kd-loading-search">
					<span className="kd-skeleton" style={{ width: "100%", height: 34 }} />
				</div>
				<div className="kd-loading-header-right">
					<span className="kd-skeleton" style={{ width: 64, height: 28 }} />
					<span className="kd-skeleton" style={{ width: 82, height: 28 }} />
				</div>
			</header>

			<div className="kd-grid kd-loading-grid">
				<aside className="kd-sidebar kd-loading-sidebar" aria-hidden="true">
					<span className="kd-skeleton kd-loading-sidebar-heading" />
					{[0, 1, 2, 3].map((group) => (
						<div className="kd-loading-group" key={group}>
							<span className="kd-skeleton" style={{ width: "58%", height: 13 }} />
							{[0, 1, 2].map((item) => (
								<span className="kd-skeleton" key={item} style={{ width: (76 + ((group + item) % 3) * 8) + "%", height: 10 }} />
							))}
						</div>
					))}
				</aside>

				<main className="kd-main kd-loading-main" role="status" aria-live="polite" aria-label="Loading documentation page">
					<div className="kd-loading-actions">
						<span className="kd-skeleton" style={{ width: 72, height: 30 }} />
						<span className="kd-skeleton" style={{ width: 84, height: 30 }} />
					</div>
					<div className="kd-loading-article" aria-hidden="true">
						<span className="kd-skeleton kd-loading-title" style={{ width: "72%" }} />
						<span className="kd-skeleton kd-loading-subtitle" style={{ width: "43%" }} />
						{articleLines.slice(0, 4).map((width, index) => <span className="kd-skeleton kd-loading-line" key={index} style={{ width }} />)}
						<span className="kd-skeleton kd-loading-heading" style={{ width: "48%" }} />
						{articleLines.slice(4).map((width, index) => <span className="kd-skeleton kd-loading-line" key={index} style={{ width }} />)}
						<span className="kd-skeleton kd-loading-code" />
						<span className="kd-skeleton kd-loading-heading" style={{ width: "39%" }} />
						{articleLines.slice(1, 5).map((width, index) => <span className="kd-skeleton kd-loading-line" key={index} style={{ width }} />)}
					</div>
				</main>

				<aside className="kd-toc kd-loading-toc" aria-hidden="true">
					<div className="kd-loading-toc-card">
						<span className="kd-skeleton" style={{ width: "48%", height: 15 }} />
						<span className="kd-skeleton" style={{ width: "88%", height: 12 }} />
						<span className="kd-skeleton" style={{ width: "55%", height: 10 }} />
						<span className="kd-skeleton" style={{ width: "100%", height: 4 }} />
						<span className="kd-skeleton" style={{ width: "100%", height: 4 }} />
						<span className="kd-skeleton" style={{ width: "38%", height: 12, marginTop: 16 }} />
						{outlineLines.map((width, index) => <span className="kd-skeleton" key={index} style={{ width, height: 10, marginLeft: index % 3 === 2 ? 16 : 0 }} />)}
					</div>
				</aside>
			</div>
		</div>
	);
}
