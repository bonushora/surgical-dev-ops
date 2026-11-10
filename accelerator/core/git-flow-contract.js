'use strict';

const crypto = require('node:crypto');
const path = require('node:path');

const AUTHORIZATION_SCHEMA = 'sdo.git_flow_authorization.v1';
const EVIDENCE_SCHEMA = 'sdo.git_flow_evidence_identity.v1';
const REPORT_SCHEMA = 'sdo.git_flow_report.v1';
const SNAPSHOT_SCHEMA = 'sdo.bh_sdp_snapshot.v2.3';
const RISKS = Object.freeze(['BAIXO', 'MÉDIO', 'ALTO']);
const ENVIRONMENTS = Object.freeze(['localhost', 'Preview', 'Production']);
const STATES = Object.freeze(['GREEN', 'BLOCKED', 'WARNING', 'DEFERRED']);
const AUTHORITY_KEYS = Object.freeze([
  'COMMIT_AUTHORIZED',
  'PUSH_AUTHORIZED',
  'DISCLOSURE_AUTHORIZED'
]);

const SECRET_RULES = Object.freeze([
  Object.freeze({ id: 'PRIVATE_KEY', pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/i }),
  Object.freeze({ id: 'NPM_AUTH', pattern: /(?:^|\n)\s*\/\/[^\s:]+\/:_authToken\s*=\s*\S+/i }),
  Object.freeze({ id: 'CLOUD_CREDENTIAL', pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/ }),
  Object.freeze({ id: 'KNOWN_TOKEN', pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,}|npm_[A-Za-z0-9]{20,})\b/ }),
  Object.freeze({ id: 'ASSIGNMENT_SECRET', pattern: /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password|passwd)\s*[:=]\s*[^\s,;]{8,}/i })
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])
  );
}

function fingerprint(schema, fields) {
  return crypto
    .createHash('sha256')
    .update(`${schema}\0${JSON.stringify(canonicalize(fields))}`, 'utf8')
    .digest('hex');
}

function text(value, name, maximum = 4096) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() ||
      value.length > maximum || /[\0\r]/u.test(value)) {
    throw new Error(`${name} is malformed.`);
  }
  return value;
}

function oid(value, name) {
  const result = text(value, name, 64);
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(result)) {
    throw new Error(`${name} is malformed.`);
  }
  return result;
}

function canonicalFile(value) {
  const lexical = text(value, 'Authorized file', 1024).replace(/\\/g, '/');
  const normalized = path.posix.normalize(lexical).replace(/^\.\//, '');
  if (!normalized || normalized === '.' || normalized.startsWith('/') ||
      normalized === '..' || normalized.startsWith('../') ||
      normalized.split('/').some((segment) => !segment || segment === '.git')) {
    throw new Error('Authorized file must be a canonical workspace-relative path.');
  }
  return normalized;
}

function stringArray(value, name, maximum = 256) {
  if (!Array.isArray(value) || value.length === 0 || value.length > maximum) {
    throw new Error(`${name} is malformed.`);
  }
  const result = value.map((item) => text(item, name, 2048));
  if (new Set(result).size !== result.length) throw new Error(`${name} contains duplicates.`);
  return result;
}

function validationCommands(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 16) {
    throw new Error('Validation commands are malformed.');
  }
  return value.map((command) => {
    if (!Array.isArray(command) || command.length === 0 || command.length > 64) {
      throw new Error('Validation command is malformed.');
    }
    return command.map((part) => text(part, 'Validation command argument', 4096));
  });
}

function exactObject(value, keys, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join('\0') !== [...keys].sort().join('\0')) {
    throw new Error(`${name} is malformed.`);
  }
  return value;
}

function minimumValidations(risk) {
  return risk === 'ALTO' ? 3 : risk === 'MÉDIO' ? 2 : 1;
}

function createGitFlowAuthorization({
  authorizationId,
  objective,
  workspace,
  environment = 'localhost',
  risk = 'MÉDIO',
  authorizedFiles,
  validation,
  remote,
  expectedHead,
  authorities
} = {}) {
  const normalizedRisk = text(risk, 'Git Flow risk', 16).toUpperCase();
  if (!RISKS.includes(normalizedRisk)) throw new Error('Git Flow risk is unsupported.');
  if (!ENVIRONMENTS.includes(environment)) throw new Error('Git Flow environment is unsupported.');

  const files = authorizedFiles.map(canonicalFile).sort();
  if (files.length === 0 || new Set(files).size !== files.length) {
    throw new Error('Authorized files are empty or duplicated.');
  }
  const commands = validationCommands(validation);
  if (commands.length < minimumValidations(normalizedRisk)) {
    throw new Error('Validation coverage is below the risk-proportional minimum.');
  }

  const remoteInput = exactObject(remote, ['name', 'url', 'branch', 'expectedSha'], 'Remote identity');
  const authorityInput = exactObject(authorities, AUTHORITY_KEYS, 'Git Flow authorities');
  if (AUTHORITY_KEYS.some((key) => typeof authorityInput[key] !== 'boolean')) {
    throw new Error('Git Flow authorities must be explicit booleans.');
  }

  const fields = {
    schema: AUTHORIZATION_SCHEMA,
    authorizationId: text(authorizationId, 'Authorization id', 256),
    objective: text(objective, 'Authorization objective'),
    workspace: text(workspace, 'Authorization workspace', 2048),
    environment,
    risk: normalizedRisk,
    authorizedFiles: files,
    validation: commands,
    remote: {
      name: text(remoteInput.name, 'Remote name', 128),
      url: text(remoteInput.url, 'Remote URL', 2048),
      branch: text(remoteInput.branch, 'Remote branch', 1024),
      expectedSha: oid(remoteInput.expectedSha, 'Expected remote SHA')
    },
    expectedHead: oid(expectedHead, 'Expected local HEAD'),
    authorities: Object.fromEntries(AUTHORITY_KEYS.map((key) => [key, authorityInput[key]])),
    failClosed: true,
    forcePushAllowed: false,
    hooksBypassAllowed: false,
    secretDetectionScope: 'BOUNDED_DETERMINISTIC_PATTERNS_NOT_UNIVERSAL_SECRET_DETECTION'
  };

  return deepFreeze({
    ...fields,
    authorizationFingerprint: fingerprint(AUTHORIZATION_SCHEMA, fields)
  });
}

function validateGitFlowAuthorization(value) {
  if (!value || !Object.isFrozen(value) || value.schema !== AUTHORIZATION_SCHEMA ||
      !/^[a-f0-9]{64}$/.test(value.authorizationFingerprint || '') ||
      value.failClosed !== true || value.forcePushAllowed !== false ||
      value.hooksBypassAllowed !== false) {
    throw new Error('Immutable Git Flow authorization is required.');
  }
  const recreated = createGitFlowAuthorization(value);
  if (recreated.authorizationFingerprint !== value.authorizationFingerprint) {
    throw new Error('Git Flow authorization fingerprint mismatch.');
  }
  return value;
}

function classifyGitFlowRisk({ operation, environment = 'localhost', sensitive = false,
  destructive = false, historyRewrite = false } = {}) {
  const normalized = text(operation, 'Git operation', 64).toUpperCase();
  let risk = normalized === 'OBSERVE' ? 'BAIXO' : 'MÉDIO';
  const reasons = [];
  if (risk === 'MÉDIO') reasons.push('Git mutation has bounded consumers and requires explicit scope.');
  if (environment === 'Production' || sensitive || destructive || historyRewrite) {
    risk = 'ALTO';
    reasons.push('Production, sensitive, destructive, or history-rewriting effect requires ALTO controls.');
  }
  if (normalized === 'OBSERVE') reasons.push('Read-only Git observation is BAIXO risk.');
  return deepFreeze({ risk, operation: normalized, reasons: [...new Set(reasons)] });
}

function inspectCredentialContent({ target, content } = {}) {
  const file = canonicalFile(target);
  if (!Buffer.isBuffer(content) && typeof content !== 'string') {
    throw new Error('Staged content must be bytes or text.');
  }
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  const textContent = bytes.toString('utf8');
  const rules = SECRET_RULES.filter((rule) => {
    rule.pattern.lastIndex = 0;
    return rule.pattern.test(textContent);
  }).map((rule) => rule.id).sort();
  return deepFreeze({
    target: file,
    state: rules.length ? 'BLOCKED' : 'GREEN',
    rules,
    bytes: bytes.length,
    contentSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    classificationComplete: false
  });
}

function createGitFlowEvidenceIdentity({ workspace, environment, head, remote,
  authorizedFiles, validationFingerprint } = {}) {
  exactObject(remote, ['url', 'branch', 'sha'], 'Evidence remote identity');
  const fields = {
    schema: EVIDENCE_SCHEMA,
    workspace: text(workspace, 'Evidence workspace', 2048),
    environment: text(environment, 'Evidence environment', 64),
    head: oid(head, 'Evidence HEAD'),
    remote: {
      url: text(remote.url, 'Evidence remote URL', 2048),
      branch: text(remote.branch, 'Evidence remote branch', 1024),
      sha: oid(remote.sha, 'Evidence remote SHA')
    },
    authorizedFiles: stringArray(authorizedFiles.map(canonicalFile).sort(), 'Evidence authorized file'),
    validationFingerprint: text(validationFingerprint, 'Validation fingerprint', 64)
  };
  if (!/^[a-f0-9]{64}$/.test(fields.validationFingerprint)) {
    throw new Error('Validation fingerprint is malformed.');
  }
  return deepFreeze({ ...fields, evidenceFingerprint: fingerprint(EVIDENCE_SCHEMA, fields) });
}

function canReuseGitFlowEvidence(previous, current) {
  try {
    return createGitFlowEvidenceIdentity(previous).evidenceFingerprint ===
      createGitFlowEvidenceIdentity(current).evidenceFingerprint;
  } catch {
    return false;
  }
}

function createGitFlowReport({ authorization, state, phase, commitSha = null,
  observedRemoteSha = null, validations = [], warnings = [], recovery = null } = {}) {
  const bound = validateGitFlowAuthorization(authorization);
  if (!STATES.includes(state)) throw new Error('Git Flow report state is unsupported.');
  const fields = {
    schema: REPORT_SCHEMA,
    authorizationId: bound.authorizationId,
    authorizationFingerprint: bound.authorizationFingerprint,
    state,
    phase: text(phase, 'Git Flow phase', 128),
    workspace: bound.workspace,
    risk: bound.risk,
    authorizedFiles: bound.authorizedFiles,
    remote: {
      url: bound.remote.url,
      branch: bound.remote.branch,
      expectedSha: bound.remote.expectedSha,
      observedSha: observedRemoteSha
    },
    commitSha,
    validations,
    warnings,
    recovery
  };
  return deepFreeze({ ...fields, reportFingerprint: fingerprint(REPORT_SCHEMA, fields) });
}

function createSdpSnapshot({ authorization, phase, state, commitSha = '', remoteSha = '',
  testsStatus = 'NÃO_EXECUTADO', components = [], gates = 0, attempts = 0,
  manualActions = [], deferred = [], nextStep } = {}) {
  const bound = validateGitFlowAuthorization(authorization);
  if (!STATES.includes(state)) throw new Error('Snapshot state is unsupported.');
  const green = state === 'GREEN' ? 'PASSOU' : state === 'DEFERRED' ? 'DEFERRED' :
    state === 'BLOCKED' ? 'FALHOU' : 'NÃO_EXECUTADO';
  return deepFreeze({
    schema: SNAPSHOT_SCHEMA,
    nome_do_projeto: 'Surgical DevOps',
    versao_do_protocolo: 'BH-SDP v2.3',
    tipo_de_arquitetura: 'Governed Git Flow runner',
    meta_de_custo: 'PATCH mínimo; sem dependências novas',
    fase_atual: text(phase, 'Snapshot phase', 128),
    nivel_de_risco: bound.risk,
    contagem_de_gates: gates,
    tentativas_equivalentes: attempts,
    acoes_manuais: manualActions,
    ambiente: bound.environment,
    destino_fisico: {
      url: bound.remote.url,
      branch: bound.remote.branch,
      sha_antes: bound.remote.expectedSha,
      sha_depois: remoteSha
    },
    estado_green: {
      codigo: green,
      backend: 'NOT_APPLICABLE',
      interface: 'NOT_APPLICABLE',
      operacao: green,
      implantacao: 'NOT_APPLICABLE',
      publicacao: phase === 'PUBLISHED' ? green : 'NÃO_EXECUTADO',
      experiencia_humana: green
    },
    itens_deferred: deferred,
    ancoras_fisicas: {
      hash_do_commit: commitSha,
      status_dos_testes: testsStatus,
      ultimas_linhas_inspecionadas: `report:${bound.authorizationFingerprint}`
    },
    componentes_validados: components,
    proximo_passo: text(nextStep, 'Snapshot next step')
  });
}

module.exports = deepFreeze({
  AUTHORIZATION_SCHEMA,
  EVIDENCE_SCHEMA,
  REPORT_SCHEMA,
  SNAPSHOT_SCHEMA,
  RISKS,
  STATES,
  AUTHORITY_KEYS,
  createGitFlowAuthorization,
  validateGitFlowAuthorization,
  classifyGitFlowRisk,
  inspectCredentialContent,
  createGitFlowEvidenceIdentity,
  canReuseGitFlowEvidence,
  createGitFlowReport,
  createSdpSnapshot
});
