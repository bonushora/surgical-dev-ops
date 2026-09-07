'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const NPM_CLI = process.env.npm_execpath;
const NPM_COMMAND =
  process.platform === 'win32'
    ? 'npm.cmd'
    : 'npm';

const {
  createHermeticGitRepository
} = require('./helpers/hermetic-git-repository');

function npm(arguments_, options) {
  if (typeof NPM_CLI === 'string' && NPM_CLI.length > 0) {
    return execFileSync(
      process.execPath,
      [NPM_CLI, ...arguments_],
      options
    );
  }

  return execFileSync(
    NPM_COMMAND,
    arguments_,
    {
      ...options,
      shell: process.platform === 'win32'
    }
  );
}

test('one npm installation exposes all three interaction experiences', async context => {
  const fixture = createHermeticGitRepository();
  context.after(() => fixture.cleanup());
  const temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), 'sdo-unified-install-')
  );
  context.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const packOutput = JSON.parse(
    npm(
      [
        'pack',
        '--json',
        '--offline',
        '--pack-destination',
        temporary
      ],
      {
        cwd: ROOT,
        encoding: 'utf8'
      }
    )
  )[0];
  const tarball = path.join(
    temporary,
    packOutput.filename
  );
  const prefix = path.join(temporary, 'prefix');

  npm(
    [
      'install',
      '--global',
      '--ignore-scripts',
      '--offline',
      '--omit=optional',
      '--prefix',
      prefix,
      tarball
    ],
    {
      cwd: ROOT,
      encoding: 'utf8'
    }
  );

  const executable =
    process.platform === 'win32'
      ? path.join(prefix, 'surgical.cmd')
      : path.join(prefix, 'bin', 'surgical');
  const globalNodeModules =
    process.platform === 'win32'
      ? path.join(prefix, 'node_modules')
      : path.join(prefix, 'lib', 'node_modules');
  const installedPackage = path.join(
    globalNodeModules,
    'surgical-dev-ops'
  );
  const installedDefinition = JSON.parse(
    fs.readFileSync(path.join(installedPackage, 'package.json'), 'utf8')
  );

  assert.equal(fs.existsSync(executable), true);
  assert.equal(
    installedDefinition.optionalDependencies['@openai/codex-sdk'],
    '0.153.4'
  );
  assert.equal(
    installedDefinition.dependencies?.['@openai/codex-sdk'],
    undefined
  );
  assert.equal(
    fs.existsSync(path.join(globalNodeModules, '@openai', 'codex-sdk')),
    false
  );

  for (const mode of [
    'NATURAL',
    'ENGINEER',
    'EXPERT'
  ]) {
    const output = execFileSync(
      executable,
      ['--interaction', mode],
      {
        cwd: fixture.repository,
        input: '',
        encoding: 'utf8',
        shell: process.platform === 'win32',
        env: {
          ...process.env,
          XDG_CONFIG_HOME: temporary,
          LOCALAPPDATA: temporary,
          APPDATA: temporary
        }
      }
    );

    if (mode === 'EXPERT') {
      assert.match(output, /Interaction: EXPERT/);
    } else {
      assert.match(
        output,
        /Você pode conversar comigo normalmente/
      );
    }
  }

  let localFallbackRequests = 0;
  let credentialRequests = 0;
  const {
    createNaturalCognitiveSession
  } = require(path.join(
    installedPackage,
    'accelerator/cli/natural-cognitive-session.js'
  ));
  const codexSession = createNaturalCognitiveSession({
    fetchImplementation: async () => {
      localFallbackRequests += 1;
      throw new Error('Explicit Codex selection must not fall back locally.');
    },
    codex: {
      enabled: true,
      credentialProvider: async () => {
        credentialRequests += 1;
        throw new Error('Missing optional SDK must block before credentials.');
      }
    }
  });
  context.after(() => codexSession.close());

  const discovery = await codexSession.describe();
  assert.equal(discovery.providerId, 'openai:codex-sdk');
  assert.equal(discovery.providerKind, 'CODEX');
  assert.equal(discovery.state, 'CODEX_CONTAINMENT_UNAVAILABLE');
  assert.equal(discovery.selectionMode, 'EXPLICIT_EXTERNAL');
  assert.equal(discovery.available, false);
  assert.equal(discovery.active, false);
  assert.equal(discovery.operationalAuthority, false);
  assert.match(discovery.reason, /Codex native cognitive containment is unavailable/);

  const unavailableOutput = await codexSession.ask(
    'Explique o próximo passo.',
    {
      workspace: fixture.repository,
      interactionMode: { mode: 'NATURAL' }
    }
  );
  assert.match(unavailableOutput, /serviço cognitivo externo Codex não está disponível/i);
  assert.doesNotMatch(unavailableOutput, /Ollama|provider cognitivo local/i);
  assert.equal(localFallbackRequests, 0);
  assert.equal(credentialRequests, 0);
});
