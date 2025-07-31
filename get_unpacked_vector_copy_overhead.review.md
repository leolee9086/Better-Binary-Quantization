## 问题名：`get_unpacked_vector_copy_overhead.review.md`

**详细描述：**
在 `src/binaryQuantizationFormat.ts` 文件的 `BinarizedByteVectorValuesImpl` 类中，`getUnpackedVector` 方法在返回未打包向量时，无论是否需要，都会创建一个新的 `Uint8Array` 副本：`const vectorCopy = new Uint8Array(vector);`。

在高频调用且数据量大的场景下，频繁的数组复制会带来显著的内存分配和CPU开销，并增加垃圾回收的压力。如果调用方不需要修改返回的向量，这种无条件的复制会造成不必要的性能损耗。

**解决方案：**
引入一个可选的 `copy` 参数，允许调用方选择是否需要返回一个副本。默认值为 `true`，以保持现有行为。

```typescript
  getUnpackedVector(ord: number, copy: boolean = true): Uint8Array {
    // 检查缓存
    const cached = this.unpackedVectorCache.get(ord);
    if (cached) {
      return copy ? new Uint8Array(cached) : cached; // 如果需要副本，则复制缓存中的数据
    }

    // 获取原始向量
    const vector = this.unpackedVectors[ord];
    if (!vector) {
      throw new Error(`未打包向量索引 ${ord} 不存在`);
    }

    // 添加到缓存
    this.unpackedVectorCache.set(ord, vector); // 缓存原始向量

    // 如果缓存太大，移除最早的条目
    if (this.unpackedVectorCache.size > this.maxCacheSize) {
      const firstKey = this.unpackedVectorCache.keys().next().value;
      if (firstKey !== undefined) {
        this.unpackedVectorCache.delete(firstKey);
      }
    }

    return copy ? new Uint8Array(vector) : vector; // 如果需要副本，则复制原始数据
  }
```