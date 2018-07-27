const mockFs = require('mock-fs');
const expect = require('chai').expect;

const grpcLibrary = require('grpc')
const protoLoader = require('@grpc/proto-loader')

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
  {
    id: 'Empty',
  },
  {
    id: 'someValue',
  }
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
    const package = {
      name: 'foo-bar',
      refs: ['external'],
      calls: [
        // FIXME: provide this through schemas too?
        { req: 'something', resp: 'someValue' },
      ],
    };

    const models = await jst.parse(__dirname, refs, schema);
    const code = jst.generate(package, models, jst.protobufDefs);

    mockFs({
      'generated.proto': Buffer.from(code),
    });

    try {
      const protoOptions = {};
      const packageDefinition = protoLoader.loadSync('generated.proto', protoOptions);
      const packageObject = grpcLibrary.loadPackageDefinition(packageDefinition);

      expect(packageObject.fooBar.FooBar).not.to.be.undefined;

      expect(code).not.to.contain('undefined');
      expect(code).not.to.contain('null');
      expect(code).not.to.contain('NaN');

      expect(code).to.contain('repeated string values = 3;');
      expect(code).not.to.contain('message ItemValue');
    } catch (e) {
      const matches = e.message.match(/line (\d+)/);

      if (matches) {
        console.log(e.message);
        console.log(code.trim().split('\n')
          .map((x, l) => `${(matches[1] - 1) === l ? ' >' : '  '} ${`00${l + 1}`.substr(-2)} ${x}`)
          .join('\n'));
      } else {
        console.log(code);
      }

      throw e;
    } finally {
      mockFs.restore();
    }
  });
});
