/* eslint-disable no-unused-expressions */

const _ = require('./utils');
const jst = require('../lib');

const refs = require('./refs.schema.json');
const schema = require('./test.schema.json');

/* global describe, it */

describe('Test', () => {
  it('OK', async () => {
    const {
      pkgInfo, definitions,
    } = require('./fixtures');

    await jst.parse(__dirname, refs, schema, definitions);

    const models = _.getModels(definitions);
    const options = _.getOptions(models, definitions);

    const gqlCode = jst.generate(pkgInfo, options, jst.graphqlDefs);
    const protoCode = jst.generate(pkgInfo, options, jst.protobufDefs);

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
      const graphqlSchema = _.trim(`
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

      const gql = _.makeExecutableSchema({
        typeDefs: [graphqlSchema, gqlCode],
      });

      const response = await _.graphql(gql, query, root);

      console.log('>>>', response.data);
    } catch (e) {
      console.log('# GraphQL');
      console.log(gqlCode);

      throw e;
    }

    _.mockFs({
      'generated.proto': Buffer.from(protoCode),
      'external.proto': Buffer.from('message Empty {}'),
    });

    const serverInstance = new _.Server();

    try {
      const protoOptions = {};
      const packageDefinition = _.loadSync('generated.proto', protoOptions);
      const packageObject = _.loadPackageDefinition(packageDefinition);

      serverInstance.addService(packageObject.fooBar.FooBar.service, {
        anythingElse(ctx, reply) {
          reply(null, {});
        },
        async something(ctx, reply) {
          const validate = _.is(refs.find(x => x.id === 'Value'));

          await validate(ctx.request);

          console.log('CALL', ctx.request, validate.errors);

          reply(null, {
            id: 99,
            foo: 'BAR',
            values: ['OK'],
          });
        },
      });

      serverInstance.bind('0.0.0.0:50051', _.ServerCredentials.createInsecure());
      serverInstance.start();

      await new Promise(done => {
        const gateway = new packageObject.fooBar.FooBar('0.0.0.0:50051', _.credentials.createInsecure());

        const payload = {
          value: 'OK',
          example: 4.20,
        };

        const deadline = new Date();

        deadline.setSeconds(deadline.getSeconds() + 3);

        gateway.something(payload, { deadline }, async (error, response) => {
          const validate = _.is(schema, {
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
      _.mockFs.restore();

      await new Promise(done => {
        serverInstance.tryShutdown(done);
      });
    }
  });
});
