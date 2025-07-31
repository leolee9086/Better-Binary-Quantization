# Better Binary Quantization算法详解

## 1. 算法概述

Better Binary Quantization是一种基于优化标量量化的二值向量量化方法，它改进了传统向量量化技术，特别是LVQ（局部向量量化）和各向异性向量量化。算法核心包括以下几个关键步骤：

1. 质心中心化：将向量集中的每个向量相对于质心进行中心化处理
2. 优化标量量化：使用各向异性损失函数和坐标下降法优化量化间隔
3. 异步量化：查询向量使用4位量化，索引向量使用1位量化
4. 高效评分：通过位运算快速计算相似性分数

## 2. 代码调用关系图

```mermaid
graph TD
    A[Lucene102BinaryQuantizedVectorsWriter] --> B[OptimizedScalarQuantizer]
    A --> C[FieldWriter]
    A --> D[writeBinarizedVectors]
    A --> E[writeSortedBinarizedVectors]
    A --> F[writeBinarizedVectorAndQueryData]
    
    B --> G[scalarQuantize (OptimizedScalarQuantizer.java:187)]
    B --> H[multiScalarQuantize (OptimizedScalarQuantizer.java:119)]
    B --> I[optimizeIntervals (OptimizedScalarQuantizer.java:276)]
    B --> J[loss (OptimizedScalarQuantizer.java:249)]
    B --> K[packAsBinary (OptimizedScalarQuantizer.java:374)]
    B --> L[transposeHalfByte (OptimizedScalarQuantizer.java:341)]
    
    D --> M[scalarQuantize (OptimizedScalarQuantizer.java:187)]
    D --> N[packAsBinary (OptimizedScalarQuantizer.java:374)]
    
    E --> O[scalarQuantize (OptimizedScalarQuantizer.java:187)]
    E --> P[packAsBinary (OptimizedScalarQuantizer.java:374)]
    
    F --> Q[multiScalarQuantize (OptimizedScalarQuantizer.java:119)]
    F --> R[packAsBinary (OptimizedScalarQuantizer.java:374)]
    F --> S[transposeHalfByte (OptimizedScalarQuantizer.java:341)]
    
    G --> I
    H --> I
    I --> J
    
    C --> T[FieldInfo]
    C --> U[dimensionSums]
    
    style A fill:#f9f,stroke:#333
    style B fill:#bbf,stroke:#333
    style C fill:#bfb,stroke:#333
    style D fill:#fbb,stroke:#333
    style E fill:#fbb,stroke:#333
    style F fill:#fbb,stroke:#333
```

## 2. 核心数据结构

### QuantizationResult（量化结果）
```typescript
interface QuantizationResult {
  lowerInterval: number;     // 下界间隔
  upperInterval: number;     // 上界间隔
  additionalCorrection: number; // 额外修正因子
  quantizedComponentSum: number; // 量化分量之和
}
```

### BinarizedByteVectorValues（二值化向量值）
```typescript
interface BinarizedByteVectorValues {
  dimension(): number;                    // 向量维度
  size(): number;                         // 向量数量
  vectorValue(ord: number): Uint8Array;   // 获取指定序号的二值向量
  getCorrectiveTerms(ord: number): QuantizationResult; // 获取修正因子
  getCentroidDP(): number;                // 获取质心点积
  getCentroid(): Float32Array;            // 获取质心向量
}
```

## 3. 核心组件

### OptimizedScalarQuantizer（优化标量量化器）

这是算法的核心组件，实现了以下功能：

1. **多标量量化**：支持对同一向量进行不同位数的量化
2. **标量量化**：对单个向量进行标量量化
3. **初始化间隔计算**：基于最小均方误差网格计算初始量化区间
4. **间隔优化**：使用坐标下降法优化量化间隔，最小化量化损失
5. **半字节转置**：将4位量化的查询向量重新组织为SIMD友好的格式
6. **二进制打包**：将1位量化的向量打包为紧凑的二进制格式

#### 各向异性损失函数

损失函数计算公式：
```text
loss = (1 - λ) * xe² / norm2 + λ * e
```
其中：
- λ是权衡参数（默认为0.1）
- xe是平行于向量方向的误差分量
- e是总误差
- norm2是向量的平方范数

#### 坐标下降优化

通过计算二阶导数矩阵元素并求解线性方程组来找到最优量化间隔：
```text
daa = Σ(1-s)²
dab = Σ(1-s)s
dbb = Σs²
dax = Σxi(1-s)
dbx = Σxis
```

然后通过求解以下方程组得到最优间隔：
```text
m0 = scale * dax² + λ * daa
m1 = scale * dax * dbx + λ * dab
m2 = scale * dbx² + λ * dbb
det = m0 * m2 - m1²
a_opt = (m2 * dax - m1 * dbx) / det
b_opt = (m0 * dbx - m1 * dax) / det
```

### BinaryQuantizedScorer（二值量化评分器）

评分器负责计算量化向量的相似性分数：

1. **位运算点积计算**：使用SIMD友好的位运算计算查询向量和目标向量的点积
2. **相似性分数计算**：根据量化参数和修正因子计算最终的相似性分数
3. **批量评分**：支持批量计算多个目标向量的分数
4. **精度评估**：提供量化精度的统计信息

#### 相似性分数计算

根据不同相似性函数类型，分数计算公式如下：

**欧氏距离**：
```text
score = queryCorrections.additionalCorrection + 
        indexCorrections.additionalCorrection - 
        2 * (ax * ay * dimension + ay * lx * x1 + ax * ly * y1 + lx * ly * qcDist)
final_score = max(1 / (1 + score), 0)
```

**余弦相似度**：
```text
score = ax * ay * dimension + ay * lx * x1 + ax * ly * y1 + lx * ly * qcDist + 
        queryCorrections.additionalCorrection + indexCorrections.additionalCorrection - centroidDP
final_score = max((1 + score) / 2, 0)
```

## 4. 算法流程

### 向量量化流程

1. **计算质心**：对向量集中的所有向量计算质心
2. **质心中心化**：将每个向量相对于质心进行中心化处理
3. **计算统计信息**：计算均值、标准差、平方范数等统计信息
4. **初始化间隔**：基于最小均方误差网格计算初始量化区间
5. **优化间隔**：使用坐标下降法优化量化间隔
6. **量化向量**：将向量量化到指定的位数，并计算量化分量之和

### 查询向量量化流程

1. **质心中心化**：将查询向量相对于质心进行中心化处理
2. **计算统计信息**：计算均值、标准差、平方范数等统计信息
3. **初始化间隔**：基于最小均方误差网格计算初始量化区间
4. **优化间隔**：使用坐标下降法优化量化间隔
5. **量化向量**：将查询向量量化到4位
6. **半字节转置**：将4位量化的查询向量重新组织为SIMD友好的格式

### 相似性评分流程

1. **获取二进制编码**：获取目标向量的二进制编码
2. **位运算点积计算**：使用SIMD友好的位运算计算查询向量和目标向量的点积
3. **获取修正因子**：获取目标向量的修正因子
4. **计算量化参数**：从修正因子中提取量化参数
5. **计算相似性分数**：根据量化参数和相似性函数类型计算最终的相似性分数

## 5. 算法特点与优势

1. **高效性**：使用1位量化索引向量和4位量化查询向量，在保证精度的同时大幅减少存储空间
2. **准确性**：通过优化标量量化和各向异性损失函数，提高量化精度
3. **异步量化**：查询向量和索引向量采用不同位数的量化，充分利用各自的特性
4. **SIMD友好**：通过位分解和半字节转置，使算法更适合SIMD并行计算
5. **可扩展性**：模块化设计，便于扩展和优化

## 6. 与其他量化方法的比较

与传统的LVQ方法相比，Better Binary Quantization算法具有以下优势：

1. **优化间隔**：不再使用简单的min/max值，而是通过优化算法找到最优量化间隔
2. **各向异性损失**：考虑向量方向的量化误差，而不仅仅是总误差
3. **异步量化**：查询向量和索引向量使用不同的量化位数，更好地平衡精度和效率

与常规二值量化相比，该算法具有以下优势：

1. **保留更多信息**：查询向量使用4位量化，保留更多原始向量的信息
2. **修正因子**：通过修正因子来补偿量化损失，提高精度
3. **理论基础**：基于严格的数学推导和优化理论

## 7. 实际应用

在Lucene中，该算法被用于向量搜索的索引和查询阶段：

1. **索引阶段**：将向量集中的每个向量进行1位量化并存储
2. **查询阶段**：将查询向量进行4位量化，并与索引向量进行快速相似性计算
3. **评分阶段**：根据量化参数和修正因子计算最终的相似性分数

## 8. 算法局限性

1. **参数依赖**：算法效果依赖于λ参数的选择，需要根据具体应用场景进行调整
2. **计算复杂度**：优化间隔的坐标下降算法需要多次迭代，增加计算开销
3. **内存消耗**：需要存储质心和修正因子等额外信息，增加内存消耗