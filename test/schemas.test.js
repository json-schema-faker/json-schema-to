'use strict';

const fs = require('fs');
const expect = require('chai').expect;

const Service = require('../lib/service');

/* global describe, it */

describe.only('Service', () => {
  describe('static methods', () => {
    describe('constructor', () => {
      it('should fail without arguments', () => {
        expect(() => new Service()).to.throw('Invalid service definition, given undefined');
      });

      it('should fail on invalid definitions', () => {
        expect(() => new Service({ serviceDefinition: true })).to.throw('Invalid service definition, given true');
        expect(() => new Service({ serviceDefinition: [] })).to.throw('Invalid service definition, given []');
      });

      it('should fail on invalid schema definitions', () => {
        expect(() => new Service({ serviceDefinition: {} })).to.throw('Invalid schema identifier, given {}');
        expect(() => new Service({ serviceDefinition: {}, schema: NaN })).to.throw('Invalid schema identifier, given { schema: NaN }');
        expect(() => new Service({ serviceDefinition: {}, schema: { id: -1 } })).to.throw('Invalid schema identifier, given { schema: { id: -1 } }');
      });
    });
  });

  describe('instance methods', () => {});

  describe('schema validation', () => {
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

          const gqlFile = `${schemaId}.gql`;
          const protoFile = `${schemaId}.proto`;

          if (data.debug) {
            console.log(service.graphql);
            console.log(service.protobuf);
          }

          expect(service.graphql.trim()).to.eql(readFile(gqlFile).trim());
          expect(service.protobuf.trim()).to.eql(readFile(protoFile).trim());
        });
      });
  });
});
