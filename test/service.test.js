'use strict';

const expect = require('chai').expect;

const Service = require('../lib/service');

/* global describe, it */

describe('Service', () => {
  describe('static methods', () => {
    describe('constructor', () => {
      it('should fail without arguments', () => {
        expect(() => new Service()).to.throw('Invalid service definition, given undefined');
      });

      it('should fail on invalid definitions', () => {
        expect(() => new Service({ service: true })).to.throw('Invalid service definition, given true');
        expect(() => new Service({ service: [] })).to.throw('Invalid service definition, given []');
      });

      it('should fail on invalid schema definitions', () => {
        expect(() => new Service({ service: {} })).to.throw('Invalid schema identifier, given {}');
        expect(() => new Service({ service: {}, schema: NaN })).to.throw('Invalid schema identifier, given { schema: NaN }');
        expect(() => new Service({ service: {}, schema: { id: -1 } })).to.throw('Invalid schema identifier, given { schema: { id: -1 } }');
      });
    });
  });

  describe('instance methods', () => {});
});
