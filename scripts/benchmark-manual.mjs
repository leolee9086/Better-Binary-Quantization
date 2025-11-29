import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));


async function run() {
    const wasmPath = path.resolve(__dirname, '../wasm-dist/better_binary_quantization_bg.wasm');
    const wasmBuffer = fs.readFileSync(wasmPath);
    const wasmModule = await import(pathToFileURL(path.resolve(__dirname, '../wasm-dist/better_binary_quantization.js')));
    await wasmModule.default(wasmBuffer);

    const tsModule = await import(pathToFileURL(path.resolve(__dirname, '../dist/src/index.js')));

    const dim = 1536;
    const v1 = new Float32Array(dim).map(() => Math.random() * 2 - 1);
    const v2 = new Float32Array(dim).map(() => Math.random() * 2 - 1);
    const centroid = new Float32Array(dim).map(() => Math.random() * 0.1);

    const wasmSim = wasmModule.wasm_compute_similarity(v1, v2, "cosine");
    const tsSim = tsModule.computeCosineSimilarity(v1, v2);
    console.log(`Sim: WASM=${wasmSim} TS=${tsSim} Diff=${Math.abs(wasmSim - tsSim)}`);

    const wasmQ = new wasmModule.WasmScalarQuantizer(0.1, 5, "cosine");
    const tsQ = new tsModule.OptimizedScalarQuantizer({ similarityFunction: tsModule.VectorSimilarityFunction.COSINE, lambda: 0.1, iters: 5 });
    const tsDest = new Uint8Array(dim);

    const wRes = wasmQ.scalar_quantize(v1, 4, centroid);
    const tRes = tsQ.scalarQuantize(v1, tsDest, 4, centroid);

    console.log(`Corr: WASM=${wRes.correction} TS=${tRes.additionalCorrection}`);
    let miss = 0;
    for (let i = 0; i < dim; i++) if (wRes.quantizedVector[i] !== tsDest[i]) miss++;
    console.log(`Miss: ${miss}/${dim}`);

    const iters = 1000;
    const t0 = performance.now();
    for (let i = 0; i < iters; i++) tsQ.scalarQuantize(v1, tsDest, 4, centroid);
    const t1 = performance.now();
    for (let i = 0; i < iters; i++) wasmQ.scalar_quantize(v1, 4, centroid);
    const t2 = performance.now();

    console.log(`TS: ${(t1 - t0).toFixed(2)}ms`);
    console.log(`WASM: ${(t2 - t1).toFixed(2)}ms`);
    console.log(`Speedup: ${((t1 - t0) / (t2 - t1)).toFixed(2)}x`);
}
run().catch(console.error);
