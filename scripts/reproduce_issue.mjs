import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Use absolute path to ensure we find the module
const wasmPath = path.resolve(__dirname, '../wasm-dist/better_binary_quantization.js');

async function run() {
    console.log('Loading WASM...');
    const wasmModule = await import('file://' + wasmPath);

    // Initialize WASM
    // In Node.js environment with generated WASM, we might need to read the wasm file manually
    // if the loader expects fetch (which isn't in Node by default in older versions, but is in newer).
    // However, usually wasm-pack generates code that handles Node.js if target is correct.
    // If it fails, we might need to pass the bytes.

    try {
        await wasmModule.default();
    } catch (e) {
        console.log("Default init failed, trying with fs read...");
        const wasmBuffer = fs.readFileSync(path.resolve(__dirname, '../wasm-dist/better_binary_quantization_bg.wasm'));
        await wasmModule.default(wasmBuffer);
    }

    const { WasmQuantizedIndex, WasmQuantizedIndexConfig } = wasmModule;

    const dimension = 1536;
    const vectorCount = 10000; // User reported 10000 causes crash
    console.log(`Creating ${vectorCount} vectors of dimension ${dimension}...`);

    // Create flat vectors
    const totalSize = vectorCount * dimension;
    const vectors = new Float32Array(totalSize);
    for (let i = 0; i < totalSize; i++) {
        vectors[i] = Math.random() * 2 - 1;
    }

    console.log('Building index...');
    const config = new WasmQuantizedIndexConfig(4, 1, "cosine", 0.1, 5);
    const index = new WasmQuantizedIndex(config);

    try {
        index.build_index(vectors, dimension);
        console.log('Index built successfully.');
    } catch (e) {
        console.error('Error building index:', e);
        return;
    }

    console.log('Searching...');
    const query = new Float32Array(dimension);
    for (let i = 0; i < dimension; i++) {
        query[i] = Math.random() * 2 - 1;
    }

    try {
        const results = index.search_nearest_neighbors(query, 10);
        console.log('Search results:', results.length);
    } catch (e) {
        console.error('Error searching:', e);
    }
}

run().catch(console.error);
