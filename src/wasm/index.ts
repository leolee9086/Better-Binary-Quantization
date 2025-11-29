import init, * as wasm from '../../wasm-dist/better_binary_quantization.js';

export type WasmModule = typeof wasm;

export class WasmProvider {
    private static instance: WasmModule | null = null;
    private static initializationPromise: Promise<WasmModule> | null = null;

    /**
     * 初始化WASM模块
     * @param wasmUrlOrBuffer 可选的WASM文件URL或Buffer。如果在Node环境，可能需要传入Buffer。
     */
    public static async init(wasmUrlOrBuffer?: string | Request | Response | ArrayBuffer | ArrayBufferView | WebAssembly.Module): Promise<WasmModule> {
        if (this.instance) {
            return this.instance;
        }

        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = (async () => {
            await init(wasmUrlOrBuffer);
            this.instance = wasm;
            return wasm;
        })();

        return this.initializationPromise;
    }

    public static getModule(): WasmModule {
        if (!this.instance) {
            throw new Error("WASM module not initialized. Call WasmProvider.init() first.");
        }
        return this.instance;
    }

    public static isInitialized(): boolean {
        return !!this.instance;
    }
}

export * from '../../wasm-dist/better_binary_quantization.js';
