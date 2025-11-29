import { describe, bench, beforeAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import {
    WasmProvider,
    wasm_compute_similarity,
    WasmScalarQuantizer
} from '../../src/wasm';
import { computeCosineSimilarity } from '../../src/vectorSimilarity';
import { OptimizedScalarQuantizer } from '../../src/optimizedScalarQuantizer';
import { VectorSimilarityFunction } from '../../src/types';

describe('WASM vs TypeScript Performance Comparison', () => {
    // Test data
    const dim = 1536; // OpenAI embedding dimension
    const v1 = new Float32Array(dim);
    const v2 = new Float32Array(dim);
    const centroid = new Float32Array(dim);

    // Initialize data
    for (let i = 0; i < dim; i++) {
        v1[i] = Math.random() * 2 - 1;
        v2[i] = Math.random() * 2 - 1;
        centroid[i] = Math.random() * 0.1;
    }

    // TS Quantizer
    const tsQuantizer = new OptimizedScalarQuantizer({
        similarityFunction: VectorSimilarityFunction.COSINE,
        lambda: 0.1,
        iters: 5
    });
    const tsDest = new Uint8Array(dim);

    // WASM Quantizer
    let wasmQuantizer: WasmScalarQuantizer;

    beforeAll(async () => {
        try {
            console.log('Initializing WASM...');
            // Initialize WASM
            const wasmPath = path.resolve(__dirname, '../../wasm-dist/better_binary_quantization_bg.wasm');
            if (!fs.existsSync(wasmPath)) {
                throw new Error(`WASM file not found at ${wasmPath}`);
            }
            const wasmBuffer = fs.readFileSync(wasmPath);
            await WasmProvider.init(wasmBuffer);
            console.log('WASM initialized successfully');

            wasmQuantizer = new WasmScalarQuantizer(0.1, 5, "cosine");

            // Warmup / Verify
            const logMsg: string[] = [];
            logMsg.push('Verifying WASM functions...');
            const sim = wasm_compute_similarity(v1, v2, "cosine");
            const tsSim = computeCosineSimilarity(v1, v2);
            logMsg.push(`Warmup similarity: WASM=${sim}, TS=${tsSim}`);

            const logPath = path.resolve(__dirname, '../../benchmark_verification.log');

            if (Math.abs(sim - tsSim) > 1e-5) {
                const err = `Similarity mismatch: WASM=${sim}, TS=${tsSim}`;
                logMsg.push(err);
                fs.writeFileSync(logPath, logMsg.join('\n'));
                throw new Error(err);
            }

            const qRes = wasmQuantizer.scalar_quantize(v1, 4, centroid);
            const tsRes = tsQuantizer.scalarQuantize(v1, tsDest, 4, centroid);

            logMsg.push(`Warmup quantization done`);

            // Verify Quantization Correctness
            logMsg.push('Verifying Quantization Correctness...');
            // Check correction
            logMsg.push(`Correction: WASM=${qRes.correction}, TS=${tsRes.additionalCorrection}`);
            if (Math.abs(qRes.correction - tsRes.additionalCorrection) > 1e-4) {
                logMsg.push(`Correction mismatch: WASM=${qRes.correction}, TS=${tsRes.additionalCorrection}`);
            }

            // Check quantized vector
            let mismatchCount = 0;
            for (let i = 0; i < dim; i++) {
                if (qRes.quantizedVector[i] !== tsDest[i]) {
                    mismatchCount++;
                    if (mismatchCount < 5) {
                        logMsg.push(`Quantization mismatch at ${i}: WASM=${qRes.quantizedVector[i]}, TS=${tsDest[i]}`);
                    }
                }
            }

            if (mismatchCount > 0) {
                logMsg.push(`Total quantization mismatches: ${mismatchCount} / ${dim}`);
                fs.writeFileSync(logPath, logMsg.join('\n'));
                throw new Error("Quantization results do not match!");
            } else {
                logMsg.push("Quantization results match perfectly!");
                fs.writeFileSync(logPath, logMsg.join('\n'));
            }

        } catch (e) {
            console.error('Failed to initialize WASM in benchmark:', e);
            throw e;
        }
    });

    describe('Cosine Similarity (1536 dim)', () => {
        bench('TypeScript', () => {
            computeCosineSimilarity(v1, v2);
        });

        bench('WASM', () => {
            wasm_compute_similarity(v1, v2, "cosine");
        });
    });

    describe('Scalar Quantization (1536 dim, 4 bits)', () => {
        bench('TypeScript', () => {
            tsQuantizer.scalarQuantize(v1, tsDest, 4, centroid);
        });

        bench('WASM', () => {
            if (!wasmQuantizer) throw new Error("WASM not initialized");
            wasmQuantizer.scalar_quantize(v1, 4, centroid);
        });
    });
});
