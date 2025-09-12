/**
 * Skip Environment for Integration Tests
 * 
 * This custom Jest environment is used to skip integration tests
 * when INTEGRATION_TESTS environment variable is not set to 'true'.
 */

const NodeEnvironment = require('jest-environment-node').default;

class SkipIntegrationEnvironment extends NodeEnvironment {
  constructor(config, context) {
    super(config, context);
  }

  async setup() {
    await super.setup();
    
    // Skip all tests in this environment
    this.global.describe = (name, fn) => {
      this.global.describe.skip(name, fn);
    };
    
    this.global.it = (name, fn) => {
      this.global.it.skip(name, fn);
    };
    
    this.global.test = (name, fn) => {
      this.global.test.skip(name, fn);
    };
  }

  async teardown() {
    await super.teardown();
  }
}

module.exports = SkipIntegrationEnvironment;