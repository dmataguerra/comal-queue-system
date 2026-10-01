# CI/CD

CI runs on pull requests, pushes to main/master/development, and manual dispatches.
Set branch protection to require both `Formatting, lint, tests and security` and
`Windows application and installer` before merging.

The reusable `validate.yml` first checks formatting, lint, unit/audio tests, and
high/critical dependency vulnerabilities. Only after those pass does it build the
pinned 0.2.0 upgrade baseline and validate the Windows application, installer,
upgrade and rollback. The current application is built once per Windows job.
Successful runs retain the installer for seven days; failures retain diagnostics.

`npm run format` and `npm run format:check` cover the same files, including the
workflows. `.gitattributes` enforces LF in text checkouts even when Windows Git has
`core.autocrlf=true`. Prettier and EditorConfig use the same LF policy. CI checks
formatting without rewriting files. Run `npm ci` to use the lockfile's formatter.

CD runs the same complete validation on version tags. A tag must equal `v` plus
the version in package.json. After validation, CD packages and tests the release
installer, uploads assets to a draft, then publishes it. Electron-builder never
publishes independently. Existing releases are not overwritten. Configure both
`WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` for signing; without either, the installer
is unsigned. A partially configured signing pair fails the release.

A manual CD run on a branch validates without publishing. To publish, create a
matching version tag on the reviewed commit and push it. Manual runs on an
existing version tag also publish if no release exists yet.

`release.yml` remains the explicitly requested 390-minute endurance test. It uses
the `production` environment and the self-hosted Windows runner labeled
`comal-production`. Configure environment approvals and keep that runner current
(at least Actions runner 2.327.1 for Node 24 actions). Its concurrency group
prevents two endurance runs from using the production runner simultaneously.
