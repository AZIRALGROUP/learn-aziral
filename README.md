# AZIRAL Learn

Production: https://learn.aziral.com/, Cloudflare Pages project `learn-aziral`.

## Deployment

Every push to `main` runs the existing frontend and Telegram tests and builds
once. GitHub Actions uploads that tested `dist/` artifact to Cloudflare Pages,
including the repository's `functions/` API proxy. PRs run checks without
production credentials or publication. Superseded main commits cannot publish.

Repository Actions secrets: `CLOUDFLARE_API_TOKEN` (Pages Edit for the owning
Cloudflare account) and `CLOUDFLARE_ACCOUNT_ID`. The token is dedicated to this
repository; rotate it in Cloudflare and update the encrypted GitHub secret
before expiry. Never commit credentials. Old SSH secrets are no longer used.

The deploy job verifies the exact source commit at `/deployment.json`, the
delivered JavaScript bytes, SPA pages, robots/sitemap, private `noindex`, and
the `/api/courses` and anonymous `/api/auth/me` response contracts. A failed
check remains a failed deployment. Cloudflare's managed robots prefix is
preserved; our own robots directives must still match the build.
API/Telegram server releases on Netcup
are separate; this workflow publishes the Learn frontend and Pages Functions.

Local release checks: `node --test scripts/*.test.mjs`, `npm test`,
`npm run telegram:test`, `npm run build`.

## Frontend development

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
