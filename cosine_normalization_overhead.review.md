## 问题名：`cosine_normalization_overhead.review.md`

**详细描述：**
在 `src/binaryQuantizationFormat.ts` 文件的 `quantizeVectors` 方法中，当相似度函数为 `VectorSimilarityFunction.COSINE` 时，会对所有输入向量进行归一化处理：
```typescript
    const processedVectors = this.config.quantizer.similarityFunction === VectorSimilarityFunction.COSINE
      ? vectors.map(vec => normalizeVector(vec))
      : vectors;
```
`map` 操作会创建一个新的 `Float32Array[]` 数组，并且 `normalizeVector` 函数（定义在 `vectorOperations.ts` 中）会计算向量的模长并进行除法运算，这都是计算密集型操作。对于包含大量高维向量的集合，这种批量归一化操作会显著增加量化过程的计算时间和内存消耗。

**解决方案：**
考虑在某些场景下，如果原始向量已经归一化，或者可以在后续计算中避免重复归一化，可以优化此步骤。

1.  **添加配置选项以跳过归一化：** 类似于输入验证，可以在 `BinaryQuantizationConfig` 中添加一个 `skipNormalization: boolean` 选项。如果用户确定输入向量已经归一化，可以设置此选项为 `true`，从而跳过 `map` 操作。

    ```typescript
    interface BinaryQuantizationConfig {
      // ... 其他配置
      skipNormalization?: boolean; // 新增字段
    }

    // ...

    public quantizeVectors(vectors: Float32Array[]): { /* ... */ } {
      const processedVectors = (this.config.quantizer.similarityFunction === VectorSimilarityFunction.COSINE && !this.config.skipNormalization)
        ? vectors.map(vec => normalizeVector(vec))
        : vectors;
      // ...
    }
    ```

2.  **考虑就地归一化（如果可能）：** 如果 `normalizeVector` 函数可以修改原始向量而不是返回新向量，可以减少内存分配。但这需要仔细考虑对原始数据的影响，并确保不会引入副作用。目前 `normalizeVector` 返回新向量，所以这个方案需要修改 `normalizeVector` 的实现。

3.  **延迟归一化：** 如果归一化后的向量只在量化过程中使用，并且原始向量在其他地方也有用，那么当前的 `map` 操作是合理的。但如果归一化后的向量是主要操作对象，可以考虑在数据加载或生成阶段就进行归一化，而不是在每次量化时都进行。

对于当前代码结构，添加 `skipNormalization` 配置选项是最直接且安全的优化方式，允许用户根据其数据特性和性能需求进行权衡。