## 问题名：`quantize_vectors_frequent_array_creation.review.md`

**详细描述：**
在 `src/binaryQuantizationFormat.ts` 文件的 `quantizeVectors` 方法的循环内部，每次迭代都会创建新的 `Float32Array` 和 `Uint8Array` 实例：
```typescript
    for (const vector of processedVectors) {
      // 创建一个副本，因为 scalarQuantize 会修改传入的向量
      const vectorCopy = new Float32Array(vector);
      // 量化索引向量
      const quantizedVector = new Uint8Array(dimension);
      const correction = this.quantizer.scalarQuantize(
        vectorCopy,
        quantizedVector,
        this.config.indexBits!,
        centroid
      );

      // ...

      // 保存未打包的1位向量（用于4位查询）
      unpackedVectors.push(new Uint8Array(quantizedVector));
    }
```
对于大规模向量集合，这种在循环内部频繁创建 `TypedArray` 实例会导致大量的内存分配和垃圾回收开销，从而影响性能。

**解决方案：**
考虑重用 `TypedArray` 实例，或者在循环外部预分配内存。

1.  **预分配 `quantizedVector` 和 `unpackedVectors`：**
    `quantizedVector` 和 `unpackedVectors` 的大小在循环开始前就可以确定。可以在循环外部预先创建好这些数组，然后在循环内部填充数据，而不是每次都创建新的数组。

    ```typescript
    // 在循环外部预分配
    // 注意：这里假设所有向量维度相同，且quantizedVector和unpackedVectors的维度与原始向量相同
    // 实际实现可能需要更复杂的逻辑来处理不同维度或打包后的存储
    const allQuantizedVectors = new Uint8Array(processedVectors.length * dimension);
    const allUnpackedVectors = new Uint8Array(processedVectors.length * dimension);

    for (let i = 0; i < processedVectors.length; i++) {
      const vector = processedVectors[i];
      const vectorCopy = new Float32Array(vector); // 这个可能还是需要，因为 scalarQuantize 会修改传入的向量

      // 获取当前向量在预分配数组中的起始偏移量
      const offset = i * dimension;
      const currentQuantizedVector = allQuantizedVectors.subarray(offset, offset + dimension);
      const currentUnpackedVector = allUnpackedVectors.subarray(offset, offset + dimension);

      const correction = this.quantizer.scalarQuantize(
        vectorCopy,
        currentQuantizedVector, // 传入预分配的数组切片
        this.config.indexBits!,
        centroid
      );

      // 根据量化位数选择正确的处理方法
      if (this.config.indexBits === 1) {
        // 1位索引量化：使用二进制打包
        // 这里需要将 currentQuantizedVector 打包到另一个预分配的数组中，或者修改 BinarizedByteVectorValuesImpl 的存储方式
        // unpackedVectors.push(new Uint8Array(currentQuantizedVector)); // 同样，这里也需要优化
      } else {
        // 其他位数：直接使用量化结果
        // unpackedVectors.push(new Uint8Array(currentQuantizedVector)); // 同样，这里也需要优化
      }

      // quantizedVectors.push(processedVector); // 需要修改 BinarizedByteVectorValuesImpl 的构造函数
      // corrections.push(correction);
    }
    ```
    这种方法需要更复杂的索引管理，并且 `BinarizedByteVectorValuesImpl` 的构造函数可能需要调整以接受这种连续的 `TypedArray`。

2.  **修改 `scalarQuantize` 接口：**
    如果 `scalarQuantize` 可以接受一个可选的 `outputArray` 参数，并且在没有提供时才创建新的 `Uint8Array`，那么可以减少 `quantizedVector` 的创建。

3.  **优化 `vectorCopy`：**
    `vectorCopy = new Float32Array(vector)` 的创建是因为 `scalarQuantize` 会修改传入的向量。如果 `scalarQuantize` 可以设计为不修改输入向量，或者接受一个只读的输入向量，那么 `vectorCopy` 也可以避免。

考虑到 `scalarQuantize` 的行为，最直接的优化是预分配 `unpackedVectors` 和 `quantizedVectors` 的存储空间，并调整 `BinarizedByteVectorValuesImpl` 的构造函数来处理这些预分配的数组。