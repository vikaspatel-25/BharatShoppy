// Guards against shipping a React file that calls a hook it never imported.
// A missing import only fails in the browser, where it crashes the whole page.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOOKS = ["useState", "useEffect", "useRef", "useMemo", "useCallback", "useContext", "useLayoutEffect", "useReducer", "useId"];
const DIRS = ["src/pages", "src/components", "src/layouts", "src/context", "src/routes"];

function sourceFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return sourceFiles(p);
    return /\.(jsx|js)$/.test(d.name) ? [p] : [];
  });
}

export function findMissingHookImports(src) {
  const reactImport = (src.match(/import[^;]*from\s+['"]react['"]/g) || []).join(" ");
  return HOOKS.filter((hook) => {
    const used = new RegExp(`(^|[^.\\w])${hook}\\(`).test(src);
    const imported = new RegExp(`\\b${hook}\\b`).test(reactImport);
    const definedLocally = new RegExp(`(function|const|let)\\s+${hook}\\b`).test(src);
    return used && !imported && !definedLocally;
  });
}

describe("P1: React hook imports", () => {
  it("detects a hook used without an import", () => {
    const bad = `import { useState } from "react";\nexport default function A(){ useEffect(() => {}, []); return useState(0); }`;
    assert.deepEqual(findMissingHookImports(bad), ["useEffect"]);
  });

  it("accepts a file that imports what it uses", () => {
    const good = `import { useEffect, useState } from "react";\nexport default function A(){ useEffect(() => {}, []); return useState(0); }`;
    assert.deepEqual(findMissingHookImports(good), []);
  });

  it("every hook used in pages, components, layouts, context and routes is imported", () => {
    const problems = [];
    for (const dir of DIRS) {
      for (const file of sourceFiles(path.join(clientRoot, dir))) {
        for (const hook of findMissingHookImports(fs.readFileSync(file, "utf8"))) {
          problems.push(`${path.relative(clientRoot, file)}: ${hook}`);
        }
      }
    }
    assert.deepEqual(problems, [], `Hooks used without import:\n${problems.join("\n")}`);
  });
});
