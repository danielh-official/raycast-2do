Refer to PLAN.md.

## Releases

- **`main`** is the testing ground and personal build. All work lands here first.
- **`release`** holds only what's in the Raycast Store, plus the release being prepared. Store PRs are published from `release`.
- **Sizing rule:** if it's too much for a human reviewer to parse, it needs to be smaller.

`RELEASE_SCHEDULE.md` (on `main` only) is the source of truth for what ships when:

- **Feature x Commit Map:** every commit on `main` after the Store version, oldest first, with its feature(s). Commits that change only planning docs, screenshots, or test tooling are marked "Not shipped". Before planning a release, add every unmapped commit.
- **Releases:** one section per release, with its features, commits, and why that cut. Plan the next release by applying the sizing rule to whole features, in dependency order.

### Preparing a release, on `release`

1. In `extension/`, run `npx ray pull-contributions` first, to bring in edits made to the extension in the Store repo.
2. Cherry-pick the release's commits from `main`, oldest first, with `git cherry-pick -x`. Keep planning docs (`PLAN.md`, `RELEASE_SCHEDULE.md`, `AGENTS.md`, `SCREENSHOTS.md`) on `main` only, removing any a cherry-pick brings.
3. Edit `extension/CHANGELOG.md` to describe exactly this release: one new `## [Title] - {PR_MERGE_DATE}` section above the released ones. Commits from `main` may have added lines to other sections; move them. Check `extension/README.md` describes only what ships.
4. Done when lint and build pass in `extension/` and `npm test` passes in `tests/`. Then publish with `npm run publish` in `extension/`.

### After the Store merges it

1. On `release`, run `npx ray pull-contributions` again: the Store fills in the CHANGELOG date and may compress images.
2. Merge `release` into `main`, keeping `main`'s code. `main`'s CHANGELOG keeps the released sections as the Store has them, with one `{PR_MERGE_DATE}` section on top for everything not yet released.
3. In `RELEASE_SCHEDULE.md`, mark the release as released, with its date and PR link.
