import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wasmPath = path.resolve(__dirname, '../wasm-dist/better_binary_quantization_bg.wasm');
const wasmBuffer = fs.readFileSync(wasmPath);
const wasmModulePath = path.resolve(__dirname, '../wasm-dist/better_binary_quantization.js');
const wasmModule = await import(pathToFileURL(wasmModulePath));

console.log('Buffer size:', wasmBuffer.length);
console.log('Buffer type:', wasmBuffer.constructor.name);

// 模拟环境
global.TextEncoder = class TextEncoder {
    encode(str) {
        return Buffer.from(str, 'utf-8');
    }
};
global.TextDecoder = class TextDecoder {
    decode(buffer) {
        return Buffer.from(buffer).toString('utf-8');
    }
};

try {
    await wasmModule.default(wasmBuffer);
    console.log('Success!');
} catch (e) {
    console.error('Error:', e);
}
