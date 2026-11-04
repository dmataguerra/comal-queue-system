import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { verificarPublicacion } from './verify-release.mjs';

const configured = {
  GITHUB_REF: 'refs/tags/v1.0.0',
  GITHUB_REF_NAME: 'v1.0.0',
  WIN_CSC_LINK: 'private-certificate-content',
  WIN_CSC_KEY_PASSWORD: 'private-password',
  COMAL_SIGNER_SHA1: 'a'.repeat(40),
};

test('release preflight accepts matching tags with all signing configuration', () => {
  assert.equal(verificarPublicacion('1.0.0', configured).status, 'PASS');
});

test('unsigned publication accepts missing credentials but still enforces the version tag', () => {
  const unsigned = {
    GITHUB_REF: configured.GITHUB_REF,
    GITHUB_REF_NAME: configured.GITHUB_REF_NAME,
    COMAL_RELEASE_SIGNING: 'unsigned',
  };
  const report = verificarPublicacion('1.0.0', unsigned);
  assert.equal(report.status, 'PASS');
  assert.equal(report.signingMode, 'unsigned');
  assert.equal(report.checks.certificateConfigured, false);
  assert.equal(verificarPublicacion('1.0.1', unsigned).status, 'FAIL');
  assert.equal(
    verificarPublicacion('1.0.0', { ...unsigned, GITHUB_REF: 'refs/heads/main' }).status,
    'FAIL',
  );
});

test('a misspelled signing mode cannot bypass signing requirements', () => {
  const report = verificarPublicacion('1.0.0', { ...configured, COMAL_RELEASE_SIGNING: 'unsignd' });
  assert.equal(report.status, 'FAIL');
  assert.ok(report.errors.includes('Unknown release signing mode.'));
});

test('release preflight reports every missing signing setting together', () => {
  const report = verificarPublicacion('1.0.0', {
    GITHUB_REF: configured.GITHUB_REF,
    GITHUB_REF_NAME: configured.GITHUB_REF_NAME,
  });
  assert.equal(report.status, 'FAIL');
  assert.equal(report.errors.length, 3);
  for (const name of ['WIN_CSC_LINK', 'WIN_CSC_KEY_PASSWORD', 'COMAL_SIGNER_SHA1'])
    assert.ok(report.errors.some((error) => error.includes(name)));
});

test('release preflight rejects branch refs, version mismatches and malformed signers', () => {
  for (const change of [
    { GITHUB_REF: 'refs/heads/v1.0.0' },
    { GITHUB_REF_NAME: 'v0.4.0' },
    { COMAL_SIGNER_SHA1: 'g'.repeat(40) },
    { COMAL_SIGNER_SHA1: 'a'.repeat(39) },
    { WIN_CSC_LINK: '  ' },
    { WIN_CSC_KEY_PASSWORD: '' },
  ]) {
    assert.equal(verificarPublicacion('1.0.0', { ...configured, ...change }).status, 'FAIL');
  }
  assert.equal(verificarPublicacion('1.0.1', configured).status, 'FAIL');
});

test('failed release preflight preserves evidence without exposing credentials', () => {
  const directory = mkdtempSync(join(tmpdir(), 'comal-release-preflight-'));
  try {
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ version: '1.0.0' }));
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL('./verify-release.mjs', import.meta.url))],
      {
        cwd: directory,
        encoding: 'utf8',
        env: { ...process.env, ...configured, COMAL_SIGNER_SHA1: '' },
      },
    );
    assert.equal(result.status, 1);
    const evidence = readFileSync(join(directory, 'test-results/release-preflight.json'), 'utf8');
    const report = JSON.parse(evidence);
    assert.equal(report.status, 'FAIL');
    assert.equal(report.checks.signerConfigured, false);
    assert.equal(report.errors.length, 1);
    for (const secret of [configured.WIN_CSC_LINK, configured.WIN_CSC_KEY_PASSWORD])
      assert.ok(!`${evidence}${result.stdout}${result.stderr}`.includes(secret));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
