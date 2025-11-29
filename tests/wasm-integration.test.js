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
var better_binary_quantization_js_1 = require("../wasm-dist/better_binary_quantization.js");
var fs = require("fs");
var path = require("path");
(0, vitest_1.describe)('WASM Integration Tests', function () {
    (0, vitest_1.beforeAll)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var wasmPath, wasmBuffer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    wasmPath = path.resolve(__dirname, '../wasm-dist/better_binary_quantization_bg.wasm');
                    wasmBuffer = fs.readFileSync(wasmPath);
                    return [4 /*yield*/, (0, better_binary_quantization_js_1.default)(wasmBuffer)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('should compute cosine similarity correctly', function () {
        var v1 = new Float32Array([1.0, 0.0, 0.0]);
        var v2 = new Float32Array([0.0, 1.0, 0.0]);
        var sim = (0, better_binary_quantization_js_1.wasm_compute_similarity)(v1, v2, "cosine");
        (0, vitest_1.expect)(sim).toBeCloseTo(0.0); // Orthogonal vectors
        var v3 = new Float32Array([1.0, 0.0, 0.0]);
        var sim2 = (0, better_binary_quantization_js_1.wasm_compute_similarity)(v1, v3, "cosine");
        (0, vitest_1.expect)(sim2).toBeCloseTo(1.0); // Same vectors
    });
    (0, vitest_1.it)('should create random vector from WASM', function () {
        var dim = 10;
        var vec = (0, better_binary_quantization_js_1.wasm_create_random_vector)(dim, -1.0, 1.0);
        (0, vitest_1.expect)(vec.length).toBe(dim);
        for (var i = 0; i < dim; i++) {
            (0, vitest_1.expect)(vec[i]).toBeGreaterThanOrEqual(-1.0);
            (0, vitest_1.expect)(vec[i]).toBeLessThanOrEqual(1.0);
        }
    });
    (0, vitest_1.it)('should perform scalar quantization', function () {
        var quantizer = new better_binary_quantization_js_1.WasmScalarQuantizer(0.1, 5, "euclidean");
        var vector = new Float32Array([0.5, -0.5, 1.0, -1.0]);
        var centroid = new Float32Array([0, 0, 0, 0]);
        var result = quantizer.scalar_quantize(vector, 4, centroid);
        (0, vitest_1.expect)(result.quantizedVector).toBeDefined();
        (0, vitest_1.expect)(result.quantizedVector.length).toBe(4);
        (0, vitest_1.expect)(result.correction).toBeDefined();
    });
});
