## 问题名：`quick_functions_frequent_instance_creation.review.md`

**详细描述：**
在 `src/index.ts` 文件中，`quickQuantize`、`quickSearch` 和 `computeAccuracy` 函数在每次被调用时都会创建一个新的 `BinaryQuantizationFormat` 实例。
```typescript
export function quickQuantize(
  vectors: Float32Array[],
  similarityFunction: VectorSimilarityFunction = VectorSimilarityFunction.COSINE
) {
  const format = new BinaryQuantizationFormat({ // 每次调用都创建新实例
    quantizer: {
      similarityFunction,
      lambda: 0.1,
      iters: 5
    }
  });
  
  return format.quantizeVectors(vectors);
}

// quickSearch 和 computeAccuracy 也有类似的问题
```
这种设计模式在某些情况下是合理的，例如当每次操作都需要完全独立的配置时。然而，如果这些函数在短时间内被频繁调用，并且它们的配置（`similarityFunction`, `lambda`, `iters` 等）保持不变，那么重复创建 `BinaryQuantizationFormat` 及其内部组件（`OptimizedScalarQuantizer`, `BinaryQuantizedScorer`）会引入不必要的对象创建和垃圾回收开销，从而影响性能。

**解决方案：**
如果 `quick` 函数的配置在多次调用中保持不变，可以考虑以下优化：

1.  **提供一个工厂函数或单例模式：** 允许用户获取一个预先配置好的 `BinaryQuantizationFormat` 实例，并在多次调用中重用它。

    ```typescript
    // 在 index.ts 中
    let defaultFormatInstance: BinaryQuantizationFormat | null = null;

    export function getOrCreateDefaultBinaryQuantizationFormat(config = DEFAULT_CONFIG): BinaryQuantizationFormat {
      // 简单的单例模式，如果配置不变，则重用实例
      if (!defaultFormatInstance || JSON.stringify(defaultFormatInstance.getConfig()) !== JSON.stringify(config)) {
        defaultFormatInstance = new BinaryQuantizationFormat(config);
      }
      return defaultFormatInstance;
    }

    export function quickQuantize(
      vectors: Float32Array[],
      similarityFunction: VectorSimilarityFunction = VectorSimilarityFunction.COSINE
    ) {
      const config = {
        quantizer: {
          similarityFunction,
          lambda: 0.1,
          iters: 5
        }
      };
      const format = getOrCreateDefaultBinaryQuantizationFormat(config); // 重用实例
      
      return format.quantizeVectors(vectors);
    }
    // quickSearch 和 computeAccuracy 类似修改
    ```
    这种方法允许在配置不变的情况下重用实例，从而减少对象创建开销。需要注意的是，`JSON.stringify` 比较配置可能在某些情况下效率不高，更严谨的比较需要逐属性比较。

2.  **明确文档说明：** 在 `quick` 函数的 JSDoc 中明确说明它们每次调用都会创建新实例，并建议在性能敏感的循环中直接使用 `BinaryQuantizationFormat` 实例，或者在外部管理实例的生命周期。

3.  **提供一个接受 `BinaryQuantizationFormat` 实例的重载：** 为 `quick` 函数提供一个重载，允许用户传入一个已经创建好的 `BinaryQuantizationFormat` 实例。

    ```typescript
    export function quickQuantize(
      vectors: Float32Array[],
      similarityFunction: VectorSimilarityFunction = VectorSimilarityFunction.COSINE
    ): ReturnType<BinaryQuantizationFormat['quantizeVectors']>;
    export function quickQuantize(
      vectors: Float32Array[],
      formatInstance: BinaryQuantizationFormat
    ): ReturnType<BinaryQuantizationFormat['quantizeVectors']>;
    export function quickQuantize(
      vectors: Float32Array[],
      arg2: VectorSimilarityFunction | BinaryQuantizationFormat = VectorSimilarityFunction.COSINE
    ) {
      let format: BinaryQuantizationFormat;
      if (arg2 instanceof BinaryQuantizationFormat) {
        format = arg2;
      } else {
        format = new BinaryQuantizationFormat({
          quantizer: {
            similarityFunction: arg2,
            lambda: 0.1,
            iters: 5
          }
        });
      }
      return format.quantizeVectors(vectors);
    }
    ```
    这种方法提供了更大的灵活性，允许用户根据自己的需求选择是否重用实例。