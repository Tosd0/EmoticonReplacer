/**
 * TypeScript 类型定义
 */

// ========== 数据类型 ==========

export interface EmoticonData {
    emoticon: string;
    keywords: string[];
    weight?: number;
    category?: string;
}

export interface SearchConfig {
    k1?: number;
    b?: number;
}

export interface ReplaceConfig {
    markerPattern?: RegExp;
    keywordSeparator?: string;
    replaceStrategy?: 'first' | 'best' | 'all';
}

export interface ReplaceOptions {
    strategy?: 'first' | 'best' | 'all';
    threshold?: number;
    keepOriginalOnNotFound?: boolean;
    markNotFound?: boolean;
}

export interface SearchResult {
    emoticon: string;
    score: number;
    matchedKeywords: string[];
    category: string;
}

export interface Replacement {
    index: number;
    original: string;
    keywords: string[];
    emoticon: string | null;
    offset: number;
    matches: SearchResult[];
    selected: SearchResult | SearchResult[] | null;
    notFound?: boolean;
}

export interface ReplaceResult {
    text: string;
    replacements: Replacement[];
    originalText: string;
    hasReplacements: boolean;
    successCount: number;
    failureCount: number;
}

export interface PreviewMarker {
    marker: string;
    keywords: string[];
    offset: number;
    matches: SearchResult[];
    bestMatch: SearchResult | null;
}

export interface DataStats {
    totalEmoticons: number;
    totalKeywords: number;
    totalCategories: number;
    averageKeywordsPerEmoticon: number;
}

export interface ReplacerStats {
    totalEmoticons: number;
    avgDocLength: number;
    config: ReplaceConfig;
}

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

export interface StorageStats {
    hasData: boolean;
    count: number;
    sizeKB: string;
    error?: string;
}

export interface InitStorageOptions {
    defaultURL?: string;
    forceReload?: boolean;
}

// ========== 核心类 ==========

/**
 * SearchEngine - BM25 搜索引擎
 */
export class SearchEngine {
    constructor(config?: SearchConfig);

    k1: number;
    b: number;
    documents: Array<{
        emoticon: string;
        keywords: string[];
        weight: number;
        category: string;
    }>;
    avgDocLength: number;
    idf: Map<string, number>;

    /**
     * 构建索引
     */
    buildIndex(emoticons: EmoticonData[]): void;

    /**
     * BM25 搜索
     */
    search(text: string, topK?: number, threshold?: number): SearchResult[];

    /**
     * 精确匹配
     */
    exactMatch(text: string): SearchResult[];
}

/**
 * EmoticonReplacer - 颜文字替换引擎
 */
export class EmoticonReplacer {
    constructor(searchEngine: SearchEngine);

    searchEngine: SearchEngine;
    config: ReplaceConfig;

    /**
     * 设置配置
     */
    setConfig(config: ReplaceConfig): void;

    /**
     * 加载颜文字数据
     */
    loadEmoticons(emoticons: EmoticonData[]): void;

    /**
     * 替换文本
     */
    replaceText(text: string, options?: ReplaceOptions): ReplaceResult;

    /**
     * 批量替换
     */
    replaceMultiple(texts: string[], options?: ReplaceOptions): ReplaceResult[];

    /**
     * 预览替换
     */
    preview(text: string): PreviewMarker[];

    /**
     * 查询关键词
     */
    query(keywords: string, topK?: number): SearchResult[];

    /**
     * 精确查询
     */
    exactQuery(keywords: string): SearchResult[];

    /**
     * 获取统计信息
     */
    getStats(): ReplacerStats;
}

/**
 * EmoticonDataManager - 数据管理器
 */
export class EmoticonDataManager {
    constructor();

    emoticons: EmoticonData[];

    // 数据加载
    loadFromJSON(jsonString: string): EmoticonDataManager;
    loadFromArray(data: EmoticonData[]): EmoticonDataManager;

    // 读取操作
    getAllEmoticons(): EmoticonData[];
    getEmoticonByText(emoticon: string): EmoticonData | null;
    getAllKeywords(): string[];
    getKeywordsByEmoticon(emoticon: string): string[];
    filterByCategory(category: string | string[]): EmoticonData[];
    getAllCategories(): string[];
    findByKeyword(keyword: string): EmoticonData[];
    getStats(): DataStats;

    // 修改操作
    addKeyword(emoticon: string, keyword: string): boolean;
    removeKeyword(emoticon: string, keyword: string): boolean;
    updateKeywords(emoticon: string, keywords: string[]): boolean;
    setCategory(emoticon: string, category: string): boolean;
    setWeight(emoticon: string, weight: number): boolean;

    // 颜文字管理
    addEmoticon(data: Partial<EmoticonData> & { emoticon: string; keywords: string[] }): boolean;
    removeEmoticon(emoticon: string): boolean;
    updateEmoticon(emoticon: string, newData: Partial<EmoticonData> & { emoticon: string; keywords: string[] }): boolean;

    // 数据导出
    exportToJSON(pretty?: boolean): string;
    exportToArray(): EmoticonData[];

    // 批量操作
    batchSetCategory(emoticons: string[], category: string): number;
    batchRemove(emoticons: string[]): number;
    clear(): void;
}

// ========== 工厂函数 ==========

export interface CreateReplacerOptions {
    emoticons?: EmoticonData[];
    jsonData?: string;
    searchConfig?: SearchConfig;
    replaceConfig?: ReplaceConfig;
}

/**
 * 创建 EmoticonReplacer 实例
 */
export function createReplacer(options?: CreateReplacerOptions): EmoticonReplacer;

/**
 * 创建 EmoticonDataManager 实例
 */
export function createManager(data?: EmoticonData[] | string): EmoticonDataManager;

/**
 * 创建 SearchEngine 实例
 */
export function createSearchEngine(config?: SearchConfig): SearchEngine;

// ========== 快捷 API ==========

export interface QuickReplaceOptions extends ReplaceOptions {
    searchConfig?: SearchConfig;
    replaceConfig?: ReplaceConfig;
}

/**
 * 快速替换文本
 */
export function quickReplace(
    text: string,
    emoticons: EmoticonData[] | string,
    options?: QuickReplaceOptions
): ReplaceResult;

/**
 * 快速查询
 */
export function quickQuery(
    keywords: string,
    emoticons: EmoticonData[] | string,
    topK?: number
): SearchResult[];

/**
 * 从文件加载数据 (Node.js only)
 */
export function loadFromFile(filePath: string): Promise<EmoticonData[]>;

/**
 * 从 URL 加载数据 (Browser only)
 */
export function loadFromURL(url: string): Promise<EmoticonData[]>;

// ========== 工具函数 ==========

/**
 * 验证数据格式
 */
export function validateData(data: any[]): ValidationResult;

/**
 * 批量替换
 */
export function batchReplace(
    texts: string[],
    emoticons: EmoticonData[] | string,
    options?: QuickReplaceOptions
): ReplaceResult[];

// ========== 存储 API (IndexedDB) ==========

/**
 * 初始化颜文字存储
 * 如果 IndexedDB 中已有数据，直接返回
 * 如果没有，尝试从远程 URL 加载并保存
 * 远程加载失败则返回空数组
 */
export function initEmoticonStorage(options?: InitStorageOptions): Promise<EmoticonData[]>;

/**
 * 从 IndexedDB 读取颜文字数据
 */
export function getEmoticons(): Promise<EmoticonData[] | null>;

/**
 * 保存颜文字数据到 IndexedDB
 */
export function saveEmoticons(data: EmoticonData[]): Promise<boolean>;

/**
 * 清空 IndexedDB 中的颜文字数据
 */
export function clearEmoticons(): Promise<boolean>;

/**
 * 获取存储统计信息
 */
export function getStorageStats(): Promise<StorageStats>;

/**
 * 设置调试模式
 */
export function setDebugMode(enabled: boolean): void;

// ========== 常量 ==========

export const VERSION: string;

export const DEFAULT_CONFIG: {
    search: SearchConfig;
    replace: ReplaceConfig;
};

export const REPLACE_STRATEGIES: {
    FIRST: 'first';
    BEST: 'best';
    ALL: 'all';
};

// ========== 默认导出 ==========

export interface EmoticonReplacerAPI {
    // 核心类
    EmoticonReplacer: typeof EmoticonReplacer;
    SearchEngine: typeof SearchEngine;
    EmoticonDataManager: typeof EmoticonDataManager;

    // 工厂函数
    createReplacer: typeof createReplacer;
    createManager: typeof createManager;
    createSearchEngine: typeof createSearchEngine;

    // 快捷 API
    quickReplace: typeof quickReplace;
    quickQuery: typeof quickQuery;

    // 数据加载
    loadFromFile: typeof loadFromFile;
    loadFromURL: typeof loadFromURL;

    // 工具函数
    validateData: typeof validateData;
    batchReplace: typeof batchReplace;

    // 存储 API
    initEmoticonStorage: typeof initEmoticonStorage;
    getEmoticons: typeof getEmoticons;
    saveEmoticons: typeof saveEmoticons;
    clearEmoticons: typeof clearEmoticons;
    getStorageStats: typeof getStorageStats;
    setDebugMode: typeof setDebugMode;

    // 常量
    VERSION: string;
    DEFAULT_CONFIG: typeof DEFAULT_CONFIG;
    REPLACE_STRATEGIES: typeof REPLACE_STRATEGIES;
}

declare const api: EmoticonReplacerAPI;
export default api;
