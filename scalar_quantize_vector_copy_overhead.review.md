## 问题名：`scalar_quantize_vector_copy_overhead.review.md`

**详细描述：**
在 `src/optimizedScalarQuantizer.ts` 文件的 `scalarQuantize` 方法中，代码在开始时创建了输入向量的一个副本：
```typescript
    const workingVector = new Float32Array(vector);
```
这个副本是必需的，因为 `workingVector` 在后续的质心中心化步骤中会被就地修改 (`workingVector[i] = centeredVal;`)。虽然这保护了原始输入向量不被修改，但对于每次调用 `scalarQuantize` 都会引入内存分配和数据复制的开销。对于处理高维向量或需要频繁量化的应用来说，这种开销可能会变得非常显著。

**解决方案：**
提供一个选项，允许在原始向量上进行就地操作，或者提供一个预分配的 `workingVector` 来减少内存分配。

1.  **引入 `inPlace` 参数：** 在 `scalarQuantize` 方法中添加一个布尔类型的 `inPlace` 参数。如果 `inPlace` 为 `true`，则直接修改原始 `vector`。如果为 `false`（默认值），则保持当前创建副本的行为。这使得调用方可以根据需求控制内存使用和性能。

    ```typescript
    public scalarQuantize(
      vector: Float32Array,
      destination: Uint8Array,
      bits: number,
      centroid: Float32Array,
      inPlace: boolean = false // 新增参数
    ): QuantizationResult {
      const workingVector = inPlace ? vector : new Float32Array(vector);
      // ... 方法的其余部分 ...
      // 确保所有修改都作用在 workingVector 上
    }
    ```
    需要注意的是，当 `inPlace` 为 `true` 时，必须清晰地文档说明对原始 `vector` 的副作用。

2.  **允许预分配 `workingVector`：** 修改方法签名，使其可以接受一个可选的 `workingVector` 参数。如果提供了该参数，则使用它；否则，创建一个新的副本（如果 `inPlace` 为 `false`）。这允许调用方重用内存。

    ```typescript
    public scalarQuantize(
      vector: Float32Array,
      destination: Uint8Array,
      bits: number,
      centroid: Float32Array,
      workingVector?: Float32Array // 新增参数
    ): QuantizationResult {
      const actualWorkingVector = workingVector || new Float32Array(vector);
      // ... 方法的其余部分 ...
      // 确保所有修改都作用在 actualWorkingVector 上
    }
    ```
    这种方法通常更安全，因为它不会修改原始输入，除非原始输入被显式地作为 `workingVector` 传入。

考虑到实现简易性和直接控制，第一种方案（`inPlace`）更为直接。