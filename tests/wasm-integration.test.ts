import { describe, it, expect, beforeAll } from 'vitest';
import init, {
    wasm_compute_similarity,
    WasmScalarQuantizer,
    wasm_create_random_vector
} from '../wasm-dist/better_binary_quantization.js';
import * as fs from 'fs';
import * as path from 'path';

describe('WASM Integration Tests', () => {
    beforeAll(async () => {
        // 在Node环境（Vitest）中，我们需要手动读取WASM文件并传递给init
        // 因为默认的fetch在Node中可能无法正确加载本地文件，或者import.meta.url解析有问题
        const wasmPath = path.resolve(__dirname, '../wasm-dist/better_binary_quantization_bg.wasm');
        const wasmBuffer = fs.readFileSync(wasmPath);
        await init(wasmBuffer);
    });

    it('should compute cosine similarity correctly', () => {
        const v1 = new Float32Array([1.0, 0.0, 0.0]);
        const v2 = new Float32Array([0.0, 1.0, 0.0]);
        const sim = wasm_compute_similarity(v1, v2, "cosine");
        expect(sim).toBeCloseTo(0.0); // Orthogonal vectors

        const v3 = new Float32Array([1.0, 0.0, 0.0]);
        const sim2 = wasm_compute_similarity(v1, v3, "cosine");
        expect(sim2).toBeCloseTo(1.0); // Same vectors
    });

    it('should create random vector from WASM', () => {
        const dim = 10;
        const vec = wasm_create_random_vector(dim, -1.0, 1.0);
        expect(vec.length).toBe(dim);
        for (let i = 0; i < dim; i++) {
            expect(vec[i]).toBeGreaterThanOrEqual(-1.0);
            expect(vec[i]).toBeLessThanOrEqual(1.0);
        }
    });

    it('should perform scalar quantization', () => {
        const quantizer = new WasmScalarQuantizer(0.1, 5, "euclidean");
        const vector = new Float32Array([0.5, -0.5, 1.0, -1.0]);
        const centroid = new Float32Array([0, 0, 0, 0]);

        const result = quantizer.scalar_quantize(vector, 4, centroid);

        expect(result.quantizedVector).toBeDefined();
        expect(result.quantizedVector.length).toBe(4);
        expect(result.correction).toBeDefined();
    });
});
