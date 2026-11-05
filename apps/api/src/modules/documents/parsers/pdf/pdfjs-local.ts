import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDocument, VerbosityLevel } from 'pdfjs-dist/legacy/build/pdf.mjs';

const packageDirectory = dirname(fileURLToPath(import.meta.resolve('pdfjs-dist/package.json')));

function assetDirectory(name: string): string {
  return `${join(packageDirectory, name).replaceAll('\\', '/')}/`;
}

export function openLocalPdf(bytes: Uint8Array) {
  return getDocument({
    data: new Uint8Array(bytes),
    cMapUrl: assetDirectory('cmaps'),
    cMapPacked: true,
    standardFontDataUrl: assetDirectory('standard_fonts'),
    wasmUrl: assetDirectory('wasm'),
    useSystemFonts: false,
    useWorkerFetch: false,
    stopAtErrors: true,
    verbosity: VerbosityLevel.ERRORS,
  });
}
