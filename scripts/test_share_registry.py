#!/usr/bin/env python3
"""Focused tests for stable share identity and generated static registry snapshots."""

import json
import tempfile
import unittest
from pathlib import Path

import sync_docs
from unittest import mock


class ShareRegistryTests(unittest.TestCase):
	def setUp(self):
		self.temp = tempfile.TemporaryDirectory()
		root = Path(self.temp.name)
		self.source = root / "share-registry.json"
		self.public = root / "public" / "share"
		self.original_source = sync_docs.SHARE_REGISTRY_SOURCE_FILE
		self.original_public = sync_docs.SHARE_REGISTRY_PUBLIC_DIR
		sync_docs.SHARE_REGISTRY_SOURCE_FILE = self.source
		sync_docs.SHARE_REGISTRY_PUBLIC_DIR = self.public
		self.write_config({"schemaVersion": 1, "documents": {}, "tombstones": {}})

	def tearDown(self):
		sync_docs.SHARE_REGISTRY_SOURCE_FILE = self.original_source
		sync_docs.SHARE_REGISTRY_PUBLIC_DIR = self.original_public
		self.temp.cleanup()

	def write_config(self, value):
		self.source.parent.mkdir(parents=True, exist_ok=True)
		self.source.write_text(json.dumps(value), encoding="utf-8")

	def page(self, slug="old", source_path="docs/current.md", heading="intro"):
		return {
			"slug": slug, "track": "docs", "generation": "unversioned",
			"sourcePath": source_path, "title": "Test docs",
			"toc": [{"id": heading, "text": heading}],
		}

	def project(self, *pages):
		return [{
			"id": "test-docs", "name": "Test Docs", "established": True,
			"pages": list(pages),
		}]

	def snapshot(self):
		files = list(self.public.glob("registry.*.json"))
		self.assertEqual(len(files), 1)
		return json.loads(files[0].read_text(encoding="utf-8"))

	def test_where_is_stable_when_only_slug_changes(self):
		first = self.page(slug="old-route")
		sync_docs.write_share_registry(self.project(first), "2026-11-28T00:00:00Z")
		first_where = first["share"]["where"]
		second = self.page(slug="renamed-route")
		sync_docs.write_share_registry(self.project(second), "2026-11-29T00:00:00Z")
		self.assertEqual(second["share"]["where"], first_where)

	def test_source_move_and_heading_rename_alias_old_codes(self):
		old_identity = "test-docs|unversioned|docs|docs/old.md"
		new_identity = "test-docs|unversioned|docs|docs/new.md"
		self.write_config({
			"schemaVersion": 1,
			"documents": {
				new_identity: {
					"aliases": [old_identity],
					"anchorAliases": {"old-heading": "new-heading"},
				}
			},
			"tombstones": {},
		})
		page = self.page(slug="new-route", source_path="docs/new.md", heading="new-heading")
		sync_docs.write_share_registry(self.project(page), "2026-11-28T00:00:00Z")
		snapshot = self.snapshot()
		old_where = sync_docs.stable_share_where(old_identity)
		old_anchor_id = sync_docs.stable_share_anchor_id(old_where, "old-heading")
		self.assertEqual(
			snapshot["documentsById"][old_where]["anchorsById"][str(old_anchor_id)],
			"new-heading",
		)

	def test_tombstone_maps_old_anchor_ids_to_the_live_page(self):
		page = self.page(slug="live", heading="live-heading")
		identity = sync_docs.share_document_identity("test-docs", page)
		live_where = sync_docs.stable_share_where(identity)
		retired_where = "OLD0"
		self.write_config({
			"schemaVersion": 1,
			"documents": {},
			"tombstones": {retired_where: live_where},
		})
		sync_docs.write_share_registry(self.project(page), "2026-11-28T00:00:00Z")
		retired = self.snapshot()["documentsById"][retired_where]
		old_anchor_id = sync_docs.stable_share_anchor_id(retired_where, "live-heading")
		self.assertEqual(retired["canonicalWhere"], live_where)
		self.assertTrue(retired["retired"])
		self.assertEqual(retired["anchorsById"][str(old_anchor_id)], "live-heading")

	def test_hash_collisions_are_resolved_deterministically(self):
		page = self.page(source_path="docs/collisions.md", heading="gamma")
		page["toc"] = [
			{"id": "gamma", "text": "Gamma"},
			{"id": "alpha", "text": "Alpha"},
			{"id": "beta", "text": "Beta"},
		]
		with mock.patch.object(sync_docs, "stable_share_anchor_id", return_value=143):
			sync_docs.write_share_registry(self.project(page), "2026-11-28T00:00:00Z")
		self.assertEqual(page["share"]["anchors"], {
			"alpha": 143,
			"beta": 144,
			"gamma": 145,
		})
		snapshot = self.snapshot()
		where = page["share"]["where"]
		self.assertEqual(set(snapshot["documentsById"][where]["anchorsById"]), {"143", "144", "145"})

	def test_duplicate_explicit_where_fails_instead_of_misrouting(self):
		page_a = self.page(source_path="docs/a.md", heading="first")
		page_b = self.page(source_path="docs/b.md", heading="second")
		identity_a = sync_docs.share_document_identity("test-docs", page_a)
		identity_b = sync_docs.share_document_identity("test-docs", page_b)
		self.write_config({
			"schemaVersion": 1,
			"documents": {
				identity_a: {"where": "DUP0"},
				identity_b: {"where": "DUP0"},
			},
			"tombstones": {},
		})
		with self.assertRaisesRegex(ValueError, "WHERE collision"):
			sync_docs.write_share_registry(self.project(page_a, page_b), "2026-11-28T00:00:00Z")


if __name__ == "__main__":
	unittest.main()
