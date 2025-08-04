# Lucene102BinaryQuantization算法详解

## 1. 算法概述

Lucene102BinaryQuantization是Lucene 10.2版本中实现的二值量化向量搜索算法，它基于优化的标量量化技术，实现了高效的向量压缩和相似性搜索。该算法的主要特点包括：

1. **异步量化策略**：查询向量使用4位量化，索引向量使用1位量化
2. **优化标量量化**：使用各向异性损失函数和坐标下降法优化量化间隔
3. **质心中心化**：将向量相对于质心进行中心化处理，提高量化精度
4. **SIMD友好设计**：通过位分解和半字节转置，支持高效的SIMD并行计算
5. **内存优化**：支持堆外内存存储，减少GC压力

## 2. 系统架构与调用关系

```mermaid
graph TD
    A[Lucene102BinaryQuantizedVectorsFormat] --> B[Lucene102BinaryQuantizedVectorsWriter]
    A --> C[Lucene102BinaryQuantizedVectorsReader]
    
    B --> D[OptimizedScalarQuantizer<br/>lucene/core/src/java/org/apache/lucene/util/quantization/OptimizedScalarQuantizer.java]
    B --> E[Lucene102BinaryFlatVectorsScorer<br/>lucene/core/src/java/org/apache/lucene/codecs/lucene102/Lucene102BinaryFlatVectorsScorer.java]
    B --> F[OffHeapBinarizedVectorValues<br/>lucene/core/src/java/org/apache/lucene/codecs/lucene102/OffHeapBinarizedVectorValues.java]
    
    C --> G[OffHeapBinarizedVectorValues<br/>lucene/core/src/java/org/apache/lucene/codecs/lucene102/OffHeapBinarizedVectorValues.java]
    C --> H[Lucene102BinaryFlatVectorsScorer<br/>lucene/core/src/java/org/apache/lucene/codecs/lucene102/Lucene102BinaryFlatVectorsScorer.java]
    
    D --> I[multiScalarQuantize()<br/>line 119<br/>lucene/core/src/java/org/apache/lucene/util/quantization/OptimizedScalarQuantizer.java]
    D --> J[scalarQuantize()<br/>line 187<br/>lucene/core/src/java/org/apache/lucene/util/quantization/OptimizedScalarQuantizer.java]
    D --> K[optimizeIntervals()<br/>line 276<br/>lucene/core/src/java/org/apache/lucene/util/quantization/OptimizedScalarQuantizer.java]
    D --> L[transposeHalfByte()<br/>line 352<br/>lucene/core/src/java/org/apache/lucene/util/quantization/OptimizedScalarQuantizer.java]
    D --> M[packAsBinary()<br/>line 380<br/>lucene/core/src/java/org/apache/lucene/util/quantization/OptimizedScalarQuantizer.java]
    
    B --> N[writeBinarizedVectors()<br/>line 192<br/>lucene/core/src/java/org/apache/lucene/codecs/lucene102/Lucene102BinaryQuantizedVectorsWriter.java]
    B --> O[writeSortedBinarizedVectors()<br/>line 242<br/>lucene/core/src/java/org/apache/lucene/codecs/lucene102/Lucene102BinaryQuantizedVectorsWriter.java]
    B --> P[writeBinarizedVectorAndQueryData()<br/>line 354<br/>lucene/core/src/java/org/apache/lucene/codecs/lucene102/Lucene102BinaryQuantizedVectorsWriter.java]
    
    N --> Q[scalarQuantize()<br/>line 200<br/>lucene/core/src/java/org/apache/lucene/codecs/lucene102/Lucene102BinaryQuantizedVectorsWriter.java]
    N --> R[packAsBinary()<br/>line 202<br/>lucene/core/src/java/org/apache/lucene/codecs/lucene102/Lucene102BinaryQuantizedVectorsWriter.java]
    
    P --> S[multiScalarQuantize()<br/>line 370<br/>lucene/core/src/java/org/apache/lucene/codecs/lucene102/Lucene102BinaryQuantizedVectorsWriter.java]
    P --> T[packAsBinary()<br/>line 375<br/>lucene/core/src/java/org/apache/lucene/codecs/lucene102/Lucene102BinaryQuantizedVectorsWriter.java]
    P --> U[transposeHalfByte()<br/>line 380<br/>lucene/core/src/java/org/apache/lucene/codecs/lucene102/Lucene102BinaryQuantizedVectorsWriter.java]
    
    G --> V[vectorValue()<br/>line 105<br/>lucene/core/src/java/org/apache/lucene/codecs/lucene102/OffHeapBinarizedVectorValues.java]
    G --> W[getCorrectiveTerms()<br/>line 117<br/>lucene/core/src/java/org/apache/lucene/codecs/lucene102/OffHeapBinarizedVectorValues.java]
    
    H --> X[getRandomVectorScorer()<br/>line 70<br/>lucene/core/src/java/org/apache/lucene/codecs/lucene102/Lucene102BinaryFlatVectorsScorer.java]
    H --> Y[BinarizedRandomVectorScorerSupplier<br/>line 110<br/>lucene/core/src/java/org/apache/lucene/codecs/lucene102/Lucene102BinaryFlatVectorsScorer.java]
    H --> Z[quantizedScore()<br/>line 155<br/>lucene/core/src/java/org/apache/lucene/codecs/lucene102/Lucene102BinaryFlatVectorsScorer.java]
    
    X --> AA[scalarQuantize()<br/>line 82<br/>lucene/core/src/java/org/apache/lucene/codecs/lucene102/Lucene102BinaryFlatVectorsScorer.java]
    X --> AB[transposeHalfByte()<br/>line 87<br/>lucene/core/src/java/org/apache/lucene/codecs/lucene102/Lucene102BinaryFlatVectorsScorer.java]
    
    Y --> AC[setScoringOrdinal()<br/>line 128<br/>lucene/core/src/java/org/apache/lucene/codecs/lucene102/Lucene102BinaryFlatVectorsScorer.java]
    Y --> AD[score()<br/>line 137<br/>lucene/core/src/java/org/apache/lucene/codecs/lucene102/Lucene102BinaryFlatVectorsScorer.java]
    
    Z --> AE[VectorUtil.int4BitDotProduct()<br/>line 162<br/>lucene/core/src/java/org/apache/lucene/codecs/lucene102/Lucene102BinaryFlatVectorsScorer.java]
    Z --> AF[getCorrectiveTerms()<br/>line 164<br/>lucene/core/src/java/org/apache/lucene/codecs/lucene102/Lucene102BinaryFlatVectorsScorer.java]
    
    style A fill:#f9f,stroke:#333
    style B fill:#bbf,stroke:#333
    style C fill:#bfb,stroke:#333
    style D fill:#fbb,stroke:#333
    style E fill:#ffb,stroke:#333
    style F fill:#bff,stroke:#333
```

## 3. 核心组件详解

### 3.1 Lucene102BinaryQuantizedVectorsFormat

**位置**: `lucene/core/src/java/org/apache/lucene/codecs/lucene102/Lucene102BinaryQuantizedVectorsFormat.java`

这是二值量化向量格式的主要入口类，负责：
- 创建Writer和Reader实例
- 定义文件扩展名和格式常量
- 管理向量数据的存储格式

**关键常量**:
```java
public static final String META_EXTENSION = "bqv";
public static final String VECTOR_DATA_EXTENSION = "bqv";
public static final byte INDEX_BITS = 1;  // 索引向量使用1位量化
public static final byte QUERY_BITS = 4;  // 查询向量使用4位量化
```

### 3.2 Lucene102BinaryQuantizedVectorsWriter

**位置**: `lucene/core/src/java/org/apache/lucene/codecs/lucene102/Lucene102BinaryQuantizedVectorsWriter.java`

负责向量数据的写入和量化，主要方法包括：

#### writeBinarizedVectors() (第192行)
```java
private void writeBinarizedVectors(
    FieldWriter fieldData, 
    float[] clusterCenter, 
    OptimizedScalarQuantizer scalarQuantizer) throws IOException {
    // 1. 对每个向量进行1位量化
    // 2. 使用packAsBinary()打包为二进制格式
    // 3. 写入量化参数和修正因子
}
```

#### writeBinarizedVectorAndQueryData() (第354行)
```java
static DocsWithFieldSet writeBinarizedVectorAndQueryData(
    IndexOutput binarizedVectorData,
    IndexOutput binarizedQueryData,
    FloatVectorValues floatVectorValues,
    float[] centroid,
    OptimizedScalarQuantizer binaryQuantizer) throws IOException {
    // 1. 使用multiScalarQuantize()同时进行1位和4位量化
    // 2. 索引向量使用packAsBinary()打包
    // 3. 查询向量使用transposeHalfByte()转置
}
```

### 3.3 OptimizedScalarQuantizer

**位置**: `lucene/core/src/java/org/apache/lucene/util/quantization/OptimizedScalarQuantizer.java`

这是算法的核心组件，实现了优化的标量量化：

#### multiScalarQuantize() (第119行)
```java
public QuantizationResult[] multiScalarQuantize(
    float[] vector, 
    byte[][] destinations, 
    byte[] bits, 
    float[] centroid) {
    // 1. 质心中心化
    // 2. 计算统计信息（均值、标准差、范数）
    // 3. 对每个位数分别进行量化
    // 4. 使用optimizeIntervals()优化量化间隔
}
```

#### scalarQuantize() (第187行)
```java
public QuantizationResult scalarQuantize(
    float[] vector, 
    byte[] destination, 
    byte bits, 
    float[] centroid) {
    // 1. 质心中心化
    // 2. 计算统计信息
    // 3. 获取初始间隔
    // 4. 优化间隔
    // 5. 量化向量并计算量化分量之和
}
```

#### optimizeIntervals() (第276行)
```java
private void optimizeIntervals(float[] initInterval, float[] vector, float norm2, int points) {
    // 使用坐标下降法优化量化间隔
    // 计算各向异性损失函数的梯度
    // 通过线性方程组求解最优间隔
}
```

#### transposeHalfByte() (第352行)
```java
public static void transposeHalfByte(byte[] q, byte[] quantQueryByte) {
    // 将4位量化的查询向量重新组织为SIMD友好的格式
    // 按位分解，便于位运算计算
}
```

#### packAsBinary() (第380行)
```java
public static void packAsBinary(byte[] vector, byte[] packed) {
    // 将1位量化的向量打包为紧凑的二进制格式
    // 每8个1位值打包为1个字节
}
```

### 3.4 Lucene102BinaryFlatVectorsScorer

**位置**: `lucene/core/src/java/org/apache/lucene/codecs/lucene102/Lucene102BinaryFlatVectorsScorer.java`

负责量化向量的相似性计算和评分：

#### getRandomVectorScorer() (第70行)
```java
public RandomVectorScorerSupplier getRandomVectorScorer(float[] target) throws IOException {
    // 1. 量化查询向量
    // 2. 转置为SIMD友好格式
    // 3. 创建评分器
}
```

#### quantizedScore() (第155行)
```java
public float quantizedScore(byte[] queryVector, int targetOrd) throws IOException {
    // 1. 使用VectorUtil.int4BitDotProduct()计算位运算点积
    // 2. 获取修正因子
    // 3. 根据相似性函数计算最终分数
}
```

### 3.5 OffHeapBinarizedVectorValues

**位置**: `lucene/core/src/java/org/apache/lucene/codecs/lucene102/OffHeapBinarizedVectorValues.java`

提供堆外内存存储的量化向量值：

#### vectorValue() (第105行)
```java
public byte[] vectorValue(int targetOrd) throws IOException {
    // 从堆外内存读取量化向量值
}
```

#### getCorrectiveTerms() (第117行)
```java
public OptimizedScalarQuantizer.QuantizationResult getCorrectiveTerms(int targetOrd) throws IOException {
    // 获取量化修正因子
}
```

## 4. 算法流程详解

### 4.1 索引构建流程

1. **初始化阶段**
   - 创建Lucene102BinaryQuantizedVectorsWriter
   - 初始化OptimizedScalarQuantizer
   - 创建输出文件

2. **字段处理**
   - 为每个向量字段创建FieldWriter
   - 收集所有向量数据
   - 计算质心

3. **向量量化**
   - 调用writeBinarizedVectors()或writeBinarizedVectorAndQueryData()
   - 使用OptimizedScalarQuantizer进行量化
   - 应用质心中心化
   - 优化量化间隔
   - 打包为二进制格式

4. **数据写入**
   - 写入量化向量数据
   - 写入量化参数和修正因子
   - 写入元数据

### 4.2 查询处理流程

1. **查询向量量化**
   - 使用OptimizedScalarQuantizer.scalarQuantize()进行4位量化
   - 应用transposeHalfByte()转置为SIMD友好格式
   - 计算查询向量的修正因子

2. **相似性计算**
   - 使用VectorUtil.int4BitDotProduct()计算位运算点积
   - 获取目标向量的修正因子
   - 根据相似性函数计算最终分数

3. **结果排序**
   - 对所有目标向量计算分数
   - 按分数排序返回Top-K结果

### 4.3 量化算法详解

#### 4.3.1 质心中心化
```java
// 对向量v相对于质心c进行中心化
for (int i = 0; i < vector.length; ++i) {
    vector[i] = vector[i] - centroid[i];
}
```

#### 4.3.2 各向异性损失函数
```java
// 损失函数：L = (1-λ) * xe²/norm2 + λ * e
// 其中：xe是平行于向量方向的误差分量，e是总误差
private double loss(float[] vector, float[] interval, int points, float norm2) {
    double xe = 0, e = 0;
    for (float xi : vector) {
        float quantized = quantize(xi, interval, points);
        float error = xi - quantized;
        xe += error * error;  // 平行误差
        e += error * error;   // 总误差
    }
    return (1 - lambda) * xe / norm2 + lambda * e;
}
```

#### 4.3.3 坐标下降优化
```java
// 通过求解线性方程组优化量化间隔
double m0 = scale * dax * dax + lambda * daa;
double m1 = scale * dax * dbx + lambda * dab;
double m2 = scale * dbx * dbx + lambda * dbb;
double det = m0 * m2 - m1 * m1;
float aOpt = (float) ((m2 * dax - m1 * dbx) / det);
float bOpt = (float) ((m0 * dbx - m1 * dax) / det);
```

#### 4.3.4 半字节转置
```java
// 将4位量化的查询向量重新组织为SIMD友好格式
// 按位分解，便于位运算计算
for (int i = 0; i < q.length; ) {
    for (int j = 7; j >= 0 && i < q.length; j--) {
        lowerByte |= (q[i] & 1) << j;
        lowerMiddleByte |= ((q[i] >> 1) & 1) << j;
        upperMiddleByte |= ((q[i] >> 2) & 1) << j;
        upperByte |= ((q[i] >> 3) & 1) << j;
        i++;
    }
}
```

## 5. 数据结构

### 5.1 QuantizationResult
```java
public record QuantizationResult(
    float lowerInterval,      // 下界间隔
    float upperInterval,      // 上界间隔
    float additionalCorrection, // 附加修正因子
    int quantizedComponentSum   // 量化分量之和
) {}
```

### 5.2 BinarizedByteVectorValues
```java
public interface BinarizedByteVectorValues {
    int dimension();  // 向量维度
    int size();      // 向量数量
    byte[] vectorValue(int ord);  // 获取量化向量值
    OptimizedScalarQuantizer.QuantizationResult getCorrectiveTerms(int ord);  // 获取修正因子
    float[] getCentroid();  // 获取质心
}
```

## 6. 性能优化特性

### 6.1 内存优化
- **堆外内存存储**：使用OffHeapBinarizedVectorValues减少GC压力
- **内存映射**：支持内存映射文件访问
- **紧凑存储**：1位量化向量每8个值打包为1个字节

### 6.2 计算优化
- **SIMD友好设计**：通过位分解支持向量化计算
- **位运算优化**：使用位运算计算点积，避免浮点运算
- **缓存友好**：数据布局优化，提高缓存命中率

### 6.3 算法优化
- **异步量化**：查询和索引使用不同位数，平衡精度和效率
- **优化间隔**：通过坐标下降法找到最优量化间隔
- **各向异性损失**：考虑向量方向的量化误差

## 7. 配置参数

### 7.1 量化参数
- **INDEX_BITS = 1**：索引向量量化位数
- **QUERY_BITS = 4**：查询向量量化位数
- **DEFAULT_LAMBDA = 0.1f**：各向异性权重
- **DEFAULT_ITERS = 5**：优化迭代次数

### 7.2 文件格式
- **META_EXTENSION = "bqv"**：元数据文件扩展名
- **VECTOR_DATA_EXTENSION = "bqv"**：向量数据文件扩展名

