'use strict';

const readline = require('node:readline');

const PROFILE_BY_CHOICE =
  Object.freeze({
    '1': 'NATURAL',
    '2': 'ENGINEER',
    '3': 'EXPERT'
  });

function text(language) {
  if (language === 'EN') {
    return Object.freeze({
      profile:
        '\nChoose your experience:\n' +
        '  1. NATURAL — conversational guidance\n' +
        '  2. ENGINEER — assisted development with technical evidence\n' +
        '  3. EXPERT — explicit deterministic commands\n' +
        'Profile [1-3]: ',
      saved: mode =>
        `\n${mode} selected. Governance and human authority are unchanged.\n\n`
    });
  }

  return Object.freeze({
    profile:
      '\nEscolha sua experiência:\n' +
      '  1. NATURAL — orientação conversacional\n' +
      '  2. ENGINEER — desenvolvimento assistido com evidências técnicas\n' +
      '  3. EXPERT — comandos determinísticos explícitos\n' +
      'Perfil [1-3]: ',
    saved: mode =>
      `\n${mode} selecionado. A governança e a autoridade humana permanecem inalteradas.\n\n`
  });
}

async function askClosed(
  question,
  accepted,
  lines,
  output
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    output.write(question);

    const next = await lines.next();

    if (next.done) {
      throw new Error(
        'Onboarding input closed before a bounded selection was completed.'
      );
    }

    const answer =
      String(next.value).trim();

    if (accepted.includes(answer)) return answer;
  }

  throw new Error(
    'Onboarding stopped after three invalid bounded selections.'
  );
}

async function runUnifiedInteractionOnboarding({
  input,
  output,
  preferenceStore
} = {}) {
  if (
    !input ||
    !output ||
    !preferenceStore ||
    typeof preferenceStore.save !== 'function'
  ) {
    throw new Error(
      'Unified onboarding requires explicit streams and preference store.'
    );
  }

  const rl =
    readline.createInterface({ input, output });
  const lines = rl[Symbol.asyncIterator]();

  try {
    output.write(
      'Surgical DevOps — configuração inicial / first-time setup\n' +
      '  1. Português\n' +
      '  2. English\n'
    );

    const languageChoice =
      await askClosed(
        'Idioma / Language [1-2]: ',
        ['1', '2'],
        lines,
        output
      );

    const language =
      languageChoice === '2' ? 'EN' : 'PT-BR';
    const messages = text(language);
    const profileChoice =
      await askClosed(
        messages.profile,
        ['1', '2', '3'],
        lines,
        output
      );
    const interactionMode =
      PROFILE_BY_CHOICE[profileChoice];
    const preference =
      preferenceStore.save({
        language,
        interactionMode
      });

    output.write(messages.saved(interactionMode));
    return preference;
  } finally {
    rl.close();
  }
}

module.exports = Object.freeze({
  PROFILE_BY_CHOICE,
  runUnifiedInteractionOnboarding
});
