// Réglages de Playwright, l'outil qui lance les tests dans un vrai navigateur (Chromium) sans fenêtre.
// Pour lancer les tests : « npm test » (voir tests/README.md).
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60 * 1000,              // un test qui dure plus d'une minute est considéré comme raté
  retries: 0,                      // pas de deuxième chance : le jeu est le même à chaque fois
  reporter: process.env.CI ? [['list'], ['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://localhost:8123',
    viewport: { width: 420, height: 800 },   // un écran de téléphone en portrait
    trace: 'off'
  },
  // Démarre le petit serveur web du jeu avant les tests
  webServer: {
    command: 'node tests/outils/serveur.js',
    url: 'http://localhost:8123/index.html',
    reuseExistingServer: !process.env.CI
  }
});
