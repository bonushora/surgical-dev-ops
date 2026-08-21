'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  createMutationJournalAdapter
} = require('../../accelerator/adapters/mutation-journal-adapter');

function durabilityReceipt(operation) {
  return Object.freeze({
    schema: 'sdo.mutation_durability_receipt.v1',
    operation,
    status: 'CONFIRMED',
    claimLevel: 'FILESYSTEM_DURABILITY_PRIMITIVES_ENFORCED',
    platform: process.platform,
    powerLossValidated: false
  });
}

const durabilityAdapter = Object.freeze({
  flushFile() {
    return durabilityReceipt('FLUSH_FILE_DATA');
  },
  flushDirectory() {
    return durabilityReceipt('FLUSH_DIRECTORY');
  },
  confirmRename() {
    return durabilityReceipt('DURABLE_RENAME_BOUNDARY');
  },
  confirmJournal(_directory, terminal = false) {
    return durabilityReceipt(
      terminal ? 'DURABLE_FINALIZATION' : 'DURABLE_JOURNAL_APPEND'
    );
  },
  confirmLock() {
    return durabilityReceipt('DURABLE_LOCK_BOUNDARY');
  }
});

test(
  'journal accepts a canonical absolute root whose parent was materialized from filesystem evidence',
  (t) => {
    const lexicalTemporaryRoot = os.tmpdir();
    const physicalTemporaryRoot = fs.realpathSync(lexicalTemporaryRoot);

    const base = fs.mkdtempSync(
      path.join(physicalTemporaryRoot, 'sdo-journal-physical-root-')
    );

    t.after(() => {
      fs.rmSync(base, { recursive: true, force: true });
    });

    const storageRoot = path.join(base, 'journal');
    fs.mkdirSync(storageRoot, { mode: 0o700 });

    const physicalStorageRoot = fs.realpathSync(storageRoot);

    assert.equal(
      path.normalize(physicalStorageRoot),
      physicalStorageRoot
    );

    assert.doesNotThrow(() => {
      createMutationJournalAdapter({
        storageRoot: physicalStorageRoot,
        durabilityAdapter
      });
    });
  }
);

test(
  'journal continues to reject a symlink storage root even when it resolves to a trusted physical directory',
  (t) => {
    const physicalTemporaryRoot = fs.realpathSync(os.tmpdir());

    const base = fs.mkdtempSync(
      path.join(physicalTemporaryRoot, 'sdo-journal-symlink-root-')
    );

    t.after(() => {
      fs.rmSync(base, { recursive: true, force: true });
    });

    const storageRoot = path.join(base, 'journal');
    const storageLink = path.join(base, 'journal-link');

    fs.mkdirSync(storageRoot, { mode: 0o700 });

    try {
      fs.symlinkSync(storageRoot, storageLink, 'dir');
    } catch (error) {
      if (
        error.code === 'EPERM' ||
        error.code === 'EACCES' ||
        error.code === 'ENOTSUP'
      ) {
        return t.skip('Symlink creation is unavailable on this platform.');
      }
      throw error;
    }

    assert.throws(
      () => createMutationJournalAdapter({
        storageRoot: storageLink,
        durabilityAdapter
      }),
      /unsafe|ambiguous/
    );
  }
);

test(
  'journal accepts a non-symlink storage root reached through a lexical ancestor alias',
  (t) => {
    const lexicalTemporaryRoot = path.normalize(os.tmpdir());
    const physicalTemporaryRoot = fs.realpathSync(lexicalTemporaryRoot);

    if (lexicalTemporaryRoot === physicalTemporaryRoot) {
      return t.skip(
        'This platform exposes no lexical/physical tmpdir divergence.'
      );
    }

    const lexicalBase = fs.mkdtempSync(
      path.join(lexicalTemporaryRoot, 'sdo-journal-ancestor-alias-')
    );

    const physicalBase = fs.realpathSync(lexicalBase);

    t.after(() => {
      fs.rmSync(physicalBase, { recursive: true, force: true });
    });

    const lexicalStorageRoot = path.join(lexicalBase, 'journal');

    fs.mkdirSync(lexicalStorageRoot, { mode: 0o700 });

    const lexicalStat = fs.lstatSync(lexicalStorageRoot);
    const physicalStorageRoot = fs.realpathSync(lexicalStorageRoot);

    assert.equal(
      lexicalStat.isDirectory(),
      true
    );

    assert.equal(
      lexicalStat.isSymbolicLink(),
      false
    );

    assert.notEqual(
      lexicalStorageRoot,
      physicalStorageRoot
    );

    assert.doesNotThrow(() => {
      createMutationJournalAdapter({
        storageRoot: lexicalStorageRoot,
        durabilityAdapter
      });
    });
  }
);
