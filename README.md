# nostr-extension

## setup

```bash
yarn install
yarn build
```

Then load the extension from `chrome://extensions/` pointing to this directory.

## development

```bash
yarn watch  # auto-rebuild on changes
```

**Important:** After rebuilding, you must:
1. Reload the extension at `chrome://extensions/`
2. **Close DevTools completely** (not just refresh)
3. Reopen DevTools → Nostr tab

The panel HTML is cached and won't update otherwise.

## todo

- better formating of events
- filter on kinds
- sep tabs
  - full stream of events
  - summary
  - build
- ditch weird banner thing, think of a better ux there
