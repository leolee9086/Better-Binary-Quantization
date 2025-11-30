// TypeScript implementation
import { BinaryQuantizationFormat, VectorSimilarityFunction } from '../src/index.ts';

interface TestConfig {
    dimension: number;
    vectorCount: number;
    queryCount: number;
    bits: 1 | 4;
}

interface TestResult {
    name: string;
    avgTime: number;
    totalTime: number;
    memoryBefore: number;
    memoryAfter: number;
    memoryDelta: number;
    vectorsProcessed: number;
    recallRate?: number;
}

function generateRandomVector(dimension: number): Float32Array {
    const vector = new Float32Array(dimension);
    for (let i = 0; i < dimension; i++) {
        vector[i] = Math.random() * 2 - 1;
    }
    return vector;
}

function getMemoryUsage(): number {
    if ('memory' in performance && (performance as any).memory) {
        return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
}

function showMemoryWarning() {
    const warning = document.getElementById('memoryWarning');
    if (warning && getMemoryUsage() === 0) {
        warning.style.display = 'block';
    }
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function runTypeScriptTest(config: TestConfig): Promise<TestResult> {
    const { dimension, vectorCount, queryCount, bits } = config;

    if ('gc' in globalThis) {
        (globalThis as any).gc();
    }

    const memoryBefore = getMemoryUsage();
    const startTime = performance.now();

    const vectors: Float32Array[] = [];
    for (let i = 0; i < vectorCount; i++) {
        vectors.push(generateRandomVector(dimension));
    }

    const format = new BinaryQuantizationFormat({
        queryBits: bits,
        indexBits: 1,
        quantizer: {
            similarityFunction: VectorSimilarityFunction.COSINE,
            lambda: 0.001,
            iters: 5
        }
    });

    const { quantizedVectors } = format.quantizeVectors(vectors);

    const queryTimes: number[] = [];
    let totalRecall = 0;
    const k = 10;

    for (let i = 0; i < queryCount; i++) {
        const query = generateRandomVector(dimension);

        const queryStart = performance.now();
        const quantizedResults = format.searchNearestNeighbors(query, quantizedVectors, k);
        queryTimes.push(performance.now() - queryStart);

        const groundTruth = vectors
            .map((vec, idx) => ({ idx, score: cosineSimilarity(query, vec) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, k)
            .map(r => r.idx);

        const quantizedIndices = new Set(quantizedResults.map(r => r.index));
        const overlap = groundTruth.filter(idx => quantizedIndices.has(idx)).length;
        totalRecall += overlap / k;
    }

    const totalTime = performance.now() - startTime;
    const avgTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
    const recallRate = (totalRecall / queryCount) * 100;

    await new Promise(resolve => setTimeout(resolve, 100));
    const memoryAfter = getMemoryUsage();

    return {
        name: 'TypeScript',
        avgTime,
        totalTime,
        memoryBefore,
        memoryAfter,
        memoryDelta: memoryAfter - memoryBefore,
        vectorsProcessed: vectorCount,
        recallRate
    };
}

async function runRustTest(config: TestConfig): Promise<TestResult> {
    const { dimension, vectorCount, queryCount, bits } = config;

    if ('gc' in globalThis) {
        (globalThis as any).gc();
    }

    const memoryBefore = getMemoryUsage();
    const startTime = performance.now();

    try {
        // 使用新的量化索引接口
        const wasmModule = await import('../wasm-dist/better_binary_quantization.js');
        
        // 初始化WASM模块
        await wasmModule.default();
        
        const {
            WasmQuantizedIndex,
            WasmQuantizedIndexConfig,
            wasm_compute_similarity
        } = wasmModule;

        // 生成测试向量
        const vectors: Float32Array[] = [];
        for (let i = 0; i < vectorCount; i++) {
            vectors.push(generateRandomVector(dimension));
        }

        // 创建量化索引配置
        // 修复：当索引使用1位时，查询也应该使用1位以保持向量长度一致
        // 但是当用户选择4位时，我们需要使用4位查询和1位索引的组合
        const queryBits = bits; // 使用用户选择的位数
        const indexConfig = new WasmQuantizedIndexConfig(
            queryBits, // queryBits
            1, // indexBits
            "cosine", // similarityFunction
            0.1, // lambda
            5 // iters
        );

        // 创建量化索引
        const index = new WasmQuantizedIndex(indexConfig);

        // 构建索引 - 将向量展平为Float32Array
        const flatVectors = new Float32Array(vectorCount * dimension);
        for (let i = 0; i < vectorCount; i++) {
            flatVectors.set(vectors[i], i * dimension);
        }
        index.build_index(flatVectors, dimension);

        const queryTimes: number[] = [];
        let totalRecall = 0;
        const k = 10;

        for (let i = 0; i < queryCount; i++) {
            const query = generateRandomVector(dimension);
            const queryStart = performance.now();

            // 使用量化索引搜索
            const quantizedResults = index.search_nearest_neighbors(query, k);
            queryTimes.push(performance.now() - queryStart);

            const quantizedIndices = quantizedResults.map((r: any) => r.index);

            // 计算真实的前K个最近邻
            const groundTruth = vectors
                .map((vec, idx) => ({
                    idx,
                    score: wasm_compute_similarity(query, vec, "cosine") as number
                }))
                .sort((a, b) => b.score - a.score)
                .slice(0, k)
                .map(r => r.idx);

            const quantizedSet = new Set(quantizedIndices);
            const overlap = groundTruth.filter(idx => quantizedSet.has(idx)).length;
            totalRecall += overlap / k;
        }

        const totalTime = performance.now() - startTime;
        const avgTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
        const recallRate = (totalRecall / queryCount) * 100;

        await new Promise(resolve => setTimeout(resolve, 100));
        const memoryAfter = getMemoryUsage();

        return {
            name: 'Rust WASM',
            avgTime,
            totalTime,
            memoryBefore,
            memoryAfter,
            memoryDelta: memoryAfter - memoryBefore,
            vectorsProcessed: vectorCount,
            recallRate
        };
    } catch (error) {
        console.error('WASM test error:', error);
        throw error;
    }
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return 'N/A';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function formatTime(ms: number): string {
    return ms.toFixed(2) + ' ms';
}

function displayResult(result: TestResult) {
    const resultsDiv = document.getElementById('results')!;
    const cardClass = result.name === 'TypeScript' ? 'ts' : 'rust';
    const card = document.createElement('div');
    card.className = `result-card ${cardClass}`;

    const recallHtml = result.recallRate !== undefined
        ? `<div class="result-item">
      <span class="result-label">召回率 (Recall@10)</span>
      <span class="result-value">${result.recallRate.toFixed(2)}%</span>
    </div>`
        : '';

    card.innerHTML = `
    <h3>${result.name} 版本</h3>
    <div class="result-item">
      <span class="result-label">平均查询时间</span>
      <span class="result-value">${formatTime(result.avgTime)}</span>
    </div>
    <div class="result-item">
      <span class="result-label">总执行时间</span>
      <span class="result-value">${formatTime(result.totalTime)}</span>
    </div>
    ${recallHtml}
    <div class="result-item">
      <span class="result-label">初始内存</span>
      <span class="result-value">${formatBytes(result.memoryBefore)}</span>
    </div>
    <div class="result-item">
      <span class="result-label">最终内存</span>
      <span class="result-value">${formatBytes(result.memoryAfter)}</span>
    </div>
    <div class="result-item">
      <span class="result-label">内存增量</span>
      <span class="result-value">${formatBytes(result.memoryDelta)}</span>
    </div>
    <div class="result-item">
      <span class="result-label">处理向量数</span>
      <span class="result-value">${result.vectorsProcessed.toLocaleString()}</span>
    </div>
  `;

    resultsDiv.appendChild(card);
}

function getConfig(): TestConfig {
    return {
        dimension: parseInt((document.getElementById('dimension') as HTMLInputElement).value),
        vectorCount: parseInt((document.getElementById('vectorCount') as HTMLInputElement).value),
        queryCount: parseInt((document.getElementById('queryCount') as HTMLInputElement).value),
        bits: parseInt((document.getElementById('bits') as HTMLSelectElement).value) as 1 | 4
    };
}

function showLoading(show: boolean) {
    const loading = document.getElementById('loading')!;
    loading.className = show ? 'loading active' : 'loading';
}

function clearResults() {
    document.getElementById('results')!.innerHTML = '';
}

document.getElementById('runTS')!.addEventListener('click', async () => {
    clearResults();
    showLoading(true);
    try {
        const result = await runTypeScriptTest(getConfig());
        displayResult(result);
        showMemoryWarning();
    } catch (error) {
        console.error('TypeScript test failed:', error);
        alert('TypeScript 测试失败: ' + error);
    } finally {
        showLoading(false);
    }
});

document.getElementById('runRust')!.addEventListener('click', async () => {
    clearResults();
    showLoading(true);
    try {
        const result = await runRustTest(getConfig());
        displayResult(result);
        showMemoryWarning();
    } catch (error) {
        console.error('Rust test failed:', error);
        alert('Rust 测试失败: ' + error);
    } finally {
        showLoading(false);
    }
});

document.getElementById('runBoth')!.addEventListener('click', async () => {
    clearResults();
    showLoading(true);
    try {
        const config = getConfig();
        const tsResult = await runTypeScriptTest(config);
        displayResult(tsResult);

        await new Promise(resolve => setTimeout(resolve, 500));

        const rustResult = await runRustTest(getConfig());
        displayResult(rustResult);

        showMemoryWarning();
    } catch (error) {
        console.error('Comparison test failed:', error);
        alert('对比测试失败: ' + error);
    } finally {
        showLoading(false);
    }
});

console.log('Demo ready. Click a button to start testing!');

