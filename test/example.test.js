const mockFs = require('mock-fs');
const expect = require('chai').expect;

const grpcLibrary = require('grpc')
const protoLoader = require('@grpc/proto-loader')

const is = require('is-my-json-valid');
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
    id: 'Value',
    // FIXME: object causes bugs...
    // type: 'object',
    properties: {
      example: {
        type: 'number',
      },
    },
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
    const package = {
      name: 'foo-bar',
      refs: ['external'],
      calls: [
        // FIXME: provide this through schemas too?
        { req: 'something', resp: 'Test', input: 'Value' },
      ],
    };

    const models = await jst.parse(__dirname, refs, schema);
    const code = jst.generate(package, models, jst.protobufDefs);

    mockFs({
      'generated.proto': Buffer.from(code),
    });

    const serverInstance = new grpcLibrary.Server();

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

      serverInstance.addService(packageObject.fooBar.FooBar.service, {
        async something(ctx, reply) {
          const validate = is(refs.find(x => x.id === 'Value'));

          await validate(ctx.request);

          console.log('CALL', ctx.request, validate.errors);

          reply(null, {
            foo: 'BAR',
            id: 99,
          });
        },
      });

      serverInstance.bind('0.0.0.0:50051', grpcLibrary.ServerCredentials.createInsecure());
      serverInstance.start();

      await new Promise(done => {
        const gateway = new packageObject.fooBar.FooBar('0.0.0.0:50051', grpcLibrary.credentials.createInsecure());

        const payload = {
          value: 'OK',
          example: 4.20,
        };

        const deadline = new Date();

        deadline.setSeconds(deadline.getSeconds() + 3);

        gateway.something(payload, { deadline }, async (error, response) => {
          const validate = is(schema, {
            schemas: refs.reduce((prev, cur) => {
              prev[cur.id] = cur;
              return prev;
            }, {}),
          });

          await validate(response);

          console.log(error, response, validate.errors);
          done();
        });
      });
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

      await new Promise(done => {
        serverInstance.tryShutdown(done);
      });
    }
  });
});
