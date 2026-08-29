'use strict';

const SHELL_COMMANDS = Object.freeze([
  'cd', 'pwd', 'ls', 'find', 'cat', 'head', 'tail', 'less', 'more',
  'grep', 'rg', 'sed', 'awk', 'sort', 'wc', 'cut', 'xargs', 'tee',
  'printf', 'echo',
  'node', 'npm', 'npx', 'pnpm', 'yarn', 'gh', 'curl', 'wget',
  'sha256sum', 'tar', 'gzip', 'gunzip', 'base64', 'python',
  'python3', 'bash', 'sh', 'zsh', 'powershell', 'pwsh'
]);

const CANONICAL_GIT_READS = Object.freeze([
  'git root',
  'git branch',
  'git head',
  'git status',
  'git tracked'
]);

function normalizeLine(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function classifyNaturalTerminalInput(value) {
  const source = String(value || '');
  const raw = normalizeLine(source);

  if (!raw || source.includes('\n') || source.includes('\r')) {
    return Object.freeze({ boundary: raw ? 'MULTILINE' : 'NONE' });
  }

  const lower = raw.toLowerCase();

  if (CANONICAL_GIT_READS.includes(lower)) {
    return Object.freeze({ boundary: 'NONE' });
  }

  const first = lower.split(' ')[0];
  const shellSyntax =
    /(^|\s)(&&|\|\||[|;<>]|\$\(|`)/.test(raw) ||
    /^[A-Za-z_][A-Za-z0-9_]*=/.test(raw) ||
    (first === 'git' && !CANONICAL_GIT_READS.includes(lower));

  if (SHELL_COMMANDS.includes(first) || shellSyntax) {
    return Object.freeze({
      boundary: 'SYSTEM_TERMINAL',
      command: first
    });
  }

  return Object.freeze({ boundary: 'NONE' });
}

function formatNaturalTerminalBoundary(result, language = 'pt-BR') {
  if (!result || result.boundary === 'NONE') {
    return '';
  }

  if (result.boundary === 'MULTILINE') {
    if (language === 'en') {
      return (
        'The input contains multiple lines and will not be interpreted as a sequence of decisions.\n' +
        'Send one request at a time. For system commands, close with "exit" and use the external terminal.\n' +
        'No operation was executed and no authorization was granted.\n'
      );
    }

    return (
      'A entrada contém várias linhas e não será interpretada como uma sequência de decisões.\n' +
      'Envie uma solicitação por vez. Para comandos do sistema, encerre com "exit" e use o terminal externo.\n' +
      'Nenhuma operação foi executada e nenhuma autorização foi concedida.\n'
    );
  }

  if (language === 'en') {
    return (
      'This appears to be a system terminal command, not a Surgical DevOps request.\n' +
      'Nothing was executed. Type "exit" to close the session and run the command at the external "user@...$" prompt.\n' +
      'The "surgical>" prompt accepts governed conversation and Surgical DevOps commands.\n'
    );
  }

  return (
    'Isto parece ser um comando do terminal do sistema, não uma solicitação ao Surgical DevOps.\n' +
    'Nada foi executado. Digite "exit" para encerrar a sessão e execute o comando no prompt externo "usuario@...$".\n' +
    'O prompt "surgical>" aceita conversa governada e comandos próprios do Surgical DevOps.\n'
  );
}

module.exports = Object.freeze({
  classifyNaturalTerminalInput,
  formatNaturalTerminalBoundary
});
