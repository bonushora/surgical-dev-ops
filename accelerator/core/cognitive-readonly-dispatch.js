'use strict';

const {
  createCognitiveReadOnlyAuthorityRequest
} = require(
  './cognitive-readonly-authority-composition'
);

const {
  orchestrate
} = require(
  './surgical-orchestrator'
);

function dispatchCognitiveReadOnly(
  {
    admission,
    repositoryPath
  },
  options = {}
) {
  const request =
    createCognitiveReadOnlyAuthorityRequest(
      {
        admission,
        repositoryPath
      },
      options
    );

  return orchestrate(
    request
  );
}

module.exports = {
  dispatchCognitiveReadOnly
};
