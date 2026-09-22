# AGENTS.md - Twake Libs Monorepo

## Quick Commands

```bash
# Install dependencies
npm ci

# Build all packages
npm run build

# Lint all packages
npm run lint

# Lint specific package
npm run lint --workspace=@linagora/twake-utils

# Test dry-run release (safe, no publish)
npm run release:dry
```

## Critical Rules

**⚠️ NEVER run `npm run release` locally** - it publishes to npm for real. Releases only happen via GitHub Actions on merge to main.

**⚠️ Always use Node 24** - specified in `.nvmrc`. Other versions will fail.

## Architecture

- **Monorepo**: npm workspaces with independent versioning
- **Packages location**: `packages/*`
- **Package naming**: All packages use `@linagora/` scope
- **Build output**: Each package outputs to `dist/` (TypeScript compilation)

## Release Flow (Automated)

```text
PR merged to main
    ↓
CI runs `multi-semantic-release`
    ↓
MSR detects changed packages since their last tag
    ↓
For each changed package:
    - Bumps version (conventional commits)
    - Updates CHANGELOG.md
    - Publishes to npm
    - Creates git tag (e.g. @linagora/twake-utils@2.0.1)
    - Creates separate GitHub release
```

## Adding New Packages

1. Create package in `packages/<name>/`
2. Required in `package.json`:
   - `"name": "@linagora/<name>"`
   - `"publishConfig": { "access": "public" }`
   - `"files": ["dist", "CHANGELOG.md", "README.md"]`
3. No per-package config needed — the root `.releaserc.json` applies to all workspaces

## CI/CD Notes

- **Runs on**: PRs and push to main
- **Order**: install → lint → test → build → release (main only)
- **Secrets required**: `NODE_AUTH_TOKEN` (NPM token, set in GitHub repo settings)
- **Uses**: `secrets.GITHUB_TOKEN` (auto-provided, no setup needed)

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) for automatic versioning:
- `feat:` → minor version bump
- `fix:` → patch version bump
- `feat!:` or `BREAKING CHANGE:` → major version bump
