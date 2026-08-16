import assert from "node:assert/strict";
import test from "node:test";

const {
  decodeContentCursor,
  encodeContentCursor,
  getAnnouncement,
  getGalleryExample,
  getTasteSample,
  listAnnouncements,
  listGalleryExamples,
  listRecentAnnouncements,
} = await import(new URL("../server/content/catalog.ts", import.meta.url));

test("returns a static taste sample without personal contact details", () => {
  const sample = getTasteSample();

  assert.equal(sample.isStatic, true);
  assert.equal(sample.repository.fullName, "folio-ai/sample-api");
  assert.equal(sample.portfolioPreview.contact.email, null);
  assert.equal(sample.portfolioPreview.contact.location, null);
  assert.equal(sample.portfolioPreview.projects[0]?.repositoryUrl, "https://github.com");
});

test("filters gallery examples by role and technology", () => {
  const backend = listGalleryExamples({
    role: "backend engineer",
    techStack: "typescript",
    offset: 0,
    limit: 12,
  });

  assert.equal(backend.items.length, 1);
  assert.equal(backend.items[0]?.id, "gallery_backend");
  assert.equal(backend.items[0]?.thumbnailUrl, "/og.png");
  assert.equal(getGalleryExample("gallery_backend")?.portfolio.contact.email, null);
  assert.equal(getGalleryExample("missing"), null);
});

test("uses opaque cursors for gallery and announcement pagination", () => {
  const galleryPage = listGalleryExamples({ offset: 0, limit: 2 });
  const nextGalleryOffset = decodeContentCursor(galleryPage.nextCursor);
  const nextGalleryPage = listGalleryExamples({ offset: nextGalleryOffset ?? 0, limit: 2 });
  const announcementPage = listAnnouncements({ offset: 0, limit: 1 });

  assert.equal(galleryPage.items.length, 2);
  assert.equal(galleryPage.hasNextPage, true);
  assert.equal(nextGalleryOffset, 2);
  assert.notEqual(nextGalleryPage.items[0]?.id, galleryPage.items[0]?.id);
  assert.equal(announcementPage.items.length, 1);
  assert.equal(announcementPage.hasNextPage, true);
  assert.equal(encodeContentCursor(2), galleryPage.nextCursor);
  assert.equal(decodeContentCursor("not-a-cursor"), null);
});

test("provides public announcement summaries and details", () => {
  const announcements = listRecentAnnouncements(2);
  const detail = getAnnouncement(announcements[0]?.id ?? "");

  assert.equal(announcements.length, 2);
  assert.equal(announcements[0]?.isPinned, true);
  assert.ok(detail?.content);
  assert.equal(getAnnouncement("missing"), null);
});
