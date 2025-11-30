修复Rust WASM的RuntimeError: unreachable错误

## 问题原因

在`binary_quantized_scorer.rs`的`compute_batch_quantized_scores`函数中，
存在两处数组越界访问：

1. **第247行** (4位量化分支): `let index_corrections = &target_corrections[target_ords[i]];`
2. **第285行** (1位量化分支): `let index_corrections = &target_corrections[target_ords[i]];`

问题根源：`target_vectors`和`target_corrections`数组已经是按`batch_indices`筛选后的**子集**，
长度只有batch大小(如1000)，而`target_ords[i]`是全局索引，可能远大于batch大小。
例如处理第10个batch时，target_ords[0]可能是9000，但target_corrections只有1000个元素。

## 解决方案

将两处的`target_corrections[target_ords[i]]`改为`target_corrections[i]`，
使用本地索引`i`而不是全局索引`target_ords[i]`。

## 修改文件

- `rust-wasm/src/binary_quantized_scorer.rs` (第247行和第285行)

## 测试结果

✅ 10000个1536维向量的测试通过，搜索成功返回10个结果
✅ wasm-pack编译成功，无错误
