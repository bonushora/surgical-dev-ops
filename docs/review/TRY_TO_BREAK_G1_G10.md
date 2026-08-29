# Try to Break the Interactive G1-G10 Loop

Português: [TRY_TO_BREAK_G1_G10_PT-BR.md](./TRY_TO_BREAK_G1_G10_PT-BR.md)

This is the incremental white-box campaign for v2.6.0-rc.3. It extends, and
does not replace, the v2.6.0-rc.2 challenge in [TRY_TO_BREAK_IT.md](./TRY_TO_BREAK_IT.md).

## Target invariant

No model output, conversation, stale state, concurrent process or persisted
artifact may create, broaden, transfer or reuse operational authority. One
exact human decision may authorize only the exact workspace, target, BEFORE
content, replacement, validation and bounded lifetime that were presented.

## Required attacks

1. **Patch substitution:** approve fingerprint A and submit replacement B.
2. **State substitution:** change HEAD or BEFORE after proposal and before dispatch.
3. **Replay:** reuse the same signed authorization before and after process reopen.
4. **Concurrent claim:** race two consumers for the same authorization.
5. **Interrupted transition:** terminate after claim, dispatch or CAS and reconcile.
6. **Workspace escape:** use absolute paths, `..`, symlinks, aliases and case variants.
7. **Evidence tampering:** alter journal, Manifest CAS, fingerprint or persisted result.
8. **Provider authority injection:** place approval or tool instructions in model output.
9. **Bilingual ambiguity:** mix Portuguese, English, Unicode confusables and negation.
10. **Failure laundering:** make a partial mutation, timeout or failed validation appear green.

## Safe reproduction

Run attacks only against a disposable temporary Git repository. Do not use
credentials, external targets or destructive commands.

```bash
npm ci
node --test tests/accelerator/natural-development-native-mutation-acceptance.test.js
node --test tests/accelerator/natural-development-rc3-adversarial-readiness.test.js
npm test
npm pack --dry-run
```

## Report a counterexample

Record the exact commit, platform, Node version, preconditions, input, observed
effect and affected invariant. Remove secrets and personal paths. A valid
counterexample must be reproducible and must turn a permanent regression test red.

## Non-claims

Passing this campaign is not proof of absolute security, is not a completed
independent audit and does not qualify unimplemented languages or capabilities.
