# 2Do for Raycast

Add, browse, and edit [2Do](https://www.2doapp.com) tasks from Raycast. See [extension/README.md](extension/README.md) for what the extension does.

## Layout

- `extension/` — the Raycast extension. Only this folder is sent to the Raycast Store.
- `tests/` — unit tests for `extension/src`, kept out of the Store submission.

## Development

```bash
cd extension
npm install
npm run dev       # load the extension into Raycast
npm run lint      # Raycast lint (ESLint + Prettier + manifest checks)
npm run publish   # open or update the Raycast Store PR
```

## Tests

Run `npm install` in `extension/` first; the tests use its dependencies.

```bash
cd tests
npm install
npm test
```

### Live tests

The extension relies on how 2Do's automation behaves. `tests/live/` checks those assumptions against the real 2Do. Run it now and then, especially after 2Do updates. It never runs with `npm test`.

1. Create a list named **Live Testing** in 2Do, and keep it for the live tests only. 2Do's automation can't create lists.
2. Run the suite:

```bash
cd tests
npm run test:live
```

It empties the Live Testing list, seeds it with one task per feature, covering both happy and unhappy paths (`live/seed.js`), then runs `live/live.test.ts`, which changes those tasks. If there's no Live Testing list, it stops before changing anything.

The **Demo** list is separate, and holds happy-path tasks for Store screenshots. See [SCREENSHOTS.md](SCREENSHOTS.md).

For what only Raycast's interface shows, like rings, warnings, dropdowns and forms, go through [tests/live/CHECKLIST.md](tests/live/CHECKLIST.md) by hand.
