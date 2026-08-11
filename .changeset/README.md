# Changesets

We use [Changesets](https://github.com/changesets/changesets) to manage releases.

## Adding a changeset

When your PR includes a user-facing change, run:

```bash
pnpm changeset
```

Select packages (when monorepo exists), bump type (patch/minor/major), and write a summary.

Commit the generated file in `.changeset/` with your PR.

## Release flow (maintainers)

1. Merge PRs with changesets
2. Run `pnpm changeset version` to bump versions and update CHANGELOG
3. Run `pnpm changeset publish` after CI passes

Until platform scaffold exists, changesets prepare release hygiene for future npm packages.
