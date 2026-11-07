#!/usr/bin/env node
// reIS Task List CLI. Reads the two connector results Claude saved to files,
// and prints either the open tasks or an `update_doc` payload. It never talks
// to Google itself except to download task images (needs docs.google.com on
// the environment's network allowlist). See .claude/skills/task-list/SKILL.md.
//
//   node scripts/task-list/cli.mjs list --doc D --md M [--all] [--section S] [--images DIR [--task N]]
//   node scripts/task-list/cli.mjs done --doc D --md M --task N [--note "PR #123"]
//   node scripts/task-list/cli.mjs note --doc D --md M --task N --text "why it is blocked"
import { readFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { findTasks, unwrapDoc, doneRequests, noteRequests } from './lib.mjs';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    doc: { type: 'string' },
    md: { type: 'string' },
    section: { type: 'string', default: 'Bucket list' },
    all: { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
    images: { type: 'string' },
    task: { type: 'string' },
    note: { type: 'string' },
    text: { type: 'string' },
  },
});
const [command] = positionals;
if (!command || !values.doc || !values.md) {
  console.error(
    'usage: cli.mjs <list|done|note> --doc <read_doc file> --md <read_file_content file> …'
  );
  process.exit(2);
}

const docJson = JSON.parse(readFileSync(values.doc, 'utf8'));
const mdRaw = readFileSync(values.md, 'utf8');
const mdJson = mdRaw.trimStart().startsWith('{') ? JSON.parse(mdRaw) : mdRaw;
const tasks = findTasks(docJson, mdJson, { section: values.section });
if (tasks.length === 0) {
  console.error(`No tasks found under a heading named "${values.section}".`);
  process.exit(1);
}

function pick() {
  const task = tasks.find((t) => t.n === Number(values.task));
  if (!task) {
    console.error(`No task #${values.task}. Run \`list --all\` to see the numbering.`);
    process.exit(1);
  }
  console.error(`task #${task.n}: ${task.title}`);
  return task;
}

// Cloud machines ship a global Playwright matched to /opt/pw-browsers; the
// repo pins its own version, which finds no browser there. Prefer the global.
async function launchBrowser() {
  try {
    return await createRequire('/noop.js')('playwright').chromium.launch();
  } catch {
    const { chromium } = createRequire(join(process.cwd(), 'noop.js'))('playwright');
    return chromium.launch({
      executablePath: process.env.TASK_LIST_CHROMIUM ?? '/opt/pw-browsers/chromium',
    });
  }
}

/** Downloads a task's images, plus a ≤1000px-wide JPEG of each that the Read tool can open. */
async function downloadImages(selected, dir) {
  mkdirSync(dir, { recursive: true });
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 400, height: 800 } });
  for (const t of selected) {
    for (const [i, img] of t.images.entries()) {
      const original = resolve(dir, `task${t.n}-${i + 1}.png`);
      const preview = resolve(dir, `task${t.n}-${i + 1}.preview.jpg`);
      try {
        execFileSync('curl', ['-sSfL', '-o', original, img.uri], {
          stdio: ['ignore', 'ignore', 'pipe'],
        });
        await page.goto(`file://${original}`);
        const natural = await page.evaluate(() => document.images[0].naturalWidth);
        const width = Math.min(natural, 1000);
        await page.setViewportSize({ width, height: 800 });
        await page.evaluate((w) => {
          document.body.style.margin = '0';
          document.images[0].style.width = `${w}px`;
        }, width);
        await page.screenshot({ path: preview, type: 'jpeg', quality: 70, fullPage: true });
        img.file = preview;
      } catch (err) {
        img.error = String(err.stderr ?? err.message)
          .trim()
          .split('\n')[0];
      }
    }
  }
  await browser.close();
}

if (command === 'list') {
  let selected = values.all ? tasks : tasks.filter((t) => t.done !== true);
  if (values.task) selected = selected.filter((t) => t.n === Number(values.task));
  if (values.images)
    await downloadImages(
      selected.filter((t) => t.images.length),
      values.images
    );
  if (values.json) {
    console.log(
      JSON.stringify({ revisionId: unwrapDoc(docJson).revisionId, tasks: selected }, null, 2)
    );
  } else {
    for (const t of selected) {
      const mark = t.done === null ? '?' : t.done ? '✓' : '·';
      console.log(`#${t.n} ${mark} ${t.title}`);
      for (const d of t.details) console.log(`     ${d}`);
      for (const n of t.notes) console.log(`     ${n}`);
      for (const img of t.images)
        console.log(`     image: ${img.file ?? img.error ?? '(not downloaded)'}`);
    }
  }
} else if (command === 'done') {
  console.log(
    JSON.stringify(doneRequests(pick(), unwrapDoc(docJson).revisionId, values.note), null, 2)
  );
} else if (command === 'note') {
  if (!values.text) {
    console.error('note needs --text');
    process.exit(2);
  }
  const date = new Date().toISOString().slice(0, 10);
  console.log(
    JSON.stringify(noteRequests(pick(), unwrapDoc(docJson).revisionId, values.text, date), null, 2)
  );
} else {
  console.error(`unknown command: ${command}`);
  process.exit(2);
}
