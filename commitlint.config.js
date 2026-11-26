export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Keep the first line readable in terminals and Git hosting UIs.
    'header-max-length': [2, 'always', 100],
    // Make the allowed Conventional Commit types explicit for learners.
    'type-enum': [
      2,
      'always',
      ['build', 'chore', 'ci', 'docs', 'feat', 'fix', 'perf', 'refactor', 'revert', 'style', 'test'],
    ],
  },
};
