"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
var path = require("path");
var fs = require("fs");
var wasm_1 = require("../../src/wasm");
var vectorSimilarity_1 = require("../../src/vectorSimilarity");
var optimizedScalarQuantizer_1 = require("../../src/optimizedScalarQuantizer");
var types_1 = require("../../src/types");
(0, vitest_1.describe)('WASM vs TypeScript Performance Comparison', function () {
    // Test data
    var dim = 1536; // OpenAI embedding dimension
    var v1 = new Float32Array(dim);
    var v2 = new Float32Array(dim);
    var centroid = new Float32Array(dim);
    // Initialize data
    for (var i = 0; i < dim; i++) {
        v1[i] = Math.random() * 2 - 1;
        v2[i] = Math.random() * 2 - 1;
        centroid[i] = Math.random() * 0.1;
    }
    // TS Quantizer
    var tsQuantizer = new optimizedScalarQuantizer_1.OptimizedScalarQuantizer({
        similarityFunction: types_1.VectorSimilarityFunction.COSINE,
        lambda: 0.1,
        iters: 5
    });
    var tsDest = new Uint8Array(dim);
    // WASM Quantizer
    var wasmQuantizer;
    (0, vitest_1.beforeAll)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var wasmPath, wasmBuffer, logMsg, sim, tsSim, logPath, err, qRes, tsRes, mismatchCount, i, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    console.log('Initializing WASM...');
                    wasmPath = path.resolve(__dirname, '../../wasm-dist/better_binary_quantization_bg.wasm');
                    if (!fs.existsSync(wasmPath)) {
                        throw new Error("WASM file not found at ".concat(wasmPath));
                    }
                    wasmBuffer = fs.readFileSync(wasmPath);
                    return [4 /*yield*/, wasm_1.WasmProvider.init(wasmBuffer)];
                case 1:
                    _a.sent();
                    console.log('WASM initialized successfully');
                    wasmQuantizer = new wasm_1.WasmScalarQuantizer(0.1, 5, "cosine");
                    logMsg = [];
                    logMsg.push('Verifying WASM functions...');
                    sim = (0, wasm_1.wasm_compute_similarity)(v1, v2, "cosine");
                    tsSim = (0, vectorSimilarity_1.computeCosineSimilarity)(v1, v2);
                    logMsg.push("Warmup similarity: WASM=".concat(sim, ", TS=").concat(tsSim));
                    logPath = path.resolve(__dirname, '../../benchmark_verification.log');
                    if (Math.abs(sim - tsSim) > 1e-5) {
                        err = "Similarity mismatch: WASM=".concat(sim, ", TS=").concat(tsSim);
                        logMsg.push(err);
                        fs.writeFileSync(logPath, logMsg.join('\n'));
                        throw new Error(err);
                    }
                    qRes = wasmQuantizer.scalar_quantize(v1, 4, centroid);
                    tsRes = tsQuantizer.scalarQuantize(v1, tsDest, 4, centroid);
                    logMsg.push("Warmup quantization done");
                    // Verify Quantization Correctness
                    logMsg.push('Verifying Quantization Correctness...');
                    // Check correction
                    logMsg.push("Correction: WASM=".concat(qRes.correction, ", TS=").concat(tsRes.additionalCorrection));
                    if (Math.abs(qRes.correction - tsRes.additionalCorrection) > 1e-4) {
                        logMsg.push("Correction mismatch: WASM=".concat(qRes.correction, ", TS=").concat(tsRes.additionalCorrection));
                    }
                    mismatchCount = 0;
                    for (i = 0; i < dim; i++) {
                        if (qRes.quantizedVector[i] !== tsDest[i]) {
                            mismatchCount++;
                            if (mismatchCount < 5) {
                                logMsg.push("Quantization mismatch at ".concat(i, ": WASM=").concat(qRes.quantizedVector[i], ", TS=").concat(tsDest[i]));
                            }
                        }
                    }
                    if (mismatchCount > 0) {
                        logMsg.push("Total quantization mismatches: ".concat(mismatchCount, " / ").concat(dim));
                        fs.writeFileSync(logPath, logMsg.join('\n'));
                        throw new Error("Quantization results do not match!");
                    }
                    else {
                        logMsg.push("Quantization results match perfectly!");
                        fs.writeFileSync(logPath, logMsg.join('\n'));
                    }
                    return [3 /*break*/, 3];
                case 2:
                    e_1 = _a.sent();
                    console.error('Failed to initialize WASM in benchmark:', e_1);
                    throw e_1;
                case 3: return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.describe)('Cosine Similarity (1536 dim)', function () {
        (0, vitest_1.bench)('TypeScript', function () {
            (0, vectorSimilarity_1.computeCosineSimilarity)(v1, v2);
        });
        (0, vitest_1.bench)('WASM', function () {
            (0, wasm_1.wasm_compute_similarity)(v1, v2, "cosine");
        });
    });
    (0, vitest_1.describe)('Scalar Quantization (1536 dim, 4 bits)', function () {
        (0, vitest_1.bench)('TypeScript', function () {
            tsQuantizer.scalarQuantize(v1, tsDest, 4, centroid);
        });
        (0, vitest_1.bench)('WASM', function () {
            if (!wasmQuantizer)
                throw new Error("WASM not initialized");
            wasmQuantizer.scalar_quantize(v1, 4, centroid);
        });
    });
});
