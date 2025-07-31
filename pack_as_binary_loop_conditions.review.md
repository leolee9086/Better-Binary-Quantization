## 问题名：`pack_as_binary_loop_conditions.review.md`

**详细描述：**
在 `src/optimizedScalarQuantizer.ts` 文件的 `packAsBinary` 方法中，用于打包二进制值的内部循环条件为 `j >= 0 && i < vector.length`：
```typescript
  public static packAsBinary(vector: Uint8Array, packed: Uint8Array): void {
    for (let i = 0; i < vector.length; ) {
      let result = 0;
      
      // 每8位打包为一个字节
      for (let j = 7; j >= 0 && i < vector.length; j--) { // 这里的条件
        const vectorVal = vector[i];
        if (vectorVal !== undefined) {
          // 确保1位量化值为0或1
          if (vectorVal !== 0 && vectorVal !== 1) {
            throw new Error('1位量化值必须为0或1');
          }
          // 打包位
          result |= (vectorVal & 1) << j;
        }
        i++;
      }
      // ...
    }
  }
```
虽然这种写法是正确的，但在每次内部循环迭代中都检查 `i < vector.length` 可能会带来微小的性能开销。对于位操作这种对性能要求极高的场景，即使是微小的优化也值得考虑。

**解决方案：**
将内部循环的迭代次数固定为 8 次，并在循环外部处理 `vector.length` 的边界情况。

```typescript
  public static packAsBinary(vector: Uint8Array, packed: Uint8Array): void {
    const vectorLength = vector.length;
    let packedIndex = 0;

    for (let i = 0; i < vectorLength; ) {
      let result = 0;
      
      // 每8位打包为一个字节
      // 内部循环固定为8次，处理一个字节的8位
      for (let j = 7; j >= 0; j--) {
        if (i < vectorLength) { // 只在这里检查一次边界
          const vectorVal = vector[i];
          // 确保1位量化值为0或1
          if (vectorVal !== 0 && vectorVal !== 1) {
            throw new Error('1位量化值必须为0或1');
          }
          // 打包位
          result |= (vectorVal & 1) << j;
          i++;
        } else {
          // 如果vector.length不是8的倍数，剩余位填充0
          break; 
        }
      }
      
      packed[packedIndex++] = result;
    }
  }
```
这种修改可以减少内部循环的条件判断次数，从而在理论上提高一点性能。同时，也更清晰地表达了“每8位打包为一个字节”的意图。