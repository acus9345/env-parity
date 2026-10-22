import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { checkEnv, EnvParityError, resolveOptions, runCheck, shouldFail, type RunKind } from "../dist/index.js";

const dirs: string[] = [];
after(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

function project(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "env-parity-run-"));
  dirs.push(dir);
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  return dir;
}

const source = { name: "test-plugin", call: "envParity" };
const noEnv = {} as Record<string, string | undefined>;

function run(root: string, kind: RunKind, options = {}) {
  const warnings: string[] = [];
  const outcome = runCheck(
    resolveOptions(options, source),
    { name: "test-plugin", root, mode: "production", run: kind, hint: (o) => `envParity({ ${o} })`, warn: (m) => warnings.push(m) },
    noEnv,
  );
  return { ...outcome, warnings };
}

describe("shouldFail()", () => {
  it("maps failOn and the kind of run", () => {
    const kinds: RunKind[] = ["build", "dev", "rebuild", "other"];
    const table = (failOn: "start" | "build" | "always" | "never") => kinds.map((k) => shouldFail(failOn, k));
    assert.deepEqual(table("start"), [true, true, false, false]);
    assert.deepEqual(table("build"), [true, false, false, false]);
    assert.deepEqual(table("always"), [true, true, true, true]);
    assert.deepEqual(table("never"), [false, false, false, false]);
  });
});

describe("runCheck()", () => {
  it("fails builds and dev starts by default, and warns on rebuilds", () => {
    const root = project({ ".env.example": "API_URL=\n" });
    const build = run(root, "build");
    assert.ok(build.error instanceof EnvParityError);
    assert.equal(build.error.code, "ENV_MISMATCH");
    assert.match(build.error.message, /^\[test-plugin\] 1 variable from \.env\.example is not set \(mode "production"\)/);
    assert.doesNotMatch(build.error.message, /failOn/);

    const dev = run(root, "dev");
    assert.match(dev.error?.message ?? "", /To only warn while developing and fail just the build, use envParity\(\{ failOn: "build" \}\)/);

    const rebuild = run(root, "rebuild");
    assert.equal(rebuild.error, undefined);
    assert.match(rebuild.warnings.join("\n"), /Missing: +API_URL/);
  });

  it("keeps the old behaviour with failOn: build", () => {
    const root = project({ ".env.example": "API_URL=\n" });
    assert.ok(run(root, "build", { failOn: "build" }).error);
    assert.equal(run(root, "dev", { failOn: "build" }).error, undefined);
    assert.ok(run(root, "rebuild", { failOn: "always" }).error);
  });

  it("passes quietly when everything is set", () => {
    const root = project({ ".env.example": "API_URL=\n", ".env": "API_URL=https://x\n" });
    const r = run(root, "dev");
    assert.equal(r.error, undefined);
    assert.equal(r.result?.ok, true);
    assert.deepEqual(r.warnings, []);
  });

  it("tags a missing example file with the plugin name", () => {
    const root = project({});
    assert.equal(run(root, "dev").error?.code, "EXAMPLE_NOT_FOUND");
    assert.match(run(root, "rebuild").warnings[0]!, /^\[test-plugin\] Could not find \.env\.example/);
  });
});

describe("resolveOptions()", () => {
  it("defaults failOn to start and explains bad values", () => {
    assert.equal(resolveOptions(undefined, source).failOn, "start");
    assert.throws(() => resolveOptions({ failOn: "dev" }, source), /"failOn" must be "start", "build", "always" or "never", but got "dev"/);
    assert.throws(() => resolveOptions(null, source), /envParity\(\) expects an options object/);
  });

  it("links the docs of the plugin that validated the options", () => {
    assert.throws(() => resolveOptions({ bogus: 1 }, source), /See https:\/\/github\.com\/acus9345\/env-parity#options$/);
    assert.throws(() => resolveOptions({ bogus: 1 }, { ...source, docs: "https://example.com/opts" }), /See https:\/\/example\.com\/opts$/);
  });
});

describe("checkEnv()", () => {
  it("finds missing, empty and undocumented variables", () => {
    const root = project({ ".env.example": "API_URL=\nTOKEN=\nDEBUG=\n", ".env": "API_URL=https://x\nTOKEN=\nEXTRA=1\n" });
    const r = checkEnv({ root, env: noEnv, mode: "production", reportExtra: true });
    assert.deepEqual([r.ok, r.missing, r.empty, r.extra], [false, ["DEBUG"], ["TOKEN"], ["EXTRA"]]);
    assert.equal(checkEnv({ root, env: { DEBUG: "1", TOKEN: "t" }, mode: "production" }).ok, true);
    assert.equal(checkEnv({ root, env: noEnv, ignore: ["DEB*", "TOKEN"] }).ok, true);
  });

  it("reads mode files and custom envFiles", () => {
    const root = project({ ".env.example": "A=\n", ".env": "A=\n", ".env.production.local": "A=set\n" });
    assert.equal(checkEnv({ root, env: noEnv, mode: "production" }).ok, true);
    assert.deepEqual(checkEnv({ root, env: noEnv, mode: "development" }).empty, ["A"]);
    assert.equal(checkEnv({ root, env: noEnv, envFiles: [".env", ".env.{mode}.local"], mode: "production" }).ok, true);
  });
});
