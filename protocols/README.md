# Protocol Preservation and Versioning

## Frozen original RAW artifacts

The following Portuguese artifacts are the original normative BH-SEP v2.2 and
BH-SDP v2.2 documents. Their repository paths and RAW URLs are frozen:

| Artifact | Stable path | SHA-256 |
| --- | --- | --- |
| BH-SEP v2.2 | `protocols/BH-SEP.md` | `f4e8639163b0321fff86133a69ec59c2822ccdebcd24d2ccb459b5bc1c3b35cb` |
| BH-SDP v2.2 | `protocols/BH-SDP.md` | `04ea782ada1abf7fb959329054c57f87a0e86fca99a31d2e37751d3bdf7d47bc` |

Stable RAW URLs:

- `https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SEP.md`
- `https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SDP.md`

Internationalization does not authorize modifying, translating in place,
renaming, deleting, or repurposing those artifacts.

## English translations

The English files remain separate:

- `protocols/BH-SEP_EN.md`
- `protocols/BH-SDP_EN.md`

Translations improve accessibility but do not silently redefine the original
normative Portuguese text.

## Protocol sequence

- **v2.2 — historical, frozen, and immutable:** the stable PT-BR originals and
  separate EN translations remain unchanged.
- **v2.3 — current update:** the versioned PT-BR and EN protocols are the current
  presentation.

### v2.2 — preserved

- [BH-SEP v2.2 — PT-BR](./BH-SEP.md)
- [BH-SDP v2.2 — PT-BR](./BH-SDP.md)
- [BH-SEP v2.2 — EN](./BH-SEP_EN.md)
- [BH-SDP v2.2 — EN](./BH-SDP_EN.md)

### v2.3 — current

- [BH-SEP v2.3 — PT-BR](https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/v2.3/BH-SEP.md)
- [BH-SDP v2.3 — PT-BR](https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/v2.3/BH-SDP.md)
- [BH-SEP v2.3 — EN](https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/v2.3/BH-SEP_EN.md)
- [BH-SDP v2.3 — EN](https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/v2.3/BH-SDP_EN.md)
- [Copiar os dois protocolos — PT-BR](https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/v2.3/BH-PROTOCOLS.md)
- [Copy both protocols — EN](https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/v2.3/BH-PROTOCOLS_EN.md)

## Future protocol versions

Future versions must be introduced at new versioned paths, for example:

```text
protocols/v2.3/BH-SEP.md
protocols/v2.3/BH-SDP.md
protocols/v2.3/BH-SEP_EN.md
protocols/v2.3/BH-SDP_EN.md
```

A future index may identify the currently recommended version. It must not make
an old RAW URL serve different normative content.

This policy is approved and frozen by
[ADR-018](../docs/adr/ADR-018-immutable-protocol-raw-and-international-documentation.md).
