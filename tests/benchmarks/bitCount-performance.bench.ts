import { describe, bench } from 'vitest';
import { bitCount, bitCountBytes } from '../../src/utils';

/**
 * bitCount性能回归测试
 * 测试不同实现方案的性能差异
 */

describe('bitCount性能回归测试', () => {
  // 测试数据准备
  const testNumbers = new Array(1000).fill(0).map(() => Math.floor(Math.random() * 0xFFFFFFFF));
  const testBytes = new Uint8Array(1000).map(() => Math.floor(Math.random() * 256));

  describe('单个bitCount性能', () => {
    bench('当前实现 - 32位整数', () => {
      for (let i = 0; i < 1000; i++) {
        bitCount(testNumbers[i]!);
      }
    });

    bench('SWAR算法 - 32位整数', () => {
      for (let i = 0; i < 1000; i++) {
        bitCountSWAR(testNumbers[i]!);
      }
    });
  });

  describe('bitCountBytes性能', () => {
    bench('当前实现 - 字节数组', () => {
      bitCountBytes(testBytes);
    });

    bench('查找表优化 - 字节数组', () => {
      bitCountBytesLookupTable(testBytes);
    });
  });

  describe('位运算点积场景性能', () => {
    // 模拟bitwiseDotProduct中的使用场景
    const qBytes = new Uint8Array(128).map(() => Math.floor(Math.random() * 256));
    const dBytes = new Uint8Array(128).map(() => Math.floor(Math.random() * 256));

    bench('当前bitCount在点积中的性能', () => {
      let ret = 0;
      for (let i = 0; i < qBytes.length; i++) {
        const bitwiseAnd = (qBytes[i]! & dBytes[i]!) & 0xFF;
        ret += bitCount(bitwiseAnd);
      }
    });

    bench('SWAR bitCount在点积中的性能', () => {
      let ret = 0;
      for (let i = 0; i < qBytes.length; i++) {
        const bitwiseAnd = (qBytes[i]! & dBytes[i]!) & 0xFF;
        ret += bitCountSWAR(bitwiseAnd);
      }
    });

    bench('查找表在点积中的性能', () => {
      let ret = 0;
      for (let i = 0; i < qBytes.length; i++) {
        const bitwiseAnd = (qBytes[i]! & dBytes[i]!) & 0xFF;
        ret += BIT_COUNT_LOOKUP_TABLE[bitwiseAnd]!;
      }
    });
  });

  describe('大规模数据性能', () => {
    const largeBytes = new Uint8Array(10000).map(() => Math.floor(Math.random() * 256));

    bench('当前bitCountBytes - 10000字节', () => {
      bitCountBytes(largeBytes);
    });

    bench('查找表bitCountBytes - 10000字节', () => {
      bitCountBytesLookupTable(largeBytes);
    });
  });
});

// SWAR算法实现
function bitCountSWAR(n: number): number {
  n = n >>> 0; // 转换为无符号32位整数
  n = n - ((n >>> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
  n = (n + (n >>> 4)) & 0x0F0F0F0F;
  n = n + (n >>> 8);
  n = n + (n >>> 16);
  return n & 0x3F;
}

// 查找表实现
const BIT_COUNT_LOOKUP_TABLE = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  let count = 0;
  let temp = i;
  while (temp > 0) {
    count += temp & 1;
    temp >>>= 1;
  }
  BIT_COUNT_LOOKUP_TABLE[i] = count;
}

function bitCountBytesLookupTable(bytes: Uint8Array): number {
  let count = 0;
  for (let i = 0; i < bytes.length; i++) {
    const val = bytes[i];
    if (val !== undefined) {
      count += BIT_COUNT_LOOKUP_TABLE[val]!;
    }
  }
  return count;
} 