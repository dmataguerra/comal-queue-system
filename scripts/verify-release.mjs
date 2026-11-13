import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function verifyRelease(version, env) {
  const tag = env.GITHUB_REF_NAME ?? '';
  const signingMode = env.COMAL_RELEASE_SIGNING ?? 'signed';
  const signingRequired = signingMode !== 'unsigned';
  const checks = {
    tagMatches: env.GITHUB_REF === `refs/tags/v${version}` && tag === `v${version}`,
    certificateConfigured: Boolean(env.WIN_CSC_LINK?.trim()),
    passwordConfigured: Boolean(env.WIN_CSC_KEY_PASSWORD),
    signerConfigured: /^[A-Fa-f0-9]{40}$/.test(env.COMAL_SIGNER_SHA1 ?? ''),
  };
  const errors = [];
  if (!['signed', 'unsigned'].includes(signingMode)) errors.push('Unknown release signing mode.');
  if (!checks.tagMatches) errors.push('Release tag must match package.json version.');
  if (signingRequired && !checks.certificateConfigured)
    errors.push('Configure the WIN_CSC_LINK secret in the production environment.');
  if (signingRequired && !checks.passwordConfigured)
    errors.push('Configure the WIN_CSC_KEY_PASSWORD secret in the production environment.');
  if (signingRequired && !checks.signerConfigured)
    errors.push(
      'Configure the COMAL_SIGNER_SHA1 variable with the approved 40-digit hexadecimal thumbprint.',
    );
  return { status: errors.length ? 'FAIL' : 'PASS', version, tag, signingMode, checks, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
  const report = verifyRelease(version, process.env);
  const target = join('test-results', 'release-preflight.json');
  mkdirSync('test-results', { recursive: true });
  // The report records presence and validity, never the certificate or its credentials.
  writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Release preflight: ${report.status}. Evidence: ${target}`);
  for (const error of report.errors) console.error(error);
  process.exitCode = report.errors.length ? 1 : 0;
}
