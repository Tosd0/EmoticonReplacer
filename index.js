/**
 * Emoticon Replacer - Unified API Entry Point
 *
 * 提供多种导入和使用方式：
 * 1. 类导入：const { EmoticonReplacer, SearchEngine, EmoticonDataManager } = require('emoticon-replacer');
 * 2. 工厂函数：const { createReplacer, createManager } = require('emoticon-replacer');
 * 3. 快捷 API：const { quickReplace } = require('emoticon-replacer');
 */

// 导入核心类
const EmoticonReplacer = require('./src/core/EmoticonReplacer');
const SearchEngine = require('./src/core/SearchEngine');
const EmoticonDataManager = require('./src/core/EmoticonDataManager');

// 导入存储模块
const IndexedDBStorage = require('./src/storage/IndexedDBStorage');

// ========== 工厂函数 ==========

/**
 * 创建一个完整配置的 EmoticonReplacer 实例
 * @param {Object} options - 配置选项
 * @param {Array} options.emoticons - 颜文字数据数组
 * @param {string} options.jsonData - JSON 格式的颜文字数据
 * @param {Object} options.searchConfig - SearchEngine 配置 { k1, b }
 * @param {Object} options.replaceConfig - EmoticonReplacer 配置
 * @returns {EmoticonReplacer} 配置好的 EmoticonReplacer 实例
 */
function createReplacer(options = {}) {
    const {
        emoticons = [],
        jsonData = null,
        searchConfig = {},
        replaceConfig = {}
    } = options;

    // 创建搜索引擎
    const searchEngine = new SearchEngine(searchConfig);

    // 创建替换器
    const replacer = new EmoticonReplacer(searchEngine);

    // 应用配置
    if (replaceConfig) {
        replacer.setConfig(replaceConfig);
    }

    // 加载数据
    if (jsonData) {
        const manager = new EmoticonDataManager();
        manager.loadFromJSON(jsonData);
        replacer.loadEmoticons(manager.getAllEmoticons());
    } else if (emoticons.length > 0) {
        replacer.loadEmoticons(emoticons);
    }

    return replacer;
}

/**
 * 创建 EmoticonDataManager 实例并加载数据
 * @param {Array|string} data - 颜文字数据数组或 JSON 字符串
 * @returns {EmoticonDataManager} 加载好数据的 EmoticonDataManager 实例
 */
function createManager(data = null) {
    const manager = new EmoticonDataManager();

    if (data) {
        if (typeof data === 'string') {
            manager.loadFromJSON(data);
        } else if (Array.isArray(data)) {
            manager.loadFromArray(data);
        }
    }

    return manager;
}

/**
 * 创建 SearchEngine 实例
 * @param {Object} config - BM25 配置 { k1, b }
 * @returns {SearchEngine} SearchEngine 实例
 */
function createSearchEngine(config = {}) {
    return new SearchEngine(config);
}

// ========== 快捷 API ==========

/**
 * 快速替换文本（一站式 API）
 * @param {string} text - 要处理的文本
 * @param {Array|string} emoticons - 颜文字数据（数组或 JSON 字符串）
 * @param {Object} options - 替换选项
 * @returns {Object} 替换结果
 */
function quickReplace(text, emoticons, options = {}) {
    const replacer = createReplacer({
        emoticons: Array.isArray(emoticons) ? emoticons : [],
        jsonData: typeof emoticons === 'string' ? emoticons : null,
        searchConfig: options.searchConfig,
        replaceConfig: options.replaceConfig
    });

    return replacer.replaceText(text, options);
}

/**
 * 快速查询关键词对应的颜文字
 * @param {string} keywords - 关键词
 * @param {Array|string} emoticons - 颜文字数据
 * @param {number} topK - 返回前 K 个结果
 * @returns {Array} 匹配结果
 */
function quickQuery(keywords, emoticons, topK = 5) {
    const replacer = createReplacer({
        emoticons: Array.isArray(emoticons) ? emoticons : [],
        jsonData: typeof emoticons === 'string' ? emoticons : null
    });

    return replacer.query(keywords, topK);
}

/**
 * 从文件路径加载颜文字数据（仅 Node.js 环境）
 * @param {string} filePath - 文件路径
 * @returns {Promise<Array>} 颜文字数据数组
 */
async function loadFromFile(filePath) {
    // 检查是否在 Node.js 环境
    if (typeof require === 'undefined' || typeof process === 'undefined') {
        throw new Error('loadFromFile is only available in Node.js environment');
    }

    const fs = require('fs').promises;
    const fileContent = await fs.readFile(filePath, 'utf8');
    const manager = new EmoticonDataManager();
    manager.loadFromJSON(fileContent);
    return manager.getAllEmoticons();
}

/**
 * 从 URL 加载颜文字数据（浏览器环境）
 * @param {string} url - 数据 URL
 * @returns {Promise<Array>} 颜文字数据数组
 */
async function loadFromURL(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to load from URL: ${response.status} ${response.statusText}`);
    }

    const jsonText = await response.text();
    const manager = new EmoticonDataManager();
    manager.loadFromJSON(jsonText);
    return manager.getAllEmoticons();
}

// ========== 工具函数 ==========

/**
 * 验证颜文字数据格式
 * @param {Array} data - 颜文字数据数组
 * @returns {Object} 验证结果 { valid, errors }
 */
function validateData(data) {
    const errors = [];

    if (!Array.isArray(data)) {
        return { valid: false, errors: ['Data must be an array'] };
    }

    data.forEach((item, index) => {
        if (typeof item !== 'object' || item === null) {
            errors.push(`Item ${index}: Must be an object.`);
            return;
        }

        if (!item.emoticon || typeof item.emoticon !== 'string') {
            errors.push(`Item ${index}: Missing or invalid 'emoticon' field`);
        }

        if (!item.keywords || !Array.isArray(item.keywords) || item.keywords.length === 0) {
            errors.push(`Item ${index}: Missing or invalid 'keywords' field`);
        }

        if (item.weight !== undefined && (typeof item.weight !== 'number' || item.weight <= 0)) {
            errors.push(`Item ${index}: Invalid 'weight' field (must be positive number)`);
        }
    });

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * 批量处理文本数组
 * @param {Array<string>} texts - 文本数组
 * @param {Array|string} emoticons - 颜文字数据
 * @param {Object} options - 替换选项
 * @returns {Array} 处理结果数组
 */
function batchReplace(texts, emoticons, options = {}) {
    const replacer = createReplacer({
        emoticons: Array.isArray(emoticons) ? emoticons : [],
        jsonData: typeof emoticons === 'string' ? emoticons : null,
        searchConfig: options.searchConfig,
        replaceConfig: options.replaceConfig
    });

    return replacer.replaceMultiple(texts, options);
}

// ========== 常量 ==========

const VERSION = '1.0.0';

const DEFAULT_CONFIG = {
    search: {
        k1: 1.5,
        b: 0.75
    },
    replace: {
        markerPattern: /\[emoticon:([^\]]+)\]/gi,
        keywordSeparator: ',',
        replaceStrategy: 'best'
    }
};

const REPLACE_STRATEGIES = {
    FIRST: 'first',    // 使用第一个匹配结果
    BEST: 'best',      // 使用最佳匹配结果（默认）
    ALL: 'all'         // 返回所有匹配结果
};

// ========== 导出 ==========

// CommonJS 导出
module.exports = {
    // 核心类
    EmoticonReplacer,
    SearchEngine,
    EmoticonDataManager,

    // 工厂函数
    createReplacer,
    createManager,
    createSearchEngine,

    // 快捷 API
    quickReplace,
    quickQuery,

    // 数据加载
    loadFromFile,
    loadFromURL,

    // 工具函数
    validateData,
    batchReplace,

    // 存储 API (IndexedDB)
    initEmoticonStorage: IndexedDBStorage.initEmoticonStorage,
    getEmoticons: IndexedDBStorage.getEmoticons,
    saveEmoticons: IndexedDBStorage.saveEmoticons,
    clearEmoticons: IndexedDBStorage.clearEmoticons,
    getStorageStats: IndexedDBStorage.getStorageStats,
    setDebugMode: IndexedDBStorage.setDebugMode,

    // 常量
    VERSION,
    DEFAULT_CONFIG,
    REPLACE_STRATEGIES
};
