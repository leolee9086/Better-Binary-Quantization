## 问题名：`int4bit_dot_product_inefficient_loop.review.md`

**详细描述：**
在 `src/bitwiseDotProduct.ts` 文件中，`computeInt4BitDotProduct` 函数用于计算4位查询向量与1位索引向量的点积。其中包含一个三层嵌套循环：
```typescript
export function computeInt4BitDotProduct(q: Uint8Array, d: Uint8Array): number {
  // ...
  for (let i = 0; i < 4; i++) { // 外层循环，处理4个位平面
    let subRet = 0;
    for (let j = 0; j < planeSize; j++) { // 中间循环，处理每个位平面中的字节
      const qVal = q[i * planeSize + j];
      if (qVal !== undefined) {
        for (let k = 0; k < 8 && j * 8 + k < d.length; k++) { // 最内层循环，逐位检查
          const dVal = d[j * 8 + k];
          if (dVal !== undefined) {
            // 效率低下：逐位检查并判断dVal
            if ((qVal & (1 << (7 - k))) && dVal) {
              subRet++;
            }
          }
        }
      }
    }
    ret += subRet << i;
  }
  return ret;
}
```
最内层循环逐位检查，并对 `dVal` 进行判断。这种逐位操作对于位运算来说效率非常低。现代CPU对字节级和字级操作进行了优化。在循环中进行逐位检查会显著增加操作次数和分支，导致性能下降，特别是对于高维向量。

**解决方案：**
将最内层循环替换为字节级的位与操作，然后对结果进行位计数。这利用了 `d` 是一个1位（二进制）向量的事实，意味着 `dVal` 只能是0或1。

```typescript
export function computeInt4BitDotProduct(q: Uint8Array, d: Uint8Array): number {
  // ... (输入验证保持不变)

  let ret = 0;
  const planeSize = Math.ceil(d.length / 8); // 每个位平面的大小

  // 遍历4个位平面
  for (let i = 0; i < 4; i++) {
    let subRet = 0;
    
    // 处理当前位平面中的每个字节
    for (let j = 0; j < planeSize; j++) {
      const qByte = q[i * planeSize + j]; // 获取查询向量当前位平面中的字节
      const dByte = d[j]; // 获取1位索引向量中对应的字节

      if (qByte !== undefined && dByte !== undefined) {
        // 对字节执行位与操作
        // 结果中只有当qByte和dByte中对应位都为1时，该位才会被设置。
        const bitwiseAndResult = qByte & dByte;
        
        // 对结果进行位计数（统计1的个数）
        // 这里假设bitCount函数已经过优化（例如，使用查找表或SWAR算法）
        subRet += bitCount(bitwiseAndResult);
      }
    }
    
    // 累加结果，并根据位平面进行加权
    ret += subRet << i;
  }
  return ret;
}
```
这种优化方法通过执行字节级的位与操作，然后使用高效的 `bitCount` 函数（应根据 `bit_count_performance.review.md` 中的建议进行优化），显著减少了操作次数。这将最内层循环转换为单个操作，从而大幅提升性能。