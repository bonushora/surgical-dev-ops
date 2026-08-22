'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  createLocalOfflineHumanVerifier
} = require(
  '../../accelerator/adapters/local-offline-human-authority'
);

const {
  verifyHumanIdentityAssertion
} = require(
  '../../accelerator/adapters/identity-verification-adapter'
);

const {
  createAuthoritativeClock
} = require(
  '../../accelerator/core/authoritative-clock'
);

const root =
  fs.mkdtempSync(
    path.join(os.tmpdir(), 'sdo-local-human-')
  );

const workspace =
  fs.realpathSync(root);

test.after(() => {
  fs.rmSync(root, {
    recursive: true,
    force: true
  });
});

const ISSUED =
  '2026-08-22T12:00:00.000Z';

const NOW =
  '2026-08-22T12:00:01.000Z';

const EXPIRES =
  '2026-08-22T12:05:00.000Z';

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])])
  );
}

function encoded(value) {
  return Buffer.from(
    JSON.stringify(canonicalize(value)),
    'utf8'
  );
}

function keys() {
  return crypto.generateKeyPairSync('ed25519');
}

function publicPem(publicKey) {
  return publicKey.export({
    type: 'spki',
    format: 'pem'
  });
}

function challenge(overrides = {}) {
  return {
    schema: 'sdo.local_offline_human_challenge.v1',
    challengeId: 'challenge-1',
    issuer: 'local:human-1',
    subjectId: 'human-1',
    audience: ['surgical-devops'],
    operationId: 'op-1',
    workspace,
    tenantId: 'tenant-1',
    projectId: 'project-1',
    issuedAt: ISSUED,
    expiresAt: EXPIRES,
    ...overrides
  };
}

function signed(privateKey, value = challenge()) {
  return {
    schema: 'sdo.local_offline_human_signature.v1',
    challenge: value,
    signatureBase64:
      crypto
        .sign(
          null,
          encoded(value),
          privateKey
        )
        .toString('base64')
  };
}

function clock() {
  return createAuthoritativeClock({
    port: {
      read() {
        return {
          schema: 'sdo.system_clock_observation.v1',
          availability: 'AVAILABLE',
          source: 'TEST',
          wallTime: NOW,
          monotonicNanoseconds: '1000000000'
        };
      }
    }
  });
}

function request(rawAssertion) {
  return {
    rawAssertion,
    trustedIssuers: ['local:human-1'],
    expected: {
      subjectId: 'human-1',
      audience: 'surgical-devops',
      operationId: 'op-1',
      workspace,
      tenantId: 'tenant-1',
      projectId: 'project-1'
    }
  };
}

test(
  'valid Ed25519 local human signature produces VERIFIED identity evidence',
  () => {
    const pair = keys();

    const verifier =
      createLocalOfflineHumanVerifier({
        publicKeyPem:
          publicPem(pair.publicKey),
        issuer: 'local:human-1',
        subjectId: 'human-1'
      });

    const result =
      verifyHumanIdentityAssertion(
        request(
          signed(pair.privateKey)
        ),
        verifier,
        {
          reading: clock().read(),
          requireCurrent: true
        }
      );

    assert.equal(
      result.decision,
      'VERIFIED'
    );

    assert.equal(
      result.assertion.subject.id,
      'human-1'
    );

    assert.equal(
      result.assertion.authentication.method,
      'PUBLIC_KEY'
    );

    assert.equal(
      result.assertion.authentication.context,
      'LOCAL_OFFLINE_HUMAN_AUTHORITY'
    );

    assert.equal(
      result.evidence.verifierId,
      'sdo:local-offline-ed25519:v1'
    );
  }
);

test(
  'operation-bound challenge cannot be replayed for another operation',
  () => {
    const pair = keys();

    const verifier =
      createLocalOfflineHumanVerifier({
        publicKeyPem:
          publicPem(pair.publicKey),
        issuer: 'local:human-1',
        subjectId: 'human-1'
      });

    const raw =
      signed(pair.privateKey);

    assert.throws(
      () =>
        verifier.verify({
          ...request(raw),
          expected: {
            ...request(raw).expected,
            operationId: 'op-2'
          }
        }),
      /bound|authority/i
    );
  }
);

test(
  'tampered challenge fails signature verification',
  () => {
    const pair = keys();

    const verifier =
      createLocalOfflineHumanVerifier({
        publicKeyPem:
          publicPem(pair.publicKey),
        issuer: 'local:human-1',
        subjectId: 'human-1'
      });

    const raw =
      signed(pair.privateKey);

    const tampered = {
      ...raw,
      challenge: {
        ...raw.challenge,
        projectId: 'other-project'
      }
    };

    assert.throws(
      () =>
        verifier.verify(
          request(tampered)
        ),
      /bound|signature/i
    );
  }
);

test(
  'signature from an untrusted private key fails closed',
  () => {
    const trusted = keys();
    const attacker = keys();

    const verifier =
      createLocalOfflineHumanVerifier({
        publicKeyPem:
          publicPem(trusted.publicKey),
        issuer: 'local:human-1',
        subjectId: 'human-1'
      });

    assert.throws(
      () =>
        verifier.verify(
          request(
            signed(attacker.privateKey)
          )
        ),
      /signature/i
    );
  }
);

test(
  'verifier exports no signing, private-key, shell or process authority',
  () => {
    const surface =
      require(
        '../../accelerator/adapters/local-offline-human-authority'
      );

    assert.deepEqual(
      Object.keys(surface),
      ['createLocalOfflineHumanVerifier']
    );

    const source =
      fs.readFileSync(
        require.resolve(
          '../../accelerator/adapters/local-offline-human-authority'
        ),
        'utf8'
      );

    assert.doesNotMatch(
      source,
      /privateKey|generateKeyPair|execSync|spawnSync|child_process/
    );
  }
);
