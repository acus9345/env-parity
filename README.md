# @acus9345/env-parity

The shared core that fails your build, or your dev server's start, when a variable listed in `.env.example` is missing or empty. Zero dependencies.

[![npm](https://img.shields.io/npm/v/@acus9345/env-parity)](https://www.npmjs.com/package/@acus9345/env-parity)
[![CI](https://github.com/acus9345/env-parity/actions/workflows/ci.yml/badge.svg)](https://github.com/acus9345/env-parity/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@acus9345/env-parity)](LICENSE)

**Using a bundler? Install the plugin for it instead.** Both run on this package:

| Tool | Package | Setup |
| --- | --- | --- |
| Vite | [vite-plugin-env-parity](https://www.npmjs.com/package/vite-plugin-env-parity) | `plugins: [envParity()]` |
| Next.js | [env-parity-plugin/next](https://www.npmjs.com/package/env-parity-plugin) | `export default withEnvParity(nextConfig)` |
| Webpack 5, Rspack | [env-parity-plugin/webpack](https://www.npmjs.com/package/env-parity-plugin) | `plugins: [new EnvParityPlugin()]` |
| Rollup, Rolldown | [env-parity-plugin/rollup](https://www.npmjs.com/package/env-parity-plugin) | `plugins: [envParity()]` |
| Astro | [env-parity-plugin/astro](https://www.npmjs.com/package/env-parity-plugin) | `integrations: [envParity()]` |

Use this package directly for a CI step, a script, or a plugin for another tool.

- **Your `.env.example` is the schema.** Every variable it lists must be set in the env files or as an environment variable.
- **One rule for every tool:** production builds and dev-server starts fail; watch-mode rebuilds, preview servers and tests only warn.
- **Checks your code too:** with `scan: true`, a `process.env.X` or `import.meta.env.X` that the example doesn't list fails like a missing variable. With `framework: "next"`, so does a server-only secret read in a `"use client"` file.
- **Catches Windows encoding traps:** `.env` files saved as UTF-16 (what `>` does in Windows PowerShell) or with a BOM.

## Install

```sh
npm install --save-dev @acus9345/env-parity
```

Node.js 20 or later.

## Check from a script

```js
// scripts/check-env.mjs
import { checkEnv, formatProblems } from "@acus9345/env-parity";

const mode = "production";
const result = checkEnv({ mode });
if (!result.ok) {
  console.error(formatProblems(result, { root: process.cwd(), mode, hint: (o) => `checkEnv({ ${o} })` }));
  process.exit(1);
}
```

`checkEnv()` reads `.env`, `.env.local`, `.env.[mode]` and `.env.[mode].local` (later files win), then environment variables on top. It never throws for a mismatch; it throws `EnvParityError` only when the example file is missing or an option is invalid.

`result` has `ok` plus these arrays: `missing`, `empty`, `extra` (with `reportExtra`), `badEncoding`, `undeclared` and `clientOnly` (with `scan`), `unused` (with `scan: { unused: true }`) and `warnings`.

When `API_URL` isn't set, `formatProblems()` prints:

```text
1 variable from .env.example is not set (mode "production").
  Missing:        API_URL
How to fix:
  - Set the missing variables in .env, .env.local, .env.production, .env.production.local or as environment variables (e.g. in your CI settings).
  - To skip a variable on purpose, use checkEnv({ ignore: ["NAME"] }).
```

## Options

The plugins take the same options.

| Option | Default | What it does |
| --- | --- | --- |
| `example` | `.env.example` in `envDir` | File that lists the required variables. |
| `failOn` | `"start"` | `"start"`: fail production builds and dev-server starts, warn on rebuilds, preview servers and tests. `"build"`: fail production builds only. `"always"`: fail every run. `"never"`: only warn. (Plugins only; `checkEnv()` never fails.) |
| `allowEmpty` | `false` | Accept variables that are set but empty (`KEY=`). |
| `reportExtra` | `false` | Also report variables in your env files that the example doesn't list. |
| `ignore` | `[]` | Variables to skip. `*` is a wildcard: `["SENTRY_*"]`. |
| `envDir` | project root | Folder with the env files, or `false` to check environment variables only. |
| `envFiles` | the tool's convention | Env file names, lowest priority first. `{mode}` becomes the mode: `[".env", ".env.{mode}"]`. |
| `mode` | from the tool | Mode for `.env.{mode}` files. `checkEnv()` uses `NODE_ENV`, or `development`. |
| `scan` | `false` | Also scan source code: `true`, or `{ paths, exclude, unused }`. `node_modules` and build output are always skipped. |

`checkEnv()` also takes `root` (default: the current directory), `env` (default: `process.env`) and `framework: "next"`.

## Write a plugin for another tool

Validate the options once, when the plugin is created, then call `runCheck()` each time the tool runs. It logs warnings through your `warn` and returns an error when the run should fail, so you can throw it the way your tool expects:

```ts
import { resolveOptions, runCheck, type EnvParityOptions, type RunKind } from "@acus9345/env-parity";

export function envParity(options: EnvParityOptions = {}) {
  const opts = resolveOptions(options, { name: "my-tool-env-parity", call: "envParity" });
  let started = false;
  return {
    onStart({ root, watching }: { root: string; watching: boolean }) {
      const run: RunKind = !watching ? "build" : started ? "rebuild" : "dev";
      started ||= watching;
      const { error } = runCheck(opts, {
        name: "my-tool-env-parity",
        root,
        mode: watching ? "development" : "production",
        run,
        hint: (option) => `envParity({ ${option} })`,
        warn: (message) => console.warn(message),
      });
      if (error) throw error;
    },
  };
}
```

`run` is one of:

| `run` | When | Fails under |
| --- | --- | --- |
| `"build"` | a production build | `start`, `build`, `always` |
| `"dev"` | a dev server or watcher starting | `start`, `always` |
| `"rebuild"` | a watch-mode rebuild after the first | `always` |
| `"other"` | preview and production servers, test runs | `always` |

Pass `envFiles` and `envDir` in the context when your tool has its own convention (Next.js skips `.env.local` in tests, Vite has an `envDir` setting), and `framework: "next"` to turn on the client component check.

## Errors

Problems come back as `EnvParityError`, with a `code` of `ENV_MISMATCH`, `EXAMPLE_NOT_FOUND`, `FILE_UNREADABLE` or `INVALID_OPTIONS`. The message says what is wrong and how to fix it, with no stack trace.

## License

[MIT](LICENSE)
