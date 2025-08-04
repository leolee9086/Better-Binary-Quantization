
/*
 * Optimized 1-bit batch dot product (query unpacked, target packed)
 * @param queryVector unpacked query vector (one value per byte)
 * @param continuousBuffer continuous packed buffer of 1-bit target vectors
 * @param numVectors number of vectors
 * @param dimension vector dimension
 * @returns array of dot products
 */
export function computeBatchFourBitDotProductDirectPacked(
    queryVector: Uint8Array,
    continuousBuffer: Uint8Array,
    numVectors: number,
    dimension: number
  ): number[] {
    const results = new Array(numVectors).fill(0);
    const packedDimension = Math.ceil(dimension / 8);
    const mainPackedDimension = Math.floor(dimension / 8);
  
    for (let i = 0; i < numVectors; i++) {
      let dotProduct = 0;
      const targetOffset = i * packedDimension;
  
      // Main unrolled loop for full bytes
      for (let j = 0; j < mainPackedDimension; j++) {
        const packedValue = continuousBuffer[targetOffset + j]!;
        const queryOffset = j * 8;
        dotProduct += queryVector[queryOffset]! * ((packedValue >> 7) & 1);
        dotProduct += queryVector[queryOffset + 1]! * ((packedValue >> 6) & 1);
        dotProduct += queryVector[queryOffset + 2]! * ((packedValue >> 5) & 1);
        dotProduct += queryVector[queryOffset + 3]! * ((packedValue >> 4) & 1);
        dotProduct += queryVector[queryOffset + 4]! * ((packedValue >> 3) & 1);
        dotProduct += queryVector[queryOffset + 5]! * ((packedValue >> 2) & 1);
        dotProduct += queryVector[queryOffset + 6]! * ((packedValue >> 1) & 1);
        dotProduct += queryVector[queryOffset + 7]! * (packedValue & 1);
      }
  
      // Handle remaining bits if dimension is not a multiple of 8
      const remainderStartDim = mainPackedDimension * 8;
      if (remainderStartDim < dimension) {
        const lastPackedValue = continuousBuffer[targetOffset + mainPackedDimension]!;
        for (let dim = remainderStartDim; dim < dimension; dim++) {
          const bitIndex = 7 - (dim % 8);
          const targetValue = (lastPackedValue >> bitIndex) & 1;
          dotProduct += queryVector[dim]! * targetValue;
        }
      }
  
      results[i] = dotProduct;
    }
  
    return results;
  }
  