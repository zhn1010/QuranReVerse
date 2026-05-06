import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const extensionRoot = path.join(repoRoot, 'extension');
const srcRoot = path.join(extensionRoot, 'src');
const distRoot = path.join(extensionRoot, 'dist');
const iconSourcePath = path.join(repoRoot, 'public', 'LogoSakinah.now-removebg.png');
const appOrigin = process.env.SAKINAH_EXTENSION_APP_ORIGIN ?? 'https://sakinah.now';

const fileCopies = [
  ['background.mjs', 'background.js'],
  ['content-script.mjs', 'content-script.js'],
  ['selection-popover.mjs', 'selection-popover.js'],
  ['shared/browser.mjs', 'shared/browser.js'],
  ['shared/constants.mjs', 'shared/constants.js'],
  ['shared/request-store.mjs', 'shared/request-store.js'],
];

const manifestFiles = {
  chrome: path.join(extensionRoot, 'manifest.chrome.json'),
  firefox: path.join(extensionRoot, 'manifest.firefox.json'),
};

function transformSource(content) {
  return content
    .replaceAll('__SAKINAH_APP_ORIGIN__', appOrigin)
    .replaceAll('.mjs', '.js');
}

async function ensureDir(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function copyStaticFile(sourceRelativePath, destinationRelativePath, browser) {
  const sourcePath = path.join(srcRoot, sourceRelativePath);
  const destinationPath = path.join(distRoot, browser, destinationRelativePath);
  const original = await readFile(sourcePath, 'utf8');
  await ensureDir(destinationPath);
  await writeFile(destinationPath, transformSource(original), 'utf8');
}

async function writeManifest(browser) {
  const manifestPath = manifestFiles[browser];
  const destinationPath = path.join(distRoot, browser, 'manifest.json');
  const original = await readFile(manifestPath, 'utf8');
  await ensureDir(destinationPath);
  await writeFile(destinationPath, transformSource(original), 'utf8');
}

async function copyIcon(browser) {
  const destinationPath = path.join(distRoot, browser, 'icons', 'logo.png');
  await ensureDir(destinationPath);
  await copyFile(iconSourcePath, destinationPath);
}

async function buildBrowser(browser) {
  for (const [sourceRelativePath, destinationRelativePath] of fileCopies) {
    await copyStaticFile(sourceRelativePath, destinationRelativePath, browser);
  }

  await writeManifest(browser);
  await copyIcon(browser);
}

async function main() {
  await rm(distRoot, { force: true, recursive: true });
  await Promise.all([buildBrowser('chrome'), buildBrowser('firefox')]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
