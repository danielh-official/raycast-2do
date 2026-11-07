---
name: fix-lint
description: Fixes `npm run lint` errors in the Raycast extension, and reports the ones that need the user. Use when lint fails, including when the stop hook reports lint errors.
---

# Fix lint errors

Lint is `npm run lint` in `extension/` (Raycast's `ray lint`: package.json, icons, metadata, ESLint, Prettier).

1. Run `npm run fix-lint` in `extension/` for ESLint and Prettier's automatic fixes.
2. Run `npm run lint` again, and fix what's left in the files it names.
3. If code changed, also run `npx tsc --noEmit` in `extension/` and `npm test` in `tests/`.
4. Done when `npm run lint` passes, or every remaining error is one the user has to fix.

## Errors the user has to fix

Report these instead of working around them. For each, say the file, what's wrong, and what the user needs to do.

- **Screenshots** in `extension/metadata/` must be 2000 × 1250 PNGs. Retake them on a Retina display with Raycast's Window Capture. Leave the images as they are, since upscaling makes them blurry.
- **Icons and other assets** the user made, such as `extension/assets/icon.png`.
- **Account details** in `package.json`, such as `author`, which must be the user's Raycast username.

## Reporting

End the response with a short **Lint** note: what was fixed, and each error left for the user. Leave fixes uncommitted unless the user asked for a commit in this turn.
