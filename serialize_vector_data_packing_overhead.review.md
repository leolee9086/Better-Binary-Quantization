## 问题名：`serialize_vector_data_packing_overhead.review.md`

**详细描述：**
在 `src/binaryQuantizationFormat.ts` 文件的 `serializeVectorData` 方法中，每个向量都会被单独打包：
```typescript
    for (let i = 0; i < vectorCount; i++) {
      const binaryValues = quantizedVectors.vectorValue(i);

      // 打包二进制值
      const packedBinaryValues = new Uint8Array(Math.ceil(binaryValues.length / 8));
      OptimizedScalarQuantizer.packAsBinary(binaryValues, packedBinaryValues);

      vectorData.push({
        binaryValues: packedBinaryValues,
        // ...
      });
    }
```
这种逐个向量打包的方式，在高并发或大数据量场景下，会因为频繁的 `Uint8Array` 创建和函数调用而产生额外的开销。

**解决方案：**
考虑批量打包或优化打包过程。

1.  **批量打包：** 如果可能，将所有 `binaryValues` 拼接成一个大的 `Uint8Array`，然后一次性进行打包。这需要 `OptimizedScalarQuantizer.packAsBinary` 支持批量处理，或者需要重新设计打包逻辑。

2.  **预分配打包后的数组：** 可以在循环外部预先计算所有打包后数据所需的总大小，然后一次性分配一个大的 `Uint8Array`，并在循环中将每个向量的打包结果写入到这个大数组的相应偏移量处。

    ```typescript
    // 假设所有向量维度相同
    const dimension = quantizedVectors.dimension();
    const packedVectorSize = Math.ceil(dimension / 8);
    const totalPackedSize = vectorCount * packedVectorSize;
    const allPackedBinaryValues = new Uint8Array(totalPackedSize);

    for (let i = 0; i < vectorCount; i++) {
      const binaryValues = quantizedVectors.vectorValue(i);
      const offset = i * packedVectorSize;
      const currentPackedBinaryValues = allPackedBinaryValues.subarray(offset, offset + packedVectorSize);

      OptimizedScalarQuantizer.packAsBinary(binaryValues, currentPackedBinaryValues);

      // vectorData.push({ binaryValues: currentPackedBinaryValues, ... }); // 这里需要调整，因为 currentPackedBinaryValues 是一个视图
      // 更好的做法是存储偏移量和长度，或者在最后统一处理
    }
    // 最终 vectorData 可以存储对 allPackedBinaryValues 的引用和偏移量
    ```
    这种方法可以显著减少内存分配和垃圾回收的开销。

3.  **优化 `packAsBinary` 内部实现：** 确保 `OptimizedScalarQuantizer.packAsBinary` 内部实现已经高度优化，例如使用位运算而不是循环。

对于当前代码结构，预分配打包后的数组并批量写入是一个可行的优化方向。