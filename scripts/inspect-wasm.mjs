import * as path from 'path';
import { pathToFileURL } from 'url';

const wasmModulePath = path.resolve('wasm-dist/better_binary_quantization.js');
console.log('Loading:', wasmModulePath);

try {
    const module = await import(pathToFileURL(wasmModulePath));
    console.log('Keys:', Object.keys(module));
    console.log('Default export:', module.default);
    console.log('init export:', module.init);
} catch (e) {
    console.error(e);
}
