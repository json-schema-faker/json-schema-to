const jsf = require('json-schema-faker');

jsf.option({
  alwaysFakeOptionals: true,
});

const jst = require('../lib');

const refs = [
  {
    id: 'dataTypes',
    definitions: {
      primaryKey: {
        type: 'integer',
      },
    },
  },
  {
    id: 'ItemValue',
    $ref: 'external.schema.json#/definitions/justAString',
  },
];

const schema = {
  id: 'Test',
  type: 'object',
  properties: {
    id: {
      $ref: 'dataTypes#/definitions/primaryKey',
    },
    value: {
      $ref: 'external.schema.json#/definitions/justAString',
    },
    values: {
      type: 'array',
      items: {
        $ref: 'ItemValue',
      },
    },
  },
};

describe('Test', () => {
  it('OK', async () => {
    const results = await jst.parse(__dirname, refs, schema);
    const output = jst.generate(results);

    console.log(JSON.stringify(jsf(schema, refs, __dirname), null, 2));
    console.log(JSON.stringify(results, null, 2));
    console.log(output);
  });
});
