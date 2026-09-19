// Load actual TSX pages under Node. Only animation, global chrome and toasts are
// replaced; forms, routing, resources and API requests execute their real code.
import { readFile, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../src/', import.meta.url));
const dataUrl = (code) => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const react = pathToFileURL(require.resolve('react')).href;
const stubs = {
  'framer-motion': dataUrl('export const motion = new Proxy({}, {get: (_, tag) => tag}); export const AnimatePresence = ({children}) => children;'),
  '@/components/AppNavigation': dataUrl('export const AppNavigation = () => null;'),
  '@/components/ScrollReveal': dataUrl(`import {createElement} from ${JSON.stringify(react)}; export const ScrollReveal = ({children}) => createElement('div', null, children);`),
  '@/components/Toaster': dataUrl('export const useToast = () => globalThis.websiteTestToast;'),
  '@/contexts/WorkspaceContext': dataUrl(`export const useWorkspace = () => ({
    workspaces: [], current: {id: 'test-workspace', role: globalThis.websiteTestRole ?? 'owner'},
    bootstrap: null, loading: false, error: null, select() {}, async refresh() {}, async create() {},
  });`),
};
const modules = new Map();

async function resolveImport(specifier, file) {
  if (stubs[specifier]) return stubs[specifier];
  if (!specifier.startsWith('.') && !specifier.startsWith('@/')) {
    return pathToFileURL(require.resolve(specifier)).href;
  }
  const base = specifier.startsWith('@/') ? resolve(root, specifier.slice(2)) : resolve(dirname(file), specifier);
  for (const suffix of ['', '.ts', '.tsx']) {
    try { await access(base + suffix); } catch { continue; }
    return moduleUrl(base + suffix);
  }
  throw new Error(`Cannot resolve ${specifier} from ${file}`);
}

async function moduleUrl(file) {
  if (modules.has(file)) return modules.get(file);
  const source = (await readFile(file, 'utf8')).replaceAll('import.meta.env', '({})');
  let { outputText } = ts.transpileModule(source, { fileName: file, compilerOptions: {
    module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } });
  for (const match of [...outputText.matchAll(/\bfrom\s*(['"])([^'"]+)\1/g)]) {
    const url = await resolveImport(match[2], file);
    outputText = outputText.replace(match[0], `from ${JSON.stringify(url)}`);
  }
  const url = dataUrl(outputText);
  modules.set(file, url);
  return url;
}

export async function loadUi(relative) {
  return import(await moduleUrl(resolve(root, relative)));
}
