import { checkEnvParity, defaultEnvFiles, formatProblems, type CheckResult, type OptionHint } from "./check.js";
import { EnvParityError } from "./errors.js";
import { expandFiles, type FailOn, type ResolvedOptions } from "./options.js";

/**
 * What kind of run the tool is doing:
 * - `"build"`: a production build (`vite build`, `next build`, `webpack`)
 * - `"dev"`: a dev server or watcher starting (`vite`, `next dev`, `webpack serve`)
 * - `"rebuild"`: a watch-mode rebuild after the first one
 * - `"other"`: preview and production servers, test runs
 */
export type RunKind = "build" | "dev" | "rebuild" | "other";

/** What an adapter knows about the current run. */
export interface RunContext {
  /** Name shown in messages, e.g. `env-parity-plugin/webpack`. */
  name: string;
  root: string;
  mode: string;
  /** Decides, together with `failOn`, whether a mismatch fails the run. */
  run: RunKind;
  /** Env file convention for this tool, lowest priority first. */
  envFiles?: readonly string[];
  /** Where this tool keeps env files, when it has its own setting (like Vite's `envDir`). */
  envDir?: string | false;
  /** Framework-specific checks to turn on when scanning. */
  framework?: "next";
  hint: OptionHint;
  warn: (message: string) => void;
}

/** Outcome of {@link runCheck}: a message to throw, or nothing. */
export interface RunOutcome {
  result: CheckResult | undefined;
  /** Set when the run should fail; the caller throws it the way its tool expects. */
  error: EnvParityError | undefined;
}

/** Whether a mismatch fails this kind of run under `failOn`. */
export function shouldFail(failOn: FailOn, run: RunKind): boolean {
  switch (failOn) {
    case "always":
      return true;
    case "start":
      return run === "build" || run === "dev";
    case "build":
      return run === "build";
    case "never":
      return false;
  }
}

/** Run the check for an adapter: warn or produce an error depending on `failOn`. */
export function runCheck(opts: ResolvedOptions, ctx: RunContext, processEnv: Readonly<Record<string, string | undefined>> = process.env): RunOutcome {
  const fail = shouldFail(opts.failOn, ctx.run);
  const mode = opts.mode ?? ctx.mode;
  const input = {
    root: ctx.root,
    envDir: opts.envDir ?? ctx.envDir ?? ".",
    envFiles: expandFiles(opts.envFiles ?? ctx.envFiles ?? defaultEnvFiles(mode), mode),
    example: opts.example,
    allowEmpty: opts.allowEmpty,
    reportExtra: opts.reportExtra,
    ignore: opts.ignore,
    processEnv,
    scan: opts.scan,
    framework: ctx.framework,
  };

  let result: CheckResult;
  try {
    result = checkEnvParity(input);
  } catch (err) {
    if (err instanceof EnvParityError) {
      const tagged = new EnvParityError(err.code, `[${ctx.name}] ${err.message}`);
      if (fail) return { result: undefined, error: tagged };
      ctx.warn(tagged.message);
      return { result: undefined, error: undefined };
    }
    throw err;
  }

  for (const warning of result.warnings) ctx.warn(`[${ctx.name}] warning: ${warning}`);
  if (result.ok) return { result, error: undefined };
  let message = `[${ctx.name}] ${formatProblems(result, { root: ctx.root, mode, hint: ctx.hint })}`;
  if (fail && ctx.run === "dev" && opts.failOn === "start") {
    message += `\n  - To only warn while developing and fail just the build, use ${ctx.hint('failOn: "build"')}.`;
  }
  if (fail) return { result, error: new EnvParityError("ENV_MISMATCH", message) };
  ctx.warn(message);
  return { result, error: undefined };
}
