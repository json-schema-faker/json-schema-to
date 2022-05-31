'use strict';

/* eslint-disable no-unused-expressions */

const expect = require('chai').expect;

const _ = require('./utils');
const Service = require('../lib/service');

/* global describe, it */

describe('GraphQL & Protobuf', () => {
  it('should integrate seamlessly', () => {
    const service = Service.from({
      id: 'Test',
      service: {
        pkg: 'foo-bar',
        refs: ['external'],
        calls: [
          {
            set: 'something', resp: 'Test', input: 'Value', required: true,
          },
          { get: 'anythingElse', resp: 'Test' },
        ],
      },
    }, `${__dirname}/fixtures`);

    const gqlCode = service.graphql;
    const protoCode = service.protobuf;

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

    let serverInstance;
    return new Promise((resolve, reject) => {
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

        return _.graphql(gql, query, root)
          .then(response => {
            resolve();
            if (response.errors) {
              console.log(response.errors[0].message);
              console.log('# GraphQL');
              console.log(gqlCode);
              return;
            }

            expect(response.data).to.eql({
              anythingElse: {
                id: 1,
                value: 'FOO',
                values: ['baz', 'buzz'],
              },
            });
          });
      } catch (e) {
        console.log('# GraphQL');
        console.log(gqlCode);

        reject(e);
      }
    }).then(() => {
      _.mockFs({
        'generated.proto': Buffer.from(protoCode),
        'external.proto': Buffer.from('message Noop {}'),
      });

      serverInstance = new _.Server();

      try {
        const protoOptions = {
          keepCase: true,
          longs: String,
          enums: String,
          oneofs: true,
        };
        const packageDefinition = _.loadSync('generated.proto', protoOptions);
        const packageObject = _.loadPackageDefinition(packageDefinition);

        serverInstance.addService(packageObject.foo_bar.TestService.service, {
          anythingElse(ctx, reply) {
            reply(null, {});
          },
          something(ctx, reply) {
            const validate = _.is(service.$refs.Value);

            return Promise.resolve()
              .then(() => validate(ctx.request))
              .then(() => {
                expect(ctx.request).to.eql({ example: 4.2 });
                expect(validate.errors).to.be.null;

                reply(null, {
                  id: 99,
                  value: 'BAR',
                  values: ['OK'],
                });
              });
          },
        });

        return new Promise(done => {
          serverInstance.bindAsync('0.0.0.0:50051', _.ServerCredentials.createInsecure(), () => {
            serverInstance.start();

            const { TestService } = packageObject.foo_bar;
            const gateway = new TestService('0.0.0.0:50051', _.credentials.createInsecure());

            const payload = {
              value: 'OK',
              example: 4.20,
            };

            const deadline = new Date();

            deadline.setSeconds(deadline.getSeconds() + 3);

            gateway.something(payload, { deadline }, (error, response) => {
              if (error) {
                console.log('# Protobuf');
                console.log(protoCode);
                console.error(error);
                return done();
              }

              const validate = _.is(service.$refs.Test, {
                schemas: service.$refs,
              });

              return Promise.resolve()
                .then(() => validate(response))
                .then(() => {
                  done();
                  expect(error).to.be.null;
                  expect(validate.errors).to.be.null;
                  expect(response).to.eql({ id: 99, value: 'BAR', values: ['OK'] });
                });
            });
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
      }
    }).then(() => {
      return new Promise(done => {
        serverInstance
          ? serverInstance.tryShutdown(done)
          : done();
      });
    });
  });
});
