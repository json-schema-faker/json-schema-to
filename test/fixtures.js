const pkgInfo = {
  pkg: 'foo-bar',
  refs: ['external'],
  calls: [
    // FIXME: provide this through schemas too?
    {
      set: 'something', resp: 'Test', input: 'Value', required: true,
    },
    { get: 'anythingElse', resp: 'Test' },
  ],
};

const definitions = {
  models: {},
  enums: [],
  deps: {},
};

module.exports = {
  pkgInfo,
  definitions,
};
