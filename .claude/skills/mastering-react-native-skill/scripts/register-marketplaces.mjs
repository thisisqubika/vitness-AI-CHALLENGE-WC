#!/usr/bin/env node
/**
 * register-marketplaces.mjs
 *
 * Idempotently merges Claude Code plugin-marketplace registration into the
 * target project's `.claude/settings.json` for React Native ecosystems
 * (Software Mansion + Callstack). Safe to re-run.
 *
 * Usage:
 *   node scripts/register-marketplaces.mjs            # operates on cwd
 *   node scripts/register-marketplaces.mjs --cwd PATH
 *   node scripts/register-marketplaces.mjs --dry-run  # print what would change, don't write
 *   node scripts/register-marketplaces.mjs --force    # bypass Codex/Claude provider detection
 *
 * Exit codes:
 *   0  success (changed, already up to date, or skipped on non-Claude provider)
 *   1  unrecoverable error (malformed existing settings, etc.)
 *
 * Note: Claude Code plugin marketplaces (`extraKnownMarketplaces` /
 * `enabledPlugins`) are a Claude-only feature. On Codex projects this script
 * exits early without writing (use `--force` to override).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const MARKETPLACES = {
  swmansion: {
    source: { source: 'github', repo: 'software-mansion-labs/skills' },
    plugins: ['skills'],
  },
  'callstack-agent-skills': {
    source: { source: 'github', repo: 'callstackincubator/agent-skills' },
    plugins: [
      'react-native-best-practices',
      'upgrading-react-native',
      'react-native-brownfield-migration',
      'github-actions',
    ],
  },
};

function parseInputs() {
  const { values } = parseArgs({
    options: {
      cwd: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });
  return {
    cwd: resolve(values.cwd ?? process.cwd()),
    dryRun: values['dry-run'] === true,
    force: values.force === true,
  };
}

/**
 * Best-effort detection of which CLI provider the project is using.
 * Marketplaces are a Claude Code feature; Codex ignores `.claude/settings.json`.
 *
 * Returns 'codex' | 'claude' | 'unknown'.
 *   - explicit PROVIDER env wins (claude / codex / openai)
 *   - else: presence of .codex/ at cwd without .claude/ implies Codex
 *   - else: OPENAI_API_KEY set without ANTHROPIC_API_KEY implies Codex
 *   - else: 'unknown' (default to proceeding — Claude is the historical default)
 */
function detectProvider(cwd) {
  const explicit = (process.env.PROVIDER ?? '').toLowerCase();
  if (explicit === 'claude' || explicit === 'anthropic') return 'claude';
  if (explicit === 'codex' || explicit === 'openai') return 'codex';

  const hasClaudeDir = existsSync(join(cwd, '.claude'));
  const hasCodexDir = existsSync(join(cwd, '.codex'));
  if (hasCodexDir && !hasClaudeDir) return 'codex';
  if (hasClaudeDir && !hasCodexDir) return 'claude';

  if (process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) return 'codex';
  if (process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) return 'claude';

  return 'unknown';
}

class SettingsReadError extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
}

function readSettings(settingsPath) {
  if (!existsSync(settingsPath)) return {};
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(settingsPath, 'utf-8'));
  } catch {
    throw new SettingsReadError('not valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new SettingsReadError('JSON root is not an object');
  }
  return parsed;
}

function mergeRegistration(settings) {
  const next = { ...settings };
  next.extraKnownMarketplaces = { ...(settings.extraKnownMarketplaces ?? {}) };
  next.enabledPlugins = { ...(settings.enabledPlugins ?? {}) };

  const added = { marketplaces: [], plugins: [] };

  for (const [id, def] of Object.entries(MARKETPLACES)) {
    const current = next.extraKnownMarketplaces[id];
    if (!current || current.source?.repo !== def.source.repo) {
      next.extraKnownMarketplaces[id] = { source: def.source };
      added.marketplaces.push(id);
    }
    for (const plugin of def.plugins) {
      const key = `${plugin}@${id}`;
      if (next.enabledPlugins[key] !== true) {
        next.enabledPlugins[key] = true;
        added.plugins.push(key);
      }
    }
  }

  return { next, added, changed: added.marketplaces.length + added.plugins.length > 0 };
}

function main() {
  const { cwd, dryRun, force } = parseInputs();

  const provider = detectProvider(cwd);
  if (provider === 'codex' && !force) {
    console.log(
      'Detected Codex provider in this project. Claude Code plugin marketplaces are a Claude-only feature, so this script has no effect on Codex.',
    );
    console.log(
      'Skipping registration. If you also use Claude Code in this project, rerun with --force to write `.claude/settings.json` anyway.',
    );
    return;
  }

  const settingsPath = join(cwd, '.claude', 'settings.json');

  let existing;
  try {
    existing = readSettings(settingsPath);
  } catch (err) {
    if (err instanceof SettingsReadError) {
      console.error(
        `Refusing to write: ${settingsPath} exists but ${err.reason}. Fix the file and rerun.`,
      );
      process.exit(1);
    }
    throw err;
  }

  const { next, added, changed } = mergeRegistration(existing);

  if (!changed) {
    console.log(`No changes — React Native marketplaces already registered in ${settingsPath}.`);
    return;
  }

  if (dryRun) {
    console.log('Dry run. Would add:');
    if (added.marketplaces.length) {
      console.log(`  marketplaces: ${added.marketplaces.join(', ')}`);
    }
    if (added.plugins.length) {
      console.log(`  enabledPlugins: ${added.plugins.join(', ')}`);
    }
    return;
  }

  mkdirSync(dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, `${JSON.stringify(next, null, 2)}\n`, 'utf-8');

  console.log(`Updated ${settingsPath}:`);
  if (added.marketplaces.length) {
    console.log(`  + marketplaces: ${added.marketplaces.join(', ')}`);
  }
  if (added.plugins.length) {
    console.log(`  + enabledPlugins: ${added.plugins.join(', ')}`);
  }
  console.log('Restart Claude Code in this project; you will be prompted to trust the marketplaces and install the plugins.');
}

main();
