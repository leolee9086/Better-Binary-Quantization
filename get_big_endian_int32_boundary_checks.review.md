## 问题名：`get_big_endian_int32_boundary_checks.review.md`

**详细描述：**
在 `src/bitwiseDotProduct.ts` 文件中，`getBigEndianInt32` 函数用于从 `Uint8Array` 中读取 32 位整数。它在每次调用时都进行边界检查：
```typescript
function getBigEndianInt32(array: Uint8Array, offset: number): number {
  if (offset + 3 >= array.length) { // 边界检查
    throw new Error('数组越界');
  }
  
  // ...
  
  if (val0 === undefined || val1 === undefined || val2 === undefined || val3 === undefined) { // 再次检查
    throw new Error('数组访问越界');
  }
  
  // ...
}
```
虽然这些检查对于确保内存安全至关重要，但在像 `computeInt4BitDotProductOptimized` 这样的紧密循环中频繁调用时，每次迭代都执行这些检查会带来额外的开销。在循环外部已经确保了 `offset` 在有效范围内的情况下，内部的重复检查是不必要的。

**解决方案：**
在调用 `getBigEndianInt32` 的外部循环中确保偏移量是安全的，从而在 `getBigEndianInt32` 内部可以移除重复的边界检查。

```typescript
// 在 getBigEndianInt32 函数内部：
function getBigEndianInt32(array: Uint8Array, offset: number): number {
  // 移除边界检查，假设调用方已经确保了安全偏移量
  const val0 = array[offset];
  const val1 = array[offset + 1];
  const val2 = array[offset + 2];
  const val3 = array[offset + 3];
  
  // 仍然保留 undefined 检查，以防万一，或者在调用方确保不会出现 undefined
  if (val0 === undefined || val1 === undefined || val2 === undefined || val3 === undefined) {
    // 这通常不应该发生，如果外部循环逻辑正确
    throw new Error('内部错误：数组访问越界'); 
  }
  
  return ((val0 & 0xFF) << 24) |
         ((val1 & 0xFF) << 16) |
         ((val2 & 0xFF) << 8) |
         (val3 & 0xFF);
}

// 在 computeInt4BitDotProductOptimized 中：
export function computeInt4BitDotProductOptimized(q: Uint8Array, d: Uint8Array): number {
  // ...
  const upperBound = d.length & -4; // 确保 upperBound 是 4 的倍数，且不会越界
  for (; r < upperBound; r += 4) {
    // 在这里确保 r + 3 < d.length 和 i * size + r + 3 < q.length
    // 这样 getBigEndianInt32 内部就不需要重复检查了
    const qInt = getBigEndianInt32(q, i * size + r);
    const dInt = getBigEndianInt32(d, r);
    const bitwiseAnd = qInt & dInt;
    subRet += bitCountOptimized(bitwiseAnd);
  }
  // ...
}
```
通过将边界检查上移到调用方，可以减少 `getBigEndianInt32` 的每次调用开销。这在性能敏感的循环中尤其重要。