const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const { pathToFileURL } = require('url');

if (typeof global.TextEncoder === 'undefined') {
    const { TextEncoder, TextDecoder } = require('util');
    global.TextEncoder = TextEncoder;
    global.TextDecoder = TextDecoder;
}

async function run() {
    console.log("Starting manual benchmark (CommonJS)...");

    const wasmPath = path.resolve(__dirname, '../wasm-dist/better_binary_quantization_bg.wasm');
    const wasmBuffer = fs.readFileSync(wasmPath);

    const wasmModulePath = path.resolve(__dirname, '../wasm-dist/better_binary_quantization.js');
    const wasmModule = await import(pathToFileURL(wasmModulePath));
    await wasmModule.default(wasmBuffer);
    console.log("WASM loaded.");

    // Load TS modules directly
    const OptimizedScalarQuantizerModule = require('../dist/src/optimizedScalarQuantizer.js');
    const VectorSimilarityModule = require('../dist/src/vectorSimilarity.js');
    const TypesModule = require('../dist/src/types.js');
    console.log("TS modules loaded.");

    const dim = 1536;
    const v1 = new Float32Array(dim);
    const v2 = new Float32Array(dim);
    const centroid = new Float32Array(dim);
    for (let i = 0; i < dim; i++) {
        v1[i] = Math.random() * 2 - 1;
        v2[i] = Math.random() * 2 - 1;
        centroid[i] = Math.random() * 0.1;
    }

    console.log("\n--- Verification ---");

    const wasmSim = wasmModule.wasm_compute_similarity(v1, v2, "cosine");
    const tsSim = VectorSimilarityModule.computeCosineSimilarity(v1, v2);
    console.log(`Sim: WASM=${wasmSim} TS=${tsSim} Diff=${Math.abs(wasmSim - tsSim)}`);

    const wasmQ = new wasmModule.WasmScalarQuantizer(0.1, 5, "cosine");
    const tsQ = new OptimizedScalarQuantizerModule.OptimizedScalarQuantizer({
        similarityFunction: TypesModule.VectorSimilarityFunction.COSINE,
        lambda: 0.1,
        iters: 5
    });
    const tsDest = new Uint8Array(dim);

    const wRes = wasmQ.scalar_quantize(v1, 4, centroid);
    const tRes = tsQ.scalarQuantize(v1, tsDest, 4, centroid);

    const wasmCorrection = wRes.correction.additional_correction;

    console.log(`Corr: WASM=${wasmCorrection} TS=${tRes.additionalCorrection}`);

    if (Math.abs(wasmCorrection - tRes.additionalCorrection) > 1e-4) {
        console.error("Correction mismatch!");
        // process.exit(1);
    } else {
        console.log("Correction matches.");
    }

    let miss = 0;
    for (let i = 0; i < dim; i++) if (wRes.quantizedVector[i] !== tsDest[i]) miss++;
    console.log(`Miss: ${miss}/${dim}`);

    if (miss > 5) {
        console.error("Too many mismatches!");
        process.exit(1);
    }

    console.log("\n--- Benchmark (1000 iterations) ---");
    const iters = 1000;

    const t0 = performance.now();
    for (let i = 0; i < iters; i++) tsQ.scalarQuantize(v1, tsDest, 4, centroid);
    const t1 = performance.now();

    const t2 = performance.now();
    for (let i = 0; i < iters; i++) wasmQ.scalar_quantize(v1, 4, centroid);
    const t3 = performance.now();

    const timeTs = t1 - t0;
    const timeWasm = t3 - t2;

    console.log(`TS: ${timeTs.toFixed(2)}ms`);
    console.log(`WASM: ${timeWasm.toFixed(2)}ms`);
    console.log(`Speedup: ${(timeTs / timeWasm).toFixed(2)}x`);
}

run().catch(console.error);
