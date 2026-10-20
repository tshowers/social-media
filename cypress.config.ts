import { defineConfig } from 'cypress';

export default defineConfig( {
  e2e: {
    baseUrl: 'http://localhost:4800',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    chromeWebSecurity: false,
    video: false,
    viewportWidth: 1280,
    viewportHeight: 900,
  },
} );
