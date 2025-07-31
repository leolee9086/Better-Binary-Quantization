## 问题名：`compute_int4bit_dot_product_optimized_bitcount_overhead.review.md`

**详细描述：**
在 `src/bitwiseDotProduct.ts` 文件中，`computeInt4BitDotProductOptimized` 函数用于优化的4位-1位点积计算。它在循环中对 `bitwiseAnd` 的结果调用 `bitCount` 函数：
```typescript
export function computeInt4BitDotProductOptimized(q: Uint8Array, d: Uint8Array): number {
  // ...
  for (; r < upperBound; r += 4) {
    // 使用32位整数进行位运算
    const qInt = getBigEndianInt32(q, i * size + r);
    const dInt = getBigEndianInt32(d, r);
    const bitwiseAnd = qInt & dInt;
    subRet += bitCount(bitwiseAnd); // 每次循环都调用bitCount
  }
  
  // 处理剩余的部分
  for (; r < d.length; r++) {
    const qVal = q[i * size + r];
    const dVal = d[r];
    if (qVal !== undefined && dVal !== undefined) {
      const bitwiseAnd = (qVal & dVal) & 0xFF;
      subRet += bitCount(bitwiseAnd); // 每次循环都调用bitCount
    }
  }
  // ...
}
```
尽管 `computeInt4BitDotProductOptimized` 尝试通过 `getBigEndianInt32` 进行批量处理，但它仍然在每次迭代中调用 `bitCount`。如前所述，`bitCount` 的当前实现是逐位循环的，这会带来性能开销。

**解决方案：**
利用 `bit_count_performance.review.md` 中提出的 `bitCount` 优化方案，特别是使用 SWAR 算法来加速 32 位整数的位计数，以及使用查找表来加速字节的位计数。

```typescript
// 假设 bitCountOptimized 和 BIT_COUNT_LOOKUP_TABLE 已经在 utils.ts 中定义并导出
import { bitCountOptimized, BIT_COUNT_LOOKUP_TABLE } from './utils'; 

export function computeInt4BitDotProductOptimized(q: Uint8Array, d: Uint8Array): number {
  // ... (输入验证保持不变)

  let ret = 0;
  const size = d.length;
  
  // 分别计算4个位平面的点积 - 完全按照Lucene原始实现
  for (let i = 0; i < 4; i++) {
    let r = 0;
    let subRet = 0;
    
    // 处理整数边界对齐的部分
    const upperBound = d.length & -4; // Integer.BYTES = 4
    for (; r < upperBound; r += 4) {
      // 使用32位整数进行位运算
      const qInt = getBigEndianInt32(q, i * size + r);
      const dInt = getBigEndianInt32(d, r);
      const bitwiseAnd = qInt & dInt;
      subRet += bitCountOptimized(bitwiseAnd); // 使用优化的32位bitCount
    }
    
    // 处理剩余的部分
    for (; r < d.length; r++) {
      const qVal = q[i * size + r];
      const dVal = d[r];
      if (qVal !== undefined && dVal !== undefined) {
        const bitwiseAnd = (qVal & dVal) & 0xFF;
        subRet += BIT_COUNT_LOOKUP_TABLE[bitwiseAnd]; // 使用查找表进行字节位计数
      }
    }
    
    // 加权累加
    ret += subRet << i;
  }

  return ret;
}
```
通过使用优化的 `bitCountOptimized` 和 `BIT_COUNT_LOOKUP_TABLE`，可以显著提高 `computeInt4BitDotProductOptimized` 的性能。