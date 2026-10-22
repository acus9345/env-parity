/**
 * The shared core behind vite-plugin-env-parity and env-parity-plugin: reads
 * `.env.example`, the env files and environment variables, and reports what is
 * missing, empty or undeclared. Bundler plugins call {@link resolveOptions}
 * once and {@link runCheck} on every run; scripts call {@link checkEnv}.
 *
 * @example
 * import { checkEnv } from "@acus9345/env-parity";
 *
 * const result = checkEnv({ mode: "production" });
 * if (!result.ok) console.error(result.missing);
 */
import { checkEnvParity, defaultEnvFiles, formatProblems, type CheckResult } from "./check.js";
import { expandFiles, resolveOptions, type EnvParityOptions } from "./options.js";

export { checkEnvParity, defaultEnvFiles, formatProblems };
export type { CheckInput, CheckResult, CodeUse, OptionHint } from "./check.js";
export { compareEnv, makeIgnoreMatcher } from "./compare.js";
export type { CompareOptions, Comparison } from "./compare.js";
export { EnvParityError } from "./errors.js";
export type { EnvParityErrorCode } from "./errors.js";
export { expandFiles, resolveOptions };
export type { EnvParityOptions, FailOn, OptionsSource, ResolvedOptions, ResolvedScan, ScanOptions } from "./options.js";
export { parseEnv, parseEnvDetailed } from "./parse.js";
export type { EnvMap, ParseIssue, ParseResult } from "./parse.js";
export { runCheck, shouldFail } from "./run.js";
export type { RunContext, RunKind, RunOutcome } from "./run.js";
export { BUILT_IN_VARIABLES, DEFAULT_SCAN_EXCLUDE, findEnvUses, scanSource, stripComments } from "./scan.js";
export type { EnvUse, ScanInput, ScanResult } from "./scan.js";

/** Options for {@link checkEnv}: the shared options plus the root and environment to check. */
export interface CheckEnvOptions extends Omit<EnvParityOptions, "failOn"> {
  /** @default process.cwd() */
  root?: string;
  /** @default process.env */
  env?: Readonly<Record<string, string | undefined>>;
  /** With `scan`, also check framework rules: `"next"` reports server-only variables read in `"use client"` files. */
  framework?: "next";
}

/**
 * Check the env against `.env.example` and return the result. Never throws
 * for a mismatch; throws {@link EnvParityError} only when the example file is
 * missing or an option is invalid.
 */
export function checkEnv(options: CheckEnvOptions = {}): CheckResult {
  const { root, env, framework, ...rest } = options;
  const opts = resolveOptions(rest, { name: "@acus9345/env-parity", call: "checkEnv" });
  const mode = opts.mode ?? process.env.NODE_ENV ?? "development";
  return checkEnvParity({
    root: root ?? process.cwd(),
    envDir: opts.envDir ?? ".",
    envFiles: expandFiles(opts.envFiles ?? defaultEnvFiles(mode), mode),
    example: opts.example,
    allowEmpty: opts.allowEmpty,
    reportExtra: opts.reportExtra,
    ignore: opts.ignore,
    processEnv: env ?? process.env,
    scan: opts.scan,
    framework,
  });
}
