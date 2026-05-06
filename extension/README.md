# Sakinah.now Browser Extension

This extension lets a user select text on the web, right-click, choose the Sakinah.now item, add a feeling in a small in-page popover, and open a Sakinah.now reflection automatically.

## Build

For production Sakinah.now:

```bash
node extension/scripts/build.mjs
```

For local development against `http://localhost:3000`:

```bash
SAKINAH_EXTENSION_APP_ORIGIN=http://localhost:3000 node extension/scripts/build.mjs
```

Build output:

- `extension/dist/chrome`
- `extension/dist/firefox`

## Install in Chrome

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select `extension/dist/chrome`

The extension registers its context-menu item automatically.

## Install in Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click `Load Temporary Add-on...`
3. Select `extension/dist/firefox/manifest.json`

Firefox temporary add-ons are removed when Firefox restarts, so reload the add-on after restarting the browser.

## Local Testing

1. Start the website:

```bash
pnpm dev
```

2. Rebuild the extension for local origin:

```bash
SAKINAH_EXTENSION_APP_ORIGIN=http://localhost:3000 node extension/scripts/build.mjs
```

3. Reload the extension in Chrome or Firefox.
4. Open any webpage.
5. Select some text.
6. Right-click and choose `Bring me back to Sakinah now`.
7. In the in-page popover:
   - enter a feeling if you want
   - click `Open in Sakinah.now`
8. Confirm a new Sakinah.now tab opens and the reflection auto-starts.

## Manual Acceptance Checks

1. Select text, leave feeling blank, and confirm the website auto-starts a reflection.
2. Select text, add a feeling, and confirm that feeling is used.
3. Select very short or vague text and confirm the website shows the inline validation message instead of starting a chat.
4. Reload the opened Sakinah.now tab and confirm the same request does not replay.
5. Open the in-page popover and close it without submitting; confirm no site tab opens.
6. Confirm the popover and website handoff do not include page title, page URL, or browsing history.

## Troubleshooting

If the context-menu item does not appear:

- Make sure text is selected before right-clicking.
- Make sure the extension is enabled.
- Reload the extension after rebuilding.

If the in-page popover does not appear:

- Reload the extension after rebuilding.
- Try again on a regular web page instead of a browser-internal page.
- Some highly locked-down pages may block script injection.

If Sakinah.now opens but nothing auto-starts:

- Rebuild the extension with the correct `SAKINAH_EXTENSION_APP_ORIGIN`.
- Reload the extension after rebuilding.
- Confirm the site origin matches the build origin exactly.

## Development Loop

Typical loop while working on the extension:

```bash
pnpm dev
SAKINAH_EXTENSION_APP_ORIGIN=http://localhost:3000 node extension/scripts/build.mjs
```

Then reload the unpacked extension after each extension code change.
