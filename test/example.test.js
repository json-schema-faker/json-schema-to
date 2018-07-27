/* eslint-disable no-unused-expressions */

const mockFs = require('mock-fs');
const expect = require('chai').expect;

const graphql = require('graphql');
const graphqlTools = require('graphql-tools');
const grpcLibrary = require('grpc');
const protoLoader = require('@grpc/proto-loader');

const is = require('is-my-json-valid');
const jsf = require('json-schema-faker');

jsf.option({
  alwaysFakeOptionals: true,
});

const jst = require('../lib');
const { trim } = require('../lib/utils');

const refs = require('./refs.schema.json');
const schema = require('./test.schema.json');

/* global describe, it */

describe('Test', () => {
  it('OK', async () => {
    const pkgInfo = {
      name: 'foo-bar',
      refs: ['external'],
      calls: [
        // FIXME: provide this through schemas too?
        {
          set: 'something', resp: 'Test', input: 'Value', required: true,
        },
        { get: 'anythingElse', resp: 'Test' },
      ],
    };

    const models = await jst.parse(__dirname, refs, schema);
    const gqlCode = jst.generate(pkgInfo, models, jst.graphqlDefs);
    const protoCode = jst.generate(pkgInfo, models, jst.protobufDefs);

    const root = {
      something() {
        return 42;
      },
      anythingElse() {
        return {
          id: 1,
          value: 'FOO',
          values: ['baz', 'buzz'],
        };
      },
    };

    const query = `query {
      anythingElse {
        id
        value
        values
      }
    }`;

    try {
      const graphqlSchema = trim(`
        type Query {
          dummy: [String]
        }
        type Mutation {
          dummy: [String]
        }
        schema {
          query: Query
          mutation: Mutation
        }
      `);

      const gql = graphqlTools.makeExecutableSchema({
        typeDefs: [graphqlSchema, gqlCode],
        resolvers: {},
      });

      const response = await graphql.graphql(gql, query, root);

      console.log('>>>', response.data);
    } catch (e) {
      console.log('# GraphQL');
      console.log(gqlCode);

      throw e;
    }

    mockFs({
      'generated.proto': Buffer.from(protoCode),
      'external.proto': Buffer.from('message Empty {}'),
    });

    const serverInstance = new grpcLibrary.Server();

    try {
      const protoOptions = {};
      const packageDefinition = protoLoader.loadSync('generated.proto', protoOptions);
      const packageObject = grpcLibrary.loadPackageDefinition(packageDefinition);

      expect(packageObject.fooBar.FooBar).not.to.be.undefined;

      expect(protoCode).not.to.contain('undefined');
      expect(protoCode).not.to.contain('null');
      expect(protoCode).not.to.contain('NaN');

      expect(protoCode).to.contain('repeated string values = 3;');
      expect(protoCode).not.to.contain('message ItemValue');

      serverInstance.addService(packageObject.fooBar.FooBar.service, {
        anythingElse(ctx, reply) {
          reply(null, {});
        },
        async something(ctx, reply) {
          const validate = is(refs.find(x => x.id === 'Value'));

          await validate(ctx.request);

          console.log('CALL', ctx.request, validate.errors);

          reply(null, {
            id: 99,
            foo: 'BAR',
            values: ['OK'],
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
          // console.log(protoCode);
          done();
        });
      });
    } catch (e) {
      const matches = e.message.match(/line (\d+)/);

      console.log('# Protobuf');

      if (matches) {
        console.log(protoCode.trim().split('\n')
          .map((x, l) => `${(matches[1] - 1) === l ? ' >' : '  '} ${`00${l + 1}`.substr(-2)} ${x}`)
          .join('\n'));
      } else {
        console.log(protoCode);
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
