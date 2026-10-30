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
