'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { PassThrough } = require('node:stream');
const { once } = require('node:events');

const {
  materializeGovernedEngineeringProposal
} = require('../../../accelerator/core/governed-engineering-proposal');
const {
  createInteractiveSession
} = require('../../../accelerator/cli/surgical');

const phase = process.env.SDO_R6_REPAIR_PHASE;
const continuityStateRoot = process.env.SDO_NATURAL_MISSION_STATE_ROOT;
const authorityRoot = process.env.SDO_NATURAL_PATCH_AUTHORITY_ROOT;
const journalStorageRoot = process.env.SDO_NATURAL_PATCH_JOURNAL_ROOT;
const repository = fs.realpathSync(process.cwd());

if (!['PREPARE', 'APPROVE'].includes(phase)) {
  throw new Error('Qualified R6 repair-process phase is required.');
}

const input = new PassThrough();
const output = new PassThrough();
let observed = '';
output.on('data', (chunk) => {
  const text = chunk.toString();
  observed += text;
  process.stdout.write(text);
});

function waitFor(pattern, timeout = 12_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      if (pattern.test(observed)) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - started > timeout) {
        clearInterval(interval);
        reject(new Error(`Timed out waiting for ${pattern}.`));
      }
    }, 10);
  });
}

function cognitiveSession() {
  let evidenceDecision = 0;
  return Object.freeze({
    async decideEvidence() {
      evidenceDecision += 1;
      return evidenceDecision === 1
        ? Object.freeze({
            schema: 'sdo.natural_evidence_decision.v1',
            decision: 'REQUEST_EVIDENCE',
            response: null,
            evidenceRequest: Object.freeze({
              kind: 'READ_FILE',
              target: 'impl.js',
              reason: 'Bind exact physical BEFORE evidence.'
            })
          })
        : Object.freeze({
            schema: 'sdo.natural_evidence_decision.v1',
            decision: 'RESPOND',
            response: 'The exact bounded evidence is sufficient.',
            evidenceRequest: null
          });
    },
    async proposePatch(objective) {
      const before = fs.readFileSync(path.join(repository, 'impl.js'));
      return materializeGovernedEngineeringProposal({
        schema: 'sdo.ai_engineering_patch_proposal.v1',
        objective,
        target: 'impl.js',
        beforeSha256: crypto.createHash('sha256').update(before).digest('hex'),
        replacementBase64: Buffer.from("'use strict';\nmodule.exports = true;\n").toString('base64'),
        reason: 'Apply only the physically evidenced impl.js repair.',
        validationKind: 'VALIDATE_JS'
      });
    }
  });
}

async function main() {
  const rl = createInteractiveSession(
    Object.freeze({
      repositoryPath: repository,
      workspace: 'r6-real-restart-repair',
      protocols: Object.freeze({ bhSep: '2.2', bhSdp: '2.2' }),
      interactionMode: Object.freeze({ mode: 'NATURAL' }),
      language: 'pt-BR'
    }),
    {
      input,
      output,
      terminal: false,
      continuityStateRoot,
      ...(phase === 'PREPARE' ? { cognitiveSession: cognitiveSession() } : {}),
      patchOptions: {
        authorityRoot,
        journalStorageRoot,
        tenantId: 'r6-real-restart',
        projectId: 'r6-real-restart-repair'
      }
    }
  );

  if (phase === 'PREPARE') {
    input.write(
      'repare impl.js; teste repair.test.js; qualifique qualification.test.js\n'
    );
    await waitFor(/Falha física delimitada e registrada/);
    input.write('corrija isso\n');
    await waitFor(/aprovar reparo [a-f0-9]{64}/);
    const proposal = observed.match(/aprovar reparo ([a-f0-9]{64})/)[1];
    process.stdout.write(`R6_PROPOSAL=${proposal}\n`);
  } else {
    const proposal = process.env.SDO_R6_REPAIR_PROPOSAL;
    if (!/^[a-f0-9]{64}$/.test(proposal || '')) {
      throw new Error('Exact persisted repair proposal fingerprint is required.');
    }
    input.write(`aprovar reparo ${proposal}\n`);
    await waitFor(/AUTHORITY_REQUIRED|requer autoridade|requires authority/);
    input.write('/status\n');
    await waitFor(/State: BLOCKED/);
  }

  input.write('exit\n');
  input.end();
  if (!rl.closed) await once(rl, 'close');
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
  input.destroy();
  output.destroy();
});
