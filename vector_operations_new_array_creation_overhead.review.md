## 问题名：`vector_operations_new_array_creation_overhead.review.md`

**详细描述：**
在 `src/vectorOperations.ts` 文件中的多个向量操作函数（如 `normalizeVector`, `addVectors`, `subtractVectors`, `scaleVector`, `centerVector`）中，每次调用都会创建一个新的 `Float32Array` 来存储结果：
```typescript
export function normalizeVector(vector: Float32Array): Float32Array {
  // ...
  const normalized = new Float32Array(vector.length); // 每次都创建新数组
  for (let i = 0; i < vector.length; i++) {
    const v = vector[i];
    if (v !== undefined) {
      normalized[i] = v / norm;
    }
  }
  return normalized;
}

export function addVectors(a: Float32Array, b: Float32Array): Float32Array {
  // ...
  const result = new Float32Array(a.length); // 每次都创建新数组
  for (let i = 0; i < a.length; i++) {
    const av = a[i];
    const bv = b[i];
    if (av !== undefined && bv !== undefined) {
      result[i] = av + bv;
    }
  }
  return result;
}
// 类似的问题存在于 subtractVectors, scaleVector, centerVector
```
虽然返回新数组是函数式编程的常见模式，可以避免副作用，但对于频繁调用的向量操作，尤其是在处理大量高维向量时，每次操作都进行内存分配和数据复制会带来显著的性能开销和垃圾回收压力。

**解决方案：**
为这些函数提供一个可选的 `out` 参数，允许调用方传入一个预先分配好的 `Float32Array` 来存储结果。如果 `out` 参数未提供，则保持当前行为，创建一个新数组。

```typescript
/**
 * 向量归一化
 * @param vector 输入向量
 * @param out 可选：用于存储结果的 Float32Array
 * @returns 归一化后的向量（如果提供了out，则返回out；否则返回新创建的数组）
 */
export function normalizeVector(vector: Float32Array, out?: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < vector.length; i++) {
    const v = vector[i];
    if (v !== undefined) {
      norm += v * v;
    }
  }
  norm = Math.sqrt(norm);

  if (norm === 0) {
    const result = out || new Float32Array(vector.length);
    result.fill(0); // 确保归零
    return result;
  }

  const result = out || new Float32Array(vector.length);
  if (result.length !== vector.length) {
    throw new Error('输出数组维度不匹配');
  }

  for (let i = 0; i < vector.length; i++) {
    const v = vector[i];
    if (v !== undefined) {
      result[i] = v / norm;
    }
  }
  return result;
}

/**
 * 向量加法
 * @param a 向量a
 * @param b 向量b
 * @param out 可选：用于存储结果的 Float32Array
 * @returns 结果向量（如果提供了out，则返回out；否则返回新创建的数组）
 */
export function addVectors(a: Float32Array, b: Float32Array, out?: Float32Array): Float32Array {
  if (a.length !== b.length) {
    throw new Error('向量维度不匹配');
  }

  const result = out || new Float32Array(a.length);
  if (result.length !== a.length) {
    throw new Error('输出数组维度不匹配');
  }

  for (let i = 0; i < a.length; i++) {
    const av = a[i];
    const bv = b[i];
    if (av !== undefined && bv !== undefined) {
      result[i] = av + bv;
    }
  }
  return result;
}
// 类似地修改 subtractVectors, scaleVector, centerVector
```
这种修改允许调用方在性能关键的场景下重用内存，从而减少垃圾回收的压力和内存分配的开销。