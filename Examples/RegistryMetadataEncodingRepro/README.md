# Registry Metadata Encoding Repro

This example provides a local mock registry and two packages:

- `demo.ascii`: ASCII-only metadata
- `demo.unicode`: metadata containing a curly apostrophe

The scripts automatically use locally built SwiftPM binaries from this checkout if they exist under `.build/arm64-apple-macosx/debug`. Otherwise they fall back to the system `swift` toolchain.

## Run

```bash
cd /Users/sgtl/h/github/spqw/swift-package-manager/Examples/RegistryMetadataEncodingRepro
./scripts/demo.sh truncate-non-ascii-when-quoted-printable
```

Expected behavior:

- with stock SwiftPM, `demo.unicode` fails to resolve in strict mode
- with the fixed local SwiftPM binaries, both packages resolve successfully

## Modes

- `passthrough`
- `truncate-non-ascii-when-quoted-printable`

The strict mode intentionally simulates a registry/proxy that mishandles a metadata part when SwiftPM declares `Content-Transfer-Encoding: quoted-printable` but sends raw UTF-8 bytes.

