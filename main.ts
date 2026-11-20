// Vice City Nights — make.fun gta6-cover-art-01 entry (Node 22, stdlib only).
//
// This program hands the entry in: it copies the app (app/) and the
// screenshots (screenshots/) from beside this file into the output directory
// and writes output/dossier.json with the vendored make.fun library, so the
// judge can read the app and its screenshots. The app itself is plain static
// files — app/index.html plus its ES modules, no library, no network — that
// turn a photo and a caption into GTA-style multi-panel cover art.
//
// Try it locally first: `node serve.ts`, then open http://localhost:8080.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Mirror the app and its screenshots into the output directory.
mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'app'), join(outputDir, 'app'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The dossier the judge reads, built with the same caps the scorer uses:
// the text cap shapes the bytes; the rest refuse an entry the scorer would
// refuse (more than 4 screenshots or one over 256 KiB; app/ over 993 entries
// or 48 MiB in all, or a path over 1000 bytes — app/ shares /output's own
// 1000-entry cap with screenshots/ and dossier.json).
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
