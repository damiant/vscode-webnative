# WebNative MCP Server

Bringing the WebNative feature set to AI.

## Development

To get started, clone the repository and install the dependencies.

```bash
npm install
npm run dev
```

### Start the server

If you simply want to start the server, you can use the `start` script.

```bash
npm run start
```

However, you can also interact with the server using the `dev` script.

```bash
npm run dev
```

This will start the server and allow you to interact with it using CLI.

### Testing

```bash
npm run test
```

### Linting

```bash
npm run lint
```

This uses [Prettier](https://prettier.io/), [ESLint](https://eslint.org/) and [TypeScript ESLint](https://typescript-eslint.io/) to lint the code.

### Formatting

Use `npm run format` to format the code.

```bash
npm run format
```

### GitHub Actions

This repository has a GitHub Actions workflow that runs linting, formatting, tests, and publishes package updates to NPM using [semantic-release](https://semantic-release.gitbook.io/semantic-release/).

In order to use this workflow, you need to:

1. Add `NPM_TOKEN` to the repository secrets
   1. [Create a new automation token](https://www.npmjs.com/settings/punkpeye/tokens/new)
   2. Add token as `NPM_TOKEN` environment secret (Settings → Secrets and Variables → Actions → "Manage environment secrets" → "release" → Add environment secret)
1. Grant write access to the workflow (Settings → Actions → General → Workflow permissions → "Read and write permissions")
