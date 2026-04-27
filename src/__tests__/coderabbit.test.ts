import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG_PATH = resolve(__dirname, '../../.coderabbit.yaml');

function readConfig(): string {
  return readFileSync(CONFIG_PATH, 'utf-8');
}

/**
 * Minimal YAML parser for the specific structure of .coderabbit.yaml.
 * Returns a structured object representing the config.
 */
function parseCoderabbitConfig(content: string): {
  reviews: {
    path_filters: string[];
    auto_review: {
      enabled: boolean;
      drafts: boolean;
    };
  };
} {
  const lines = content.split('\n');
  const pathFilters: string[] = [];
  let enabled: boolean | undefined;
  let drafts: boolean | undefined;

  for (const line of lines) {
    const trimmed = line.trim();

    // Parse path_filter list items (lines starting with "- ")
    const filterMatch = trimmed.match(/^-\s+"(.+)"$/);
    if (filterMatch) {
      pathFilters.push(filterMatch[1]);
      continue;
    }

    // Parse boolean values
    const enabledMatch = trimmed.match(/^enabled:\s+(true|false)$/);
    if (enabledMatch) {
      enabled = enabledMatch[1] === 'true';
      continue;
    }

    const draftsMatch = trimmed.match(/^drafts:\s+(true|false)$/);
    if (draftsMatch) {
      drafts = draftsMatch[1] === 'true';
      continue;
    }
  }

  return {
    reviews: {
      path_filters: pathFilters,
      auto_review: {
        enabled: enabled as boolean,
        drafts: drafts as boolean,
      },
    },
  };
}

describe('.coderabbit.yaml', () => {
  describe('file existence and readability', () => {
    it('exists at the repository root', () => {
      expect(existsSync(CONFIG_PATH)).toBe(true);
    });

    it('is a non-empty file', () => {
      const content = readConfig();
      expect(content.trim().length).toBeGreaterThan(0);
    });

    it('is valid UTF-8 text', () => {
      expect(() => readConfig()).not.toThrow();
    });
  });

  describe('path_filters', () => {
    it('excludes exactly three files', () => {
      const config = parseCoderabbitConfig(readConfig());
      expect(config.reviews.path_filters).toHaveLength(3);
    });

    it('excludes src/api/documents/parser.ts from review', () => {
      const config = parseCoderabbitConfig(readConfig());
      expect(config.reviews.path_filters).toContain('!src/api/documents/parser.ts');
    });

    it('excludes src/api/ukoly.ts from review', () => {
      const config = parseCoderabbitConfig(readConfig());
      expect(config.reviews.path_filters).toContain('!src/api/ukoly.ts');
    });

    it('excludes src/api/osnovy.ts from review', () => {
      const config = parseCoderabbitConfig(readConfig());
      expect(config.reviews.path_filters).toContain('!src/api/osnovy.ts');
    });

    it('all path_filters are negation patterns (prefixed with !)', () => {
      const config = parseCoderabbitConfig(readConfig());
      for (const filter of config.reviews.path_filters) {
        expect(filter.startsWith('!')).toBe(true);
      }
    });

    it('does not exclude any src/api/documents files other than parser.ts', () => {
      const config = parseCoderabbitConfig(readConfig());
      const documentsExclusions = config.reviews.path_filters.filter(
        (f) => f.startsWith('!src/api/documents/') && !f.includes('parser.ts'),
      );
      expect(documentsExclusions).toHaveLength(0);
    });

    it('does not include any inclusion (non-negation) filters', () => {
      const content = readConfig();
      const config = parseCoderabbitConfig(content);
      const inclusionFilters = config.reviews.path_filters.filter(
        (f) => !f.startsWith('!'),
      );
      expect(inclusionFilters).toHaveLength(0);
    });
  });

  describe('auto_review settings', () => {
    it('has auto_review enabled set to true', () => {
      const config = parseCoderabbitConfig(readConfig());
      expect(config.reviews.auto_review.enabled).toBe(true);
    });

    it('has auto_review drafts set to false', () => {
      const config = parseCoderabbitConfig(readConfig());
      expect(config.reviews.auto_review.drafts).toBe(false);
    });

    it('does not auto-review draft pull requests', () => {
      const config = parseCoderabbitConfig(readConfig());
      expect(config.reviews.auto_review.drafts).not.toBe(true);
    });
  });

  describe('overall structure', () => {
    it('contains the top-level reviews key', () => {
      const content = readConfig();
      expect(content).toMatch(/^reviews:/m);
    });

    it('contains path_filters section under reviews', () => {
      const content = readConfig();
      expect(content).toMatch(/path_filters:/);
    });

    it('contains auto_review section under reviews', () => {
      const content = readConfig();
      expect(content).toMatch(/auto_review:/);
    });

    it('does not contain unexpected top-level keys', () => {
      const content = readConfig();
      const topLevelKeys = content
        .split('\n')
        .filter((line) => /^\w/.test(line) && line.includes(':'))
        .map((line) => line.split(':')[0].trim());
      expect(topLevelKeys).toEqual(['reviews']);
    });
  });
});
