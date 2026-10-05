# FBReader Download missing — 2026-10-05

Device acceptance fails at Download visibility for installed application
`e57f0a6d33799593afc594a8adefabfa46ee6341`. Server ZIP acceptance does not prove
reader compatibility. Applicable requirements: OPDS-001, DOWNLOAD-001/002,
AUTH-001, SPEC-001.

## Observations and reproduction

Owner supplied four local FBReader Premium screenshots: Searchfloor list and
book information lack Download; comparison catalog list and book information
show Download. Book text, titles, images and screenshots are not copied into Git.
Catalog navigation and metadata display work. Acquisition authentication and
opening a book on the device remain untested because Download is unavailable.
Previously supplied target version is Android 3.8.31; screenshots do not confirm
the installed version independently.

Imported `renderFeed` directly from the immutable installed artifact's
`dist/opds/feed.js`, using one synthetic completed book, no credentials and zero
network requests. Its acquisition link is:

```json
{"rel":"http://opds-spec.org/acquisition","href":"https://example.invalid/opds/searchfloor/books/7/download.fb2.zip","type":"application/zip"}
```

This matches `src/opds/feed.ts` and the deliberate `tests/feed.test.ts` assertion.
Fetching feature branch found no later application fix: feature HEAD `d13e6ee`.

## Primary-source causal evidence

Inspected official geometer/FBReaderJ at pinned source revision
`e83aec9f94084aa59d39e33876bdb6fdc275c95e`:

- [MimeType.java](https://github.com/geometer/FBReaderJ/blob/e83aec9f94084aa59d39e33876bdb6fdc275c95e/fbreader/app/src/main/java/org/geometerplus/zlibrary/core/util/MimeType.java):
  `application/fb2+zip` is the FB2 ZIP MIME group; generic ZIP is separate.
- [FileTypeCollection.java](https://github.com/geometer/FBReaderJ/blob/e83aec9f94084aa59d39e33876bdb6fdc275c95e/fbreader/app/src/main/java/org/geometerplus/zlibrary/core/filetypes/FileTypeCollection.java):
  MIME lookup maps generic ZIP to ZIP archive, not FB2.
- [FileTypeFB2.java](https://github.com/geometer/FBReaderJ/blob/e83aec9f94084aa59d39e33876bdb6fdc275c95e/fbreader/app/src/main/java/org/geometerplus/zlibrary/core/filetypes/FileTypeFB2.java):
  FB2 supports `application/fb2+zip`; raw FB2 ZIP HTTP MIME can be generic ZIP.
- [BookUrlInfo.java](https://github.com/geometer/FBReaderJ/blob/e83aec9f94084aa59d39e33876bdb6fdc275c95e/fbreader/app/src/main/java/org/geometerplus/fbreader/network/urlInfo/BookUrlInfo.java)
  requires a format plugin for the MIME's file type;
  [native PluginCollection.cpp](https://github.com/geometer/FBReaderJ/blob/e83aec9f94084aa59d39e33876bdb6fdc275c95e/jni/NativeFormats/fbreader/src/formats/PluginCollection.cpp)
  registers FB2 and other book plugins, but no generic ZIP book plugin.
- [OPDSBookItem.java](https://github.com/geometer/FBReaderJ/blob/e83aec9f94084aa59d39e33876bdb6fdc275c95e/fbreader/app/src/main/java/org/geometerplus/fbreader/network/opds/OPDSBookItem.java)
  discards acquisition references with unsupported MIME.
- [NetworkBookActions.java](https://github.com/geometer/FBReaderJ/blob/e83aec9f94084aa59d39e33876bdb6fdc275c95e/fbreader/app/src/main/java/org/geometerplus/android/fbreader/network/action/NetworkBookActions.java)
  offers Download only with a recognized book reference.

Thus generic ZIP can leave book metadata visible while removing Download. This
explains both screenshots and the installed feed. Confidence is high for the
public source behavior; its older open source is not proof of the exact Premium
3.8.31 internals. [Official format support](https://fbreader.org/en/book-formats)
confirms Android supports FB2 ZIP. A device retest remains the decisive check.

## Proposed correction and gate

Advertise `application/fb2+zip` on acquisition links only. Keep actual download
HTTP Content-Type `application/zip`: the payload remains ZIP and FBReader's
FileTypeFB2 distinguishes book MIME from raw MIME. No unpacking, conversion,
upstream transport, authentication or URL change is needed.

Current OPDS-001 explicitly requires generic ZIP. Changing its intentional test
before reviewing a revised requirement would violate SPEC-001 and AGENTS.md.
Concrete spec delta, implementation and exact-SHA deployment/retest steps are in
`superpowers/plans/2026-10-05-fbreader-acquisition-mime.md`, approved by the owner on 2026-10-05.
Application link-type correction follows owner approval; installed artifact is
unchanged pending a new verified feature CI artifact.
No source or book requests, service changes, provider changes or bot changes.
