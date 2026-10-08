# AGMI store hardening v1

## Evidence boundary

The externally measured baseline is the immutable commit
`07fdc884abb2b53c35b0cd2bdf6a3cfe2f2e5412`. Yasha Khandelwal contributed
external state-integrity testing of the persisted G9/G10
authorization-consumption store at that commit.

The reported baseline results were:

| Mutation | Store result at the baseline |
| --- | --- |
| T1 tamper | `DETECTED` |
| T2 truncate | `ACCEPTED_SILENTLY` |
| T3 delete middle | `ACCEPTED_SILENTLY` |
| T4 reorder/swap | `ACCEPTED_SILENTLY` |
| T5 forge | `DETECTED` |
| T6 cross replay | `ACCEPTED_SILENTLY` |
| T7 rollback replay | `ACCEPTED_SILENTLY` |
| T8 metadata tamper | `DETECTED` |
| T9 snapshot rollback | `ACCEPTED_SILENTLY` |

The same baseline also accepted a byte-identical A record copied into B under
A's filename, a genuine older `CLAIMED` record restored over its `CONSUMED`
successor, and modified content whose unkeyed fingerprint had been
recomputed.

Runtime qualification at the baseline remained fail-closed for the tested
scenarios: no second dispatch, no second effect, and no authority reappeared
after consumption. These results do not convert store acceptance into a
store-integrity success.

## Implemented hardening

The normal persisted-record read boundary now requires the record's
`authorizationFingerprint` to equal the requested fingerprint used to select
its filename. A mismatch fails with the deterministic error
`Persisted G7 authorization record does not match its requested storage
position.` This applies to both `CLAIMED` and `CONSUMED` records, including
process-style reopen after a write.

Every public load declares one of two read purposes:

- `CURRENT_AUTHORITY` requires an explicit
  `expectedPhysicalWorkspaceIdentity` supplied by an already-authoritative
  caller and rejects a different persisted identity.
- `HISTORICAL_RECONCILIATION` permits inspection without manufacturing
  operational, mutation, or dispatch authority. Persisted G9/G10 records
  already require all three authority flags to be `false`.

The R3 pre-preparation replay check supplies the physical identity already
validated from the live workspace. The linearizable G10 transition and reopen
supply the physical identity from the exact validated G9 claim. No identity is
derived from a pathname, ambient process state, or the record under test.

Repository-native regressions cover the measured store mutations and the
T6, T2, T9, and `CONSUMED_TO_CLAIMED` runtime paths. The runtime probes count
R3 preparation and Orchestrator dispatch independently and compare the
authoritative Manifest/projection across replay attempts.

## Qualified results and remaining decisions

| Case | Qualification after this change |
| --- | --- |
| T1 | `DETECTED_BY_STORE` |
| T2 | `ARCHITECTURE_DECISION_REQUIRED`; runtime remains a safe late denial |
| T3 | `ARCHITECTURE_DECISION_REQUIRED` |
| T4 | `DETECTED_BY_STORE` through position binding |
| T5 | `DETECTED_BY_STORE` when the unkeyed fingerprint is not recomputed |
| T6 | `DETECTED_BY_STORE` in the requested B slot |
| T7 | `DETECTED_BY_STORE` when replay changes the requested slot; same-slot lifecycle rollback remains an architecture decision |
| T8 | `DETECTED_BY_STORE` when the unkeyed fingerprint is not recomputed |
| T9 | `ARCHITECTURE_DECISION_REQUIRED`; tested runtime replay remains fail-closed |
| Copy under A's own name in B | Historical inspection accepts it; `CURRENT_AUTHORITY` rejects a physical-context mismatch |
| `CONSUMED_TO_CLAIMED` | `ARCHITECTURE_DECISION_REQUIRED`; tested runtime replay remains fail-closed before R3 |
| Recomputed unkeyed fingerprint | `ARCHITECTURE_DECISION_REQUIRED` |

Deletion, truncation, same-slot lifecycle rollback, and directory snapshot
rollback cannot be detected by validating only records that remain present.
The current mutation journal has hash-linked sequence records and durable
effect evidence, but it does not expose a direct independently authenticated
authorization-fingerprint-to-effect index that can deny the exact T2 replay
before R3 preparation. T2 therefore retains the existing safe late denial:
R3 preparation is reached, the authoritative content/Manifest binding rejects
the stale G3 patch, and Orchestrator dispatch is not reached.

The repository has a local Ed25519 human authority, but its signer is scoped
to human challenges. Reusing that private authority for automatic store-head
or record signing would grant a new signing purpose and expand the authority
boundary. Therefore:

- `EXISTING_TRUST_ROOT_REUSABLE=NO`
- `REUSE_PRESERVES_AUTHORITY_BOUNDARIES=NO`
- `NEW_SECRET_REQUIRED=YES` for a locally authenticated monotonic head unless
  an independently governed external anchor is selected
- `AUTHENTICATED_STORE_HEAD=ARCHITECTURE_DECISION_REQUIRED`
- `KEYED_RECORD_AUTHENTICITY=ARCHITECTURE_DECISION_REQUIRED`

No new secret, key, signature, MAC, or store head is introduced here. The
existing SHA-256 record fingerprints remain correlation and accidental-change
integrity metadata; they are not signatures or MACs.

## State integrity and runtime authority integrity

`STORE INTEGRITY != RUNTIME AUTHORITY INTEGRITY`

The store question is whether the persisted read path detects altered,
mispositioned, absent, or replayed state. The runtime question is whether an
accepted or absent record can widen authority, cross physical context, reach a
second dispatch/effect, or restore authority after consumption. Position and
explicit physical-context binding improve the store/read boundary. Existing
G1-G4/R3 bindings, current physical-workspace observation, G9 pre-dispatch
claim, G10 post-effect consumption, journal evidence, Manifest CAS, and G8
no-authority recovery remain the runtime enforcement boundary.

This change does not claim protection against every rollback and does not
claim external certification.
