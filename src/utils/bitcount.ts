
/**
 * 32位整数位计数算法
 * @param n 32位整数
 * @returns 1的个数
 */
export function bitCount32Optimized(n: number): number {
    n = n >>> 0;
    n = n - ((n >>> 1) & 0x55555555);
    n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
    n = (n + (n >>> 4)) & 0x0F0F0F0F;
    n = n + (n >>> 8);
    n = n + (n >>> 16);
    return n & 0x3F;
}
