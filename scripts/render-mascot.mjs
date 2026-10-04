#!/usr/bin/env node
/**
 * Render every Nami pose to PNG for visual review (docs/DESIGN.md §4 release checks).
 *
 *   node scripts/render-mascot.mjs            # all renders → design/renders/
 *   node scripts/render-mascot.mjs idle swim  # only these poses (+ sheets)
 *
 * How it works: esbuild bundles a tiny static harness that imports the real
 * components/nami/NamiSvg.tsx, writes it next to an index.html in a temp dir,
 * and Playwright (Chromium) screenshots it from file://. No Next.js server is
 * needed, so it never collides with a running `next dev`.
 *
 * Playwright is NOT a project dependency. The script looks for it in
 * $PLAYWRIGHT_MODULE, then the global npm root. Browsers come from
 * $PLAYWRIGHT_BROWSERS_PATH (defaults to /opt/pw-browsers if present).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "design", "renders");

/* ---------------- locate playwright ---------------- */
function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_MODULE, root].filter(Boolean);
  try {
    const g = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
    candidates.push(path.join(g, "playwright"));
  } catch {}
  candidates.push("/opt/node22/lib/node_modules/playwright");
  for (const c of candidates) {
    try {
      const req = createRequire(path.join(c, "noop.js"));
      return req(existsSync(path.join(c, "package.json")) ? c : "playwright");
    } catch {}
  }
  throw new Error(
    "Playwright not found. Set PLAYWRIGHT_MODULE to a playwright package dir (do not add it to package.json).",
  );
}
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync("/opt/pw-browsers")) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = "/opt/pw-browsers";
}

/* ---------------- bundle the harness ---------------- */
const work = mkdtempSync(path.join(tmpdir(), "nami-render-"));
const entry = path.join(work, "entry.tsx");
const nami = path.join(root, "components/nami/NamiSvg.tsx").replaceAll("\\", "/");
const poses = path.join(root, "lib/nami/poses.ts").replaceAll("\\", "/");
writeFileSync(
  entry,
  `
import { createRoot } from "react-dom/client";
import { NamiSvg } from ${JSON.stringify(nami)};
import { POSE_NAMES } from ${JSON.stringify(poses)};

const BG = { ivory: "#F7F3EA", teal: "#173D38" };
function App() {
  const q = new URLSearchParams(location.hash.slice(1));
  const mode = q.get("mode") ?? "solo";
  const bg = BG[q.get("bg") ?? "ivory"] ?? q.get("bg");
  const size = Number(q.get("size") ?? 480);
  const mouth = Number(q.get("mouth") ?? 0);
  const look = q.get("look");
  const lookAt = look ? { x: Number(look.split(",")[0]), y: Number(look.split(",")[1]) } : null;
  document.body.style.background = bg;
  if (mode === "sheet") {
    const list = (q.get("poses") ?? POSE_NAMES.join(",")).split(",");
    return (
      <div id="shot" style={{ display: "grid", gridTemplateColumns: "repeat(" + (q.get("cols") ?? 7) + ", " + size + "px)", gap: 8, padding: 12, background: bg, width: "max-content" }}>
        {list.map((p) => (
          <figure key={p} style={{ margin: 0, textAlign: "center", font: "12px system-ui", color: bg === BG.teal ? "#F7F3EA" : "#173D38" }}>
            <NamiSvg pose={p} reducedMotion mouth={mouth} lookAt={lookAt} style={{ width: size, height: size }} />
            {size >= 100 ? <figcaption>{p}</figcaption> : null}
          </figure>
        ))}
      </div>
    );
  }
  if (mode === "mouths") {
    const levels = [0, 0.2, 0.5, 0.9];
    return (
      <div id="shot" style={{ display: "flex", gap: 8, padding: 12, background: bg, width: "max-content" }}>
        {levels.map((m) => (
          <figure key={m} style={{ margin: 0, textAlign: "center", font: "12px system-ui", color: "#173D38" }}>
            <NamiSvg pose="speaking" reducedMotion mouth={m} style={{ width: size, height: size }} />
            <figcaption>mouth {m}</figcaption>
          </figure>
        ))}
      </div>
    );
  }
  return (
    <div id="shot" style={{ width: size, height: size, background: bg }}>
      <NamiSvg pose={q.get("pose") ?? "idle"} reducedMotion mouth={mouth} lookAt={lookAt} style={{ width: size, height: size }} />
    </div>
  );
}
const r = createRoot(document.getElementById("root"));
r.render(<App />);
window.addEventListener("hashchange", () => r.render(<App key={location.hash} />));
`,
);
const esbuild = path.join(root, "node_modules", ".bin", "esbuild");
execFileSync(
  esbuild,
  [
    entry,
    "--bundle",
    "--format=iife",
    "--jsx=automatic",
    "--loader:.tsx=tsx",
    `--tsconfig=${path.join(root, "tsconfig.json")}`,
    "--define:process.env.NODE_ENV=\"production\"",
    "--log-level=warning",
    `--outfile=${path.join(work, "bundle.js")}`,
  ],
  { stdio: "inherit", cwd: root, env: { ...process.env, NODE_PATH: path.join(root, "node_modules") } },
);
writeFileSync(
  path.join(work, "index.html"),
  `<!doctype html><meta charset="utf-8"><style>html,body{margin:0}</style><div id="root"></div><script src="bundle.js"></script>`,
);

/* ---------------- screenshot ---------------- */
const { chromium } = loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1800, height: 1200 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const base = pathToFileURL(path.join(work, "index.html")).href;

async function shot(hash, file) {
  await page.goto(`${base}#${hash}`);
  await page.waitForSelector("#shot svg");
  await page.waitForTimeout(60);
  const el = await page.$("#shot");
  mkdirSync(path.dirname(file), { recursive: true });
  await el.screenshot({ path: file });
  console.log("  ✓", path.relative(root, file));
}

const { POSE_NAMES } = await import(pathToFileURL(path.join(work, "poses.mjs")).href).catch(async () => {
  // Bundle the pose list for Node so this script and the app agree.
  execFileSync(esbuild, [poses, "--bundle", "--format=esm", "--platform=node", "--log-level=warning", `--outfile=${path.join(work, "poses.mjs")}`]);
  return import(pathToFileURL(path.join(work, "poses.mjs")).href);
});
const only = process.argv.slice(2);
const list = only.length ? POSE_NAMES.filter((p) => only.includes(p)) : POSE_NAMES;

console.log("Rendering Nami poses →", path.relative(root, outDir));
for (const p of list) {
  await shot(`mode=solo&pose=${p}&bg=ivory&size=480`, path.join(outDir, `${p}.png`));
  await shot(`mode=solo&pose=${p}&bg=teal&size=480`, path.join(outDir, "teal", `${p}.png`));
}
await shot(`mode=sheet&bg=ivory&size=220&cols=7`, path.join(outDir, "sheet-ivory.png"));
await shot(`mode=sheet&bg=teal&size=220&cols=7`, path.join(outDir, "sheet-teal.png"));
await shot(`mode=sheet&bg=ivory&size=120&cols=14`, path.join(outDir, "sheet-120px.png"));
await shot(`mode=mouths&bg=ivory&size=260`, path.join(outDir, "mouths.png"));

await browser.close();
rmSync(work, { recursive: true, force: true });
if (errors.length) {
  console.error("Page errors:\n" + errors.join("\n"));
  process.exit(1);
}
