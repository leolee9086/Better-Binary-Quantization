## 问题名：`compute_int1bit_dot_product_bitcount_overhead.review.md`

**详细描述：**
在 `src/bitwiseDotProduct.ts` 文件中，`computeInt1BitDotProduct` 函数用于计算单比特量化向量的点积。它在循环中对每个字节调用 `bitCount` 函数：
```typescript
export function computeInt1BitDotProduct(q: Uint8Array, d: Uint8Array): number {
  // ...
  for (let i = 0; i < q.length; i++) {
    const qVal = q[i];
    const dVal = d[i];
    if (qVal !== undefined && dVal !== undefined) {
      // 计算位运算AND，然后统计1的个数
      const bitwiseAnd = (qVal & dVal) & 0xFF;
      ret += bitCount(bitwiseAnd); // 每次循环都调用bitCount
    }
  }
  return ret;
}
```
`bitCount` 函数（定义在 `src/utils.ts` 中）的当前实现是逐位循环的，对于每个字节，它会执行多达 8 次迭代。当 `q` 和 `d` 向量的长度很大时，这种频繁的函数调用和内部循环会累积成显著的性能开销。

**解决方案：**
利用 `bit_count_performance.review.md` 中提出的 `bitCount` 优化方案，特别是使用查找表来加速字节的位计数。

```typescript
// 假设 BIT_COUNT_LOOKUP_TABLE 已经在 utils.ts 中定义并导出
import { bitCount, BIT_COUNT_LOOKUP_TABLE } from './utils'; // 导入查找表

export function computeInt1BitDotProduct(q: Uint8Array, d: Uint8Array): number {
  if (q.length !== d.length) {
    throw new Error('单比特向量长度必须相同');
  }

  let ret = 0;
  
  // 逐字节计算位运算点积
  for (let i = 0; i < q.length; i++) {
    const qVal = q[i];
    const dVal = d[i];
    if (qVal !== undefined && dVal !== undefined) {
      const bitwiseAnd = (qVal & dVal) & 0xFF;
      // 直接使用查找表，避免bitCount内部的循环
      ret += BIT_COUNT_LOOKUP_TABLE[bitwiseAnd]; 
    }
  }

  return ret;
}
```
通过直接查表，可以避免 `bitCount` 函数内部的循环，从而显著提高 `computeInt1BitDotProduct` 的性能。