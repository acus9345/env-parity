# Changelog

All notable changes to this project are documented here. This project follows [Semantic Versioning](https://semver.org/).

## [0.1.1] - 2026-10-22

First published version. 0.1.0 was never published: npm held it as a staged version that could not be released, so the same code ships as 0.1.1.

### Added

- First release of the shared core behind [vite-plugin-env-parity](https://www.npmjs.com/package/vite-plugin-env-parity) and [env-parity-plugin](https://www.npmjs.com/package/env-parity-plugin), moved out of both so every bundler gets the same check.
- `checkEnv()` for scripts and CI steps; `checkEnvParity()`, `formatProblems()`, `parseEnv()`, `parseEnvDetailed()`, `compareEnv()`, `findEnvUses()` and `scanSource()` as building blocks.
- `resolveOptions()` and `runCheck()` for plugin authors: validate options once, then check on every run and get back an `EnvParityError` to throw or a warning to log.
- `failOn: "start"` (the default): fail production builds and dev-server starts, only warn on watch-mode rebuilds, preview servers and tests. `"build"`, `"always"` and `"never"` work as before. `shouldFail()` and the `RunKind` type describe the rule.
- Detection of UTF-16 and BOM-encoded env files, source scanning for undeclared variables, and the Next.js `"use client"` check.

[0.1.1]: https://github.com/acus9345/env-parity/releases/tag/v0.1.1
