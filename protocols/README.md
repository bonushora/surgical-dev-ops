# Protocol Preservation and Versioning

## Immutable normative RAW artifacts

The Portuguese v2.2 artifacts are the historical normative originals. Their
repository paths, RAW URLs, LF termination and SHA-256 values remain frozen:

| Artifact | Stable path | SHA-256 |
| --- | --- | --- |
| BH-SEP v2.2 | `protocols/BH-SEP.md` | `f4e8639163b0321fff86133a69ec59c2822ccdebcd24d2ccb459b5bc1c3b35cb` |
| BH-SDP v2.2 | `protocols/BH-SDP.md` | `04ea782ada1abf7fb959329054c57f87a0e86fca99a31d2e37751d3bdf7d47bc` |

Stable RAW URLs:

- `https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SEP.md`
- `https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SDP.md`

Internationalization does not authorize modifying, translating in place,
renaming, deleting, or repurposing those artifacts.

The Portuguese v2.3 artifacts are the active normative originals. They use
versioned stable paths and the same byte-level SHA-256 and LF gate:

| Artifact | Stable path | SHA-256 |
| --- | --- | --- |
| BH-SEP v2.3 | `protocols/v2.3/BH-SEP.md` | `0360b145b4f1ba8cb211ffdb16cf5d70d47c7dc55a11395bd2afb9d5241eb4ee` |
| BH-SDP v2.3 | `protocols/v2.3/BH-SDP.md` | `413b3613c75ce89defae4d49ad0b21d92f56519c14f5b32c8e8e152997887f47` |

Stable versioned RAW URLs:

- `https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/v2.3/BH-SEP.md`
- `https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/v2.3/BH-SDP.md`

## Translations and combined artifacts

Translations and combined copies remain separate derived artifacts. Their
hashes and composition are verified, but they are not described as original
normative RAW documents:

| Artifact | Kind | SHA-256 |
| --- | --- | --- |
| `protocols/v2.3/BH-SEP_EN.md` | English translation | `64bc602ea0556eb1819daf5ebd6aa07ff36c00f8a3443205f9035a93b02fdc13` |
| `protocols/v2.3/BH-SDP_EN.md` | English translation | `49f5ba8a8be6d075f41b299b69ebffa1cf6a3018f1d93bf373c4c2d0ec9ae222` |
| `protocols/v2.3/BH-PROTOCOLS.md` | Combined PT-BR copy | `d877a7bd876ee37df2378476150827e20a7e2437b8e8ee313f06b7992396f1bb` |
| `protocols/v2.3/BH-PROTOCOLS_EN.md` | Combined English translation | `fdfa13cc39eb36a7f07129398d8600887babf6535d0292bc561e960d0792055e` |

Translations improve accessibility but do not silently redefine the original
normative Portuguese text.

## Protocol sequence

### v2.2 — histórica e preservada

- [BH-SEP v2.2 — PT-BR original](./BH-SEP.md)
- [BH-SDP v2.2 — PT-BR original](./BH-SDP.md)
- [BH-SEP v2.2 — EN translation](./BH-SEP_EN.md)
- [BH-SDP v2.2 — EN translation](./BH-SDP_EN.md)

### v2.3 — atual

- [BH-SEP v2.3 — RAW original](./v2.3/BH-SEP.md)
- [BH-SDP v2.3 — RAW original](./v2.3/BH-SDP.md)
- [BH-SEP v2.3 — tradução inglesa](./v2.3/BH-SEP_EN.md)
- [BH-SDP v2.3 — tradução inglesa](./v2.3/BH-SDP_EN.md)

#### Cópia conjunta derivada da v2.3

- [BH-SEP + BH-SDP v2.3 — cópia combinada PT-BR](./v2.3/BH-PROTOCOLS.md)
- [BH-SEP + BH-SDP v2.3 — tradução inglesa combinada](./v2.3/BH-PROTOCOLS_EN.md)

## Future protocol versions

Future versions must be introduced at new versioned paths, for example:

```text
protocols/v2.3/BH-SEP.md
protocols/v2.3/BH-SDP.md
protocols/v2.3/BH-SEP_EN.md
protocols/v2.3/BH-SDP_EN.md
```

A future index may identify a later active version. It must not make an old RAW
URL serve different normative content.

This policy is approved and frozen by
[ADR-018](../docs/adr/ADR-018-immutable-protocol-raw-and-international-documentation.md).
