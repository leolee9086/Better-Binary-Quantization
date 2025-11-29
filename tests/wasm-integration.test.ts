import { describe, it, expect, beforeAll } from 'vitest';
import init, {
    wasm_compute_similarity,
    WasmScalarQuantizer,
    WasmQuantizedIndex,
    WasmQuantizedIndexConfig,
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

    // 召回率测试
    it('should build quantized index and perform recall test', async () => {
        const DIM = 128;
        const BASE_SIZE = 100;
        const QUERY_SIZE = 10;
        const K = 10;
        const RECALL_THRESHOLD = 0.6;

        // 生成测试数据
        const baseVectors: Float32Array[] = [];
        for (let i = 0; i < BASE_SIZE; i++) {
            const vector = new Float32Array(DIM);
            for (let j = 0; j < DIM; j++) {
                vector[j] = Math.random() * 2 - 1;
            }
            baseVectors.push(vector);
        }

        const queryVectors: Float32Array[] = [];
        for (let i = 0; i < QUERY_SIZE; i++) {
            const vector = new Float32Array(DIM);
            for (let j = 0; j < DIM; j++) {
                vector[j] = Math.random() * 2 - 1;
            }
            queryVectors.push(vector);
        }

        // 创建量化索引配置
        const config = new WasmQuantizedIndexConfig(
            4, // queryBits
            1, // indexBits
            "cosine", // similarityFunction
            0.1, // lambda
            5 // iters
        );

        // 创建量化索引
        const index = new WasmQuantizedIndex(config);

        // 构建索引
        const flatBaseVectors = new Float32Array(BASE_SIZE * DIM);
        for (let i = 0; i < BASE_SIZE; i++) {
            flatBaseVectors.set(baseVectors[i]!, i * DIM);
        }
        index.build_index(flatBaseVectors, DIM);

        // 计算召回率
        let totalRecall = 0;
        for (let i = 0; i < QUERY_SIZE; i++) {
            const query = queryVectors[i]!;

            // 使用量化索引搜索
            const quantizedResults = index.search_nearest_neighbors(query, K);
            const quantizedIndices = quantizedResults.map(r => r.index);

            // 计算真实的前K个最近邻
            const groundTruth = baseVectors
                .map((vec, idx) => ({
                    idx,
                    score: wasm_compute_similarity(query, vec!, "cosine")
                }))
                .sort((a, b) => b.score - a.score)
                .slice(0, K)
                .map(r => r.idx);

            // 计算召回率
            const overlap = groundTruth.filter(idx => quantizedIndices.includes(idx)).length;
            const recall = overlap / K;
            totalRecall += recall;

            // 验证结果
            expect(quantizedResults).toHaveLength(K);
            expect(quantizedResults.every(r => typeof r.index === 'number')).toBe(true);
            expect(quantizedResults.every(r => typeof r.score === 'number')).toBe(true);
            expect(groundTruth).toHaveLength(K);
            expect(quantizedIndices).toHaveLength(K);
        }

        const avgRecall = totalRecall / QUERY_SIZE;
        expect(avgRecall).toBeGreaterThanOrEqual(RECALL_THRESHOLD);
    });

    // 4位查询+1位索引召回率测试
    it('should perform 4-bit query + 1-bit index recall test', async () => {
        const DIM = 128;
        const BASE_SIZE = 100;
        const QUERY_SIZE = 10;
        const K = 10;
        const RECALL_THRESHOLD = 0.6;

        // 生成测试数据
        const baseVectors: Float32Array[] = [];
        for (let i = 0; i < BASE_SIZE; i++) {
            const vector = new Float32Array(DIM);
            for (let j = 0; j < DIM; j++) {
                vector[j] = Math.random() * 2 - 1;
            }
            baseVectors.push(vector);
        }

        const queryVectors: Float32Array[] = [];
        for (let i = 0; i < QUERY_SIZE; i++) {
            const vector = new Float32Array(DIM);
            for (let j = 0; j < DIM; j++) {
                vector[j] = Math.random() * 2 - 1;
            }
            queryVectors.push(vector);
        }

        // 创建4位查询+1位索引的量化索引配置
        const config = new WasmQuantizedIndexConfig(
            4, // queryBits
            1, // indexBits
            "cosine", // similarityFunction
            0.1, // lambda
            5 // iters
        );

        // 创建量化索引
        const index = new WasmQuantizedIndex(config);

        // 构建索引
        const flatBaseVectors = new Float32Array(BASE_SIZE * DIM);
        for (let i = 0; i < BASE_SIZE; i++) {
            flatBaseVectors.set(baseVectors[i]!, i * DIM);
        }
        index.build_index(flatBaseVectors, DIM);

        // 计算召回率
        let totalRecall = 0;
        for (let i = 0; i < QUERY_SIZE; i++) {
            const query = queryVectors[i]!;

            // 使用量化索引搜索
            const quantizedResults = index.search_nearest_neighbors(query, K);
            const quantizedIndices = quantizedResults.map(r => r.index);

            // 计算真实的前K个最近邻
            const groundTruth = baseVectors
                .map((vec, idx) => ({
                    idx,
                    score: wasm_compute_similarity(query, vec!, "cosine")
                }))
                .sort((a, b) => b.score - a.score)
                .slice(0, K)
                .map(r => r.idx);

            // 计算召回率
            const overlap = groundTruth.filter(idx => quantizedIndices.includes(idx)).length;
            const recall = overlap / K;
            totalRecall += recall;

            // 验证结果
            expect(quantizedResults).toHaveLength(K);
            expect(quantizedResults.every(r => typeof r.index === 'number')).toBe(true);
            expect(quantizedResults.every(r => typeof r.score === 'number')).toBe(true);
            expect(groundTruth).toHaveLength(K);
            expect(quantizedIndices).toHaveLength(K);
        }

        const avgRecall = totalRecall / QUERY_SIZE;
        expect(avgRecall).toBeGreaterThanOrEqual(RECALL_THRESHOLD);
    });

    // 性能对比测试
    it('should compare performance between quantized and brute force search', async () => {
        const DIM = 128;
        const BASE_SIZE = 200;
        const QUERY_SIZE = 20;
        const K = 10;

        // 生成测试数据
        const baseVectors: Float32Array[] = [];
        for (let i = 0; i < BASE_SIZE; i++) {
            const vector = new Float32Array(DIM);
            for (let j = 0; j < DIM; j++) {
                vector[j] = Math.random() * 2 - 1;
            }
            baseVectors.push(vector);
        }

        const queryVectors: Float32Array[] = [];
        for (let i = 0; i < QUERY_SIZE; i++) {
            const vector = new Float32Array(DIM);
            for (let j = 0; j < DIM; j++) {
                vector[j] = Math.random() * 2 - 1;
            }
            queryVectors.push(vector);
        }

        // 创建量化索引
        const config = new WasmQuantizedIndexConfig(
            4, // queryBits
            1, // indexBits
            "cosine", // similarityFunction
            0.1, // lambda
            5 // iters
        );
        const index = new WasmQuantizedIndex(config);

        // 构建索引
        const flatBaseVectors = new Float32Array(BASE_SIZE * DIM);
        for (let i = 0; i < BASE_SIZE; i++) {
            flatBaseVectors.set(baseVectors[i]!, i * DIM);
        }
        index.build_index(flatBaseVectors, DIM);

        // 测试量化搜索性能
        const quantizedStart = performance.now();
        for (let i = 0; i < QUERY_SIZE; i++) {
            const query = queryVectors[i]!;
            index.search_nearest_neighbors(query, K);
        }
        const quantizedTime = performance.now() - quantizedStart;

        // 测试暴力搜索性能
        const bruteForceStart = performance.now();
        for (let i = 0; i < QUERY_SIZE; i++) {
            const query = queryVectors[i]!;
            baseVectors
                .map((vec, idx) => ({
                    idx,
                    score: wasm_compute_similarity(query, vec!, "cosine")
                }))
                .sort((a, b) => b.score - a.score)
                .slice(0, K);
        }
        const bruteForceTime = performance.now() - bruteForceStart;

        // 验证性能提升
        expect(quantizedTime).toBeGreaterThan(0);
        expect(bruteForceTime).toBeGreaterThan(0);
        expect(quantizedTime).toBeLessThan(bruteForceTime); // 量化搜索应该更快

        console.log(`量化搜索时间: ${quantizedTime.toFixed(2)}ms`);
        console.log(`暴力搜索时间: ${bruteForceTime.toFixed(2)}ms`);
        console.log(`性能提升: ${(bruteForceTime / quantizedTime).toFixed(2)}x`);
    });
});
