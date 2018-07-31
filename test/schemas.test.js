'use strict';

const fs = require('fs');
const expect = require('chai').expect;

const _ = require('./utils');
const Service = require('../lib/service');

/* global describe, it */

describe('Schema validation', () => {
  const schemasDir = `${__dirname}/schemas`;

  function readFile(filePath) {
    return fs.readFileSync(filePath).toString();
  }

  function readJSON(filePath) {
    return JSON.parse(readFile(filePath));
  }

  fs.readdirSync(schemasDir)
    .filter(x => x.indexOf('.') === -1)
    .forEach(name => {
      const schemaId = `${schemasDir}/${name}/schema`;

      it(name.replace(/[^a-z\d]+/g, ' ').trim(), () => {
        const data = readJSON(`${schemaId}.json`);
        const service = new Service(data);

        return Promise.resolve()
          .then(() => service.sync())
          .then(() => {
            const gqlFile = `${schemaId}.gql`;
            const protoFile = `${schemaId}.proto`;

            if (data.debug) {
              console.log(service.graphql);
              console.log(service.protobuf);
            }

            expect(service.graphql.trim()).to.eql(readFile(gqlFile).trim());
            expect(service.protobuf.trim()).to.eql(readFile(protoFile).trim());

            try {
              _.makeExecutableSchema({
                typeDefs: [_.trim(`
                  type Query { dummy: [String] }
                  type Mutation { dummy: [String] }
                  schema { query: Query, mutation: Mutation }
                `), service.graphql],
              });
            } catch (e) {
              throw new Error(`(GraphQL) ${e.message}\n\n${service.graphql}`);
            }

            _.mockFs({
              'generated.proto': Buffer.from(`${service.protobuf}\nmessage Noop {}`),
            });

            try {
              _.loadPackageDefinition(_.loadSync('generated.proto', {}));
            } catch (e) {
              throw new Error(`(Protobuf) ${e.message}\n\n${service.protobuf}`);
            } finally {
              _.mockFs.restore();
            }
          });
      });
    });
});
