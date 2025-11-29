"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var config_1 = require("vitest/config");
exports.default = (0, config_1.defineConfig)({
    test: {
        // 只包含实验性测试文件
        include: ['tests/experimental/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/cypress/**',
            '**/.{idea,git,cache,output,temp}/**',
            '**/*.bench.ts' // 排除性能测试文件
        ],
        // 实验性测试的特殊配置
        environment: 'node',
        globals: true,
        // 详细的输出格式
        reporter: 'verbose',
        // 允许较长的超时时间（实验性测试可能需要更多时间）
        testTimeout: 30000,
        // 详细的错误信息
        onConsoleLog: function (log, type) {
            // 允许所有console输出，便于调试
            return true;
        },
        // 实验性测试的特殊设置
        setupFiles: [],
        // 允许实验性测试修改全局状态
        isolate: false,
        // 详细的测试报告
        coverage: {
            enabled: false, // 实验性测试不需要覆盖率
        },
        // 允许实验性测试使用未模拟的模块
        deps: {
            inline: [],
        },
    },
    // 实验性测试的特殊解析配置
    resolve: {
        alias: {
        // 可以在这里添加实验性测试的特殊别名
        },
    },
});
