Refer to PLAN.md.

## Releases

- **`main`** holds what's in the Raycast Store, plus the release being prepared. Store PRs are published from `main`.
- **`experimental`** holds all other work, kept rebased onto `main`. New work lands here first.
- **Sizing rule:** if it's too much for a human reviewer to parse, it needs to be smaller.
- **Docs:** `PLAN.md`, `AGENTS.md` and `SCREENSHOTS.md` are identical on `main` and `experimental`. Change them on both. `PLAN.md`'s Releases section lists what's released and the order of the next releases.

### Preparing a release, on `main`

1. In `extension/`, run `npx ray pull-contributions` first, to bring in edits made to the extension in the Store repo. Until the next publish, it re-pulls edits `main` already has; when its merge changes no files, reset `main` to before it and delete its `contributions/merge-*` branch.
2. Take the next release in `PLAN.md`'s order, checked against the sizing rule. Build it as one commit from `experimental`'s version of the files, leaving out code for later releases. Keep the diff small: avoid re-indenting unchanged code.
3. Edit `extension/CHANGELOG.md` to describe exactly this release: one new `## [Title] - {PR_MERGE_DATE}` section above the released ones. Check `extension/README.md` describes only what ships.
4. Done when lint and build pass in `extension/` and `npm test` passes in `tests/`. Then publish with `npm run publish` in `extension/`. Fixes from the Store review go on `main` as their own commits.
5. In `PLAN.md`'s Releases section, on both branches, move the release to Released with its PR link, and its date once merged.

### Keeping `experimental` rebased

After each change to `main`, rebase `experimental` onto it, skipping `experimental`'s commits for features `main` already has. Resolve conflicts toward `experimental`'s code, keeping what `main` added. Then `experimental`'s CHANGELOG keeps `main`'s sections as they are, with one `{PR_MERGE_DATE}` section on top for everything not yet released.
