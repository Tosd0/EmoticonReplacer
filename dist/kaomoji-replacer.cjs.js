/**
 * Kaomoji Replacer v1.2.2
 * 基于 BM25 算法的颜文字替换插件
 * (c) 2025 Tosd0
 * @license MIT
 */
'use strict';

/**
 * KaomojiReplacer.js
 * 核心替换引擎 - 可独立使用，不依赖任何框架
 * 负责检测文本中的标记并替换为对应的 kaomoji
 */

class KaomojiReplacer {
    constructor(searchEngine) {
        this.searchEngine = searchEngine;

        // 标记格式配置
        this.config = {
            // 标记的正则表达式: [kaomoji:关键词1,关键词2,...]
            markerPattern: /\[kaomoji:([^\]]+)\]/gi,
            // 分隔符
            keywordSeparator: ',',
            // 替换策略: 'first' | 'best' | 'all'
            replaceStrategy: 'best'
        };
    }

    /**
     * 设置配置
     * @param {Object} config - 配置对象
     */
    setConfig(config) {
        Object.assign(this.config, config);
    }

    /**
     * 加载 kaomoji 数据
     * @param {Array} kaomojis - kaomoji 数据数组
     */
    loadKaomojis(kaomojis) {
        this.searchEngine.buildIndex(kaomojis);
    }

    /**
     * 处理文本，替换所有标记为 kaomoji
     * @param {string} text - 输入文本
     * @param {Object} options - 替换选项
     * @returns {Object} 包含替换后的文本和替换信息
     */
    replaceText(text, options = {}) {
        const {
            strategy = this.config.replaceStrategy,
            threshold = 0,
            keepOriginalOnNotFound = true,
            markNotFound = false
        } = options;

        let result = text;
        const replacements = [];
        let matchIndex = 0;

        // 查找所有标记
        result = result.replace(this.config.markerPattern, (match, keywordsStr, offset) => {
            // 解析关键词
            const keywords = keywordsStr
                .split(this.config.keywordSeparator)
                .map(k => k.trim())
                .filter(k => k.length > 0);

            if (keywords.length === 0) {
                return keepOriginalOnNotFound ? match : '';
            }

            // 搜索匹配的 kaomoji
            const searchText = keywords.join(' ');
            const matches = this.searchEngine.search(searchText, 5, threshold);

            let replacement = '';
            let selectedKaomoji = null;

            if (matches.length > 0) {
                // 根据策略选择 kaomoji
                switch (strategy) {
                    case 'first':
                        selectedKaomoji = matches[0];
                        replacement = matches[0].kaomoji;
                        break;

                    case 'best':
                        // 选择分数最高的
                        selectedKaomoji = matches[0];
                        replacement = matches[0].kaomoji;
                        break;

                    case 'all':
                        // 返回所有匹配的 kaomoji
                        replacement = matches.map(m => m.kaomoji).join(' ');
                        selectedKaomoji = matches;
                        break;

                    default:
                        selectedKaomoji = matches[0];
                        replacement = matches[0].kaomoji;
                }

                // 记录替换信息
                replacements.push({
                    index: matchIndex++,
                    original: match,
                    keywords: keywords,
                    kaomoji: replacement,
                    offset: offset,
                    matches: matches,
                    selected: selectedKaomoji
                });

                return replacement;
            } else {
                // 没有找到匹配的 kaomoji
                replacements.push({
                    index: matchIndex++,
                    original: match,
                    keywords: keywords,
                    kaomoji: null,
                    offset: offset,
                    matches: [],
                    selected: null,
                    notFound: true
                });

                if (markNotFound) {
                    return `[?${keywordsStr}]`;
                }

                return keepOriginalOnNotFound ? match : '';
            }
        });

        return {
            text: result,
            replacements: replacements,
            originalText: text,
            hasReplacements: replacements.length > 0,
            successCount: replacements.filter(r => !r.notFound).length,
            failureCount: replacements.filter(r => r.notFound).length
        };
    }

    /**
     * 批量替换多个文本
     * @param {Array} texts - 文本数组
     * @param {Object} options - 替换选项
     * @returns {Array} 替换结果数组
     */
    replaceMultiple(texts, options = {}) {
        return texts.map(text => this.replaceText(text, options));
    }

    /**
     * 预览替换结果（不实际替换，只返回会被替换的内容）
     * @param {string} text - 输入文本
     * @returns {Array} 预览结果数组
     */
    preview(text) {
        const markers = [];
        let match;

        const regex = new RegExp(this.config.markerPattern);
        while ((match = regex.exec(text)) !== null) {
            const keywordsStr = match[1];
            const keywords = keywordsStr
                .split(this.config.keywordSeparator)
                .map(k => k.trim())
                .filter(k => k.length > 0);

            const searchText = keywords.join(' ');
            const matches = this.searchEngine.search(searchText, 5, 0);

            markers.push({
                marker: match[0],
                keywords: keywords,
                offset: match.index,
                matches: matches,
                bestMatch: matches.length > 0 ? matches[0] : null
            });
        }

        return markers;
    }

    /**
     * 查询关键词对应的 kaomoji（不需要标记格式）
     * @param {string} keywords - 关键词字符串
     * @param {number} topK - 返回前 K 个结果
     * @returns {Array} 匹配结果
     */
    query(keywords, topK = 5) {
        return this.searchEngine.search(keywords, topK, 0);
    }

    /**
     * 精确查询（使用关键词完全匹配）
     * @param {string} keywords - 关键词字符串
     * @returns {Array} 精确匹配结果
     */
    exactQuery(keywords) {
        return this.searchEngine.exactMatch(keywords);
    }

    /**
     * 获取统计信息
     * @returns {Object} 统计数据
     */
    getStats() {
        return {
            totalKaomojis: this.searchEngine.documents.length,
            avgDocLength: this.searchEngine.avgDocLength,
            config: { ...this.config }
        };
    }
}

/**
 * SearchEngine.js
 * 基于 BM25 算法的关键词搜索引擎
 * 用于在文本中查找和评分关键词匹配
 */

class SearchEngine {
    constructor(config = {}) {
        // BM25 参数
        this.k1 = config.k1 || 1.5;  // 词频饱和参数
        this.b = config.b || 0.75;   // 长度归一化参数
        this.charWeight = config.charWeight || 0.6; // 单字匹配权重系数

        // 索引数据
        this.documents = [];         // 文档列表（每个kaomoji的keywords作为一个文档）
        this.avgDocLength = 0;       // 平均文档长度（整词）
        this.avgCharDocLength = 0;   // 平均文档长度（单字）
        this.idf = new Map();        // 整词IDF值缓存
        this.charIdf = new Map();    // 单字IDF值缓存
    }

    /**
     * 解析关键词权重
     * @param {string} keywordStr - 关键词字符串（可能包含权重前缀）
     * @returns {Object} { keyword, weight }
     */
    _parseKeywordWeight(keywordStr) {
        // 匹配格式：权重+关键词（如 "1.05开心"、"0.9悲伤"）
        const match = keywordStr.match(/^([0-9]+\.?[0-9]*)(.+)$/);

        if (match) {
            const weight = parseFloat(match[1]);
            const keyword = match[2];

            // 验证权重是否有效（大于0）且关键词非空
            if (!isNaN(weight) && weight > 0) {
                return { keyword, weight };
            }
        }

        // 默认返回原始字符串和权重1.0
        return { keyword: keywordStr, weight: 1.0 };
    }

    /**
     * 构建索引
     * @param {Array} kaomojis - kaomoji 数据数组
     */
    buildIndex(kaomojis) {
        this.documents = kaomojis.map(item => {
            // 解析关键词权重
            const keywordWeights = new Map(); // 存储关键词到权重的映射
            const keywords = item.keywords.map(kw => {
                const { keyword, weight } = this._parseKeywordWeight(kw);
                keywordWeights.set(keyword, weight);
                return keyword;
            });

            // 拆分所有keywords为单字（使用flatMap简化）
            const chars = keywords.flatMap(keyword => keyword.split(''));

            // 预计算词频以提高搜索性能
            const keywordFreq = new Map();
            for (const keyword of keywords) {
                keywordFreq.set(keyword, (keywordFreq.get(keyword) || 0) + 1);
            }

            const charFreq = new Map();
            for (const char of chars) {
                charFreq.set(char, (charFreq.get(char) || 0) + 1);
            }

            // 预计算多字关键词
            const multiCharKeywords = keywords.filter(kw => kw.length >= 2);

            // 预计算倒排索引：单字 -> 包含该单字的多字关键词列表（性能优化）
            const charToMultiCharKeywords = new Map();
            multiCharKeywords.forEach(kw => {
                // 使用 Set 确保每个关键词中的字符只处理一次
                [...new Set(kw.split(''))].forEach(char => {
                    if (!charToMultiCharKeywords.has(char)) {
                        charToMultiCharKeywords.set(char, []);
                    }
                    charToMultiCharKeywords.get(char).push(kw);
                });
            });

            return {
                kaomoji: item.kaomoji,
                keywords: keywords,      // 整词关键词（已解析，不含权重前缀）
                keywordWeights: keywordWeights,  // 关键词权重Map
                chars: chars,            // 单字关键词
                keywordFreq: keywordFreq,  // 整词词频Map
                charFreq: charFreq,        // 单字词频Map
                multiCharKeywords: multiCharKeywords,  // 预计算多字关键词
                charToMultiCharKeywords: charToMultiCharKeywords,  // 倒排索引：单字->多字关键词
                weight: item.weight || 1.0,
                category: item.category || ''
            };
        });

        // 计算平均文档长度（整词）
        const totalLength = this.documents.reduce((sum, doc) =>
            sum + doc.keywords.length, 0);
        this.avgDocLength = totalLength / this.documents.length;

        // 计算平均文档长度（单字）
        const totalCharLength = this.documents.reduce((sum, doc) =>
            sum + doc.chars.length, 0);
        this.avgCharDocLength = totalCharLength / this.documents.length;

        // 计算整词和单字的IDF
        this._calculateIDF();
    }

    /**
     * 计算 IDF (Inverse Document Frequency)
     * 分别计算整词和单字的IDF
     */
    _calculateIDF() {
        const termDocCount = new Map();
        const charDocCount = new Map();
        const N = this.documents.length;

        // 统计每个整词和单字出现在多少个文档中（合并循环提高效率）
        this.documents.forEach(doc => {
            const uniqueTerms = new Set(doc.keywords);
            uniqueTerms.forEach(term => {
                termDocCount.set(term, (termDocCount.get(term) || 0) + 1);
            });

            const uniqueChars = new Set(doc.chars);
            uniqueChars.forEach(char => {
                charDocCount.set(char, (charDocCount.get(char) || 0) + 1);
            });
        });

        // 计算整词 IDF: log((N - df + 0.5) / (df + 0.5) + 1)
        termDocCount.forEach((df, term) => {
            this.idf.set(term, Math.log((N - df + 0.5) / (df + 0.5) + 1));
        });

        // 计算单字 IDF: log((N - df + 0.5) / (df + 0.5) + 1)
        charDocCount.forEach((df, char) => {
            this.charIdf.set(char, Math.log((N - df + 0.5) / (df + 0.5) + 1));
        });
    }

    /**
     * 计算关键词权重
     * @param {Set} matchedKeywords - 匹配到的关键词集合
     * @param {Map} keywordWeights - 关键词权重Map
     * @returns {number} 关键词权重
     */
    _calculateKeywordWeight(matchedKeywords, keywordWeights) {
        if (matchedKeywords.size === 0) {
            return 1.0;
        }

        // 单次遍历查找最大和最小权重（性能优化）
        let maxWeight = -Infinity;
        let minWeight = Infinity;
        let hasGreaterThan1 = false;
        let hasLessThan1 = false;

        for (const kw of matchedKeywords) {
            const weight = keywordWeights.get(kw) || 1.0;
            if (weight > 1.0) {
                maxWeight = Math.max(maxWeight, weight);
                hasGreaterThan1 = true;
            } else if (weight < 1.0) {
                minWeight = Math.min(minWeight, weight);
                hasLessThan1 = true;
            }
        }

        // 如果既有大于1又有小于1，将最大和最小相乘
        if (hasGreaterThan1 && hasLessThan1) {
            return maxWeight * minWeight;
        }

        // 如果都大于1，取最大的
        if (hasGreaterThan1) {
            return maxWeight;
        }

        // 如果都小于1，取最小的
        if (hasLessThan1) {
            return minWeight;
        }

        // 如果只有等于1的，返回1.0
        return 1.0;
    }

    /**
     * 计算 BM25 分数（整词匹配优先 + 单字匹配补充）
     * @param {Array} queryTerms - 查询词列表
     * @param {Array} queryChars - 查询单字列表（去重）
     * @param {Array} singleCharQueries - 单字查询词列表（预提取，避免重复计算）
     * @param {Object} doc - 文档对象
     * @returns {number} BM25 分数
     */
    _calculateBM25(queryTerms, queryChars, singleCharQueries, doc) {
        // 1. 整词匹配分数
        let wholeWordScore = 0;
        const docLength = doc.keywords.length;

        // 记录哪些单字查询词已经在整词匹配中计分
        const scoredSingleChars = new Set();

        // 记录匹配到的关键词（用于计算关键词权重）
        const matchedKeywords = new Set();

        queryTerms.forEach(term => {
            // 使用预计算的词频Map（避免每次filter）
            const tf = doc.keywordFreq.get(term) || 0;

            if (tf === 0) return;

            // 记录匹配到的关键词
            matchedKeywords.add(term);

            // 获取 IDF
            const idf = this.idf.get(term) || 0;

            // BM25 公式
            const numerator = tf * (this.k1 + 1);
            const denominator = tf + this.k1 * (1 - this.b + this.b * (docLength / this.avgDocLength));

            wholeWordScore += idf * (numerator / denominator);
        });

        // 2. 单字查询词在多字关键词中的匹配（按整词匹配算分）
        // 使用预提取的单字查询词和预计算的倒排索引（O(1)查找，性能优化）
        singleCharQueries.forEach(singleChar => {
            // 通过倒排索引 O(1) 查找包含该单字的所有多字关键词
            const matchingKeywords = doc.charToMultiCharKeywords.get(singleChar) || [];

            if (matchingKeywords.length > 0) {
                // 记录匹配到的关键词
                matchingKeywords.forEach(kw => matchedKeywords.add(kw));

                // 计算该单字在这些多字关键词中的匹配分数
                // 词频 = 包含该单字的多字关键词的总词频
                const tf = matchingKeywords.reduce((sum, keyword) =>
                    sum + (doc.keywordFreq.get(keyword) || 0), 0);

                if (tf > 0) {
                    // 使用整词的IDF（如果有），否则使用单字的IDF
                    const idf = this.idf.get(singleChar) || this.charIdf.get(singleChar) || 0;

                    // BM25 公式（使用整词文档长度）
                    const numerator = tf * (this.k1 + 1);
                    const denominator = tf + this.k1 * (1 - this.b + this.b * (docLength / this.avgDocLength));

                    wholeWordScore += idf * (numerator / denominator);

                    // 标记该单字已经计分，避免在拆字匹配中重复计分
                    scoredSingleChars.add(singleChar);
                }
            }
        });

        // 3. 单字匹配分数（排除已经在整词匹配中计分的单字）
        let charScore = 0;
        const charDocLength = doc.chars.length;

        // 对单字进行BM25匹配（queryChars已去重，避免重复计分）
        queryChars.forEach(char => {
            // 如果该单字已经在整词匹配中计分，跳过
            if (scoredSingleChars.has(char)) {
                return;
            }

            // 使用预计算的单字词频Map
            const tf = doc.charFreq.get(char) || 0;

            if (tf === 0) return;

            // 获取单字 IDF
            const idf = this.charIdf.get(char) || 0;

            // BM25 公式
            const numerator = tf * (this.k1 + 1);
            const denominator = tf + this.k1 * (1 - this.b + this.b * (charDocLength / this.avgCharDocLength));

            charScore += idf * (numerator / denominator);
        });

        // 4. 组合分数：整词分数 + 单字分数 × 权重系数
        const totalScore = wholeWordScore + (charScore * this.charWeight);

        // 5. 计算关键词权重
        const keywordWeight = this._calculateKeywordWeight(matchedKeywords, doc.keywordWeights);

        // 6. 应用权重：最终得分 = 匹配分数 * 关键词权重 * 颜文字权重
        return totalScore * keywordWeight * doc.weight;
    }

    /**
     * 搜索匹配的 kaomoji
     * @param {string} text - 要搜索的文本
     * @param {number} topK - 返回前 K 个结果
     * @param {number} threshold - 最低分数阈值
     * @returns {Array} 匹配结果数组
     */
    search(text, topK = 5, threshold = 0) {
        if (!text || this.documents.length === 0) {
            return [];
        }

        // 提取查询词（简单分词，可以根据需求优化）
        const queryTerms = this._tokenize(text);

        if (queryTerms.length === 0) {
            return [];
        }

        // 转换为 Set 以提高查找效率 (O(1) vs O(n))
        const queryTermsSet = new Set(queryTerms);

        // 提取并去重查询单字（避免重复计分和重复计算）
        const queryChars = [...new Set(queryTerms.flatMap(term => term.split('')))];

        // 提取单字查询词（避免在每个文档中重复计算）
        const singleCharQueries = queryTerms.filter(term => term.length === 1);

        // 计算每个文档的分数
        const results = this.documents.map(doc => ({
            kaomoji: doc.kaomoji,
            score: this._calculateBM25(queryTerms, queryChars, singleCharQueries, doc),
            matchedKeywords: doc.keywords.filter(k => queryTermsSet.has(k)),
            category: doc.category
        }));

        // 过滤、排序并返回 top K
        // 注意：现在即使没有整词匹配，单字匹配也可能有分数，所以只检查 score > threshold
        return results
            .filter(r => r.score > threshold)
            .map(item => ({ item, random: Math.random() }))
            .sort((a, b) => (b.item.score - a.item.score) || (a.random - b.random))
            .map(({ item }) => item)
            .slice(0, topK);
    }

    /**
     * 简单分词函数
     * @param {string} text - 输入文本
     * @returns {Array} 词列表
     */
    _tokenize(text) {
        // 移除空格和标点
        const cleaned = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ');

        // 简单按空格分词（对于中文需要更复杂的分词，但这里保持简单）
        // 也包含所有可能的子串（对于短文本）
        const words = cleaned.split(/\s+/).filter(w => w.length > 0);

        // 对于中文，额外提取所有连续字符组合
        const chineseChars = text.match(/[\u4e00-\u9fa5]+/g) || [];
        chineseChars.forEach(chunk => {
            // 提取所有可能的词组合（2-4字）
            for (let len = 2; len <= Math.min(4, chunk.length); len++) {
                for (let i = 0; i <= chunk.length - len; i++) {
                    words.push(chunk.slice(i, i + len));
                }
            }
            // 也加入单字
            for (let char of chunk) {
                words.push(char);
            }
        });

        return [...new Set(words)]; // 去重
    }

    /**
     * 精确匹配关键词
     * @param {string} text - 输入文本
     * @returns {Array} 精确匹配的结果
     */
    exactMatch(text) {
        const results = [];

        this.documents.forEach(doc => {
            const matchedKeywords = doc.keywords.filter(keyword =>
                text.includes(keyword)
            );

            if (matchedKeywords.length > 0) {
                // 计算关键词权重
                const matchedKeywordsSet = new Set(matchedKeywords);
                const keywordWeight = this._calculateKeywordWeight(matchedKeywordsSet, doc.keywordWeights);

                // 计算得分：匹配数量 * 关键词权重 * 颜文字权重
                const score = matchedKeywords.length * keywordWeight * doc.weight;

                results.push({
                    kaomoji: doc.kaomoji,
                    matchedKeywords: matchedKeywords,
                    score: score,
                    category: doc.category
                });
            }
        });

        return results
            .map(item => ({ item, random: Math.random() }))
            .sort((a, b) => (b.item.score - a.item.score) || (a.random - b.random))
            .map(({ item }) => item);
    }
}

/**
 * KaomojiDataManager.js
 * 颜文字数据管理类 - 完整 CRUD
 */

class KaomojiDataManager {
    constructor() {
        this.kaomojis = [];
    }

    // ========== 数据加载 ==========

    /**
     * 从 JSON 字符串加载数据
     * @param {string} jsonString - JSON 字符串
     * @returns {KaomojiDataManager} 链式调用
     */
    loadFromJSON(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            return this.loadFromArray(data);
        } catch (error) {
            console.error('Failed to parse JSON:', error);
            throw new Error('Invalid JSON format');
        }
    }

    /**
     * 从对象数组加载数据
     * @param {Array} data - 颜文字数据数组
     * @returns {KaomojiDataManager} 链式调用
     */
    loadFromArray(data) {
        if (!Array.isArray(data)) {
            throw new Error('Data must be an array');
        }

        this.kaomojis = [];
        data.forEach((item, index) => {
            if (this._validateItem(item, index)) {
                this.kaomojis.push(this._normalizeItem(item));
            }
        });

        console.log(`Loaded ${this.kaomojis.length} kaomojis`);
        return this;
    }

    /**
     * 验证数据项
     * @private
     */
    _validateItem(item, index) {
        if (!item.kaomoji || typeof item.kaomoji !== 'string') {
            console.warn(`Item ${index}: Missing or invalid 'kaomoji' field, skipping`);
            return false;
        }

        if (!item.keywords || !Array.isArray(item.keywords) || item.keywords.length === 0) {
            console.warn(`Item ${index}: Missing or invalid 'keywords' field, skipping`);
            return false;
        }

        return true;
    }

    /**
     * 规范化数据项
     * @private
     */
    _normalizeItem(item) {
        return {
            kaomoji: item.kaomoji,
            keywords: item.keywords.map(k => String(k).trim()).filter(k => k.length > 0),
            weight: typeof item.weight === 'number' ? item.weight : 1.0,
            category: item.category || ''
        };
    }

    /**
     * 深拷贝单个颜文字对象
     * @private
     * @param {Object} item - 颜文字对象
     * @returns {Object} 深拷贝的对象
     */
    _deepCopy(item) {
        return {
            kaomoji: item.kaomoji,
            keywords: [...item.keywords],
            weight: item.weight,
            category: item.category
        };
    }

    // ========== 读取操作 ==========

    /**
     * 获取所有颜文字（深拷贝）
     * @returns {Array} 颜文字数组的深拷贝
     */
    getAllKaomojis() {
        return this.kaomojis.map(item => this._deepCopy(item));
    }

    /**
     * 通过颜文字文本查找（深拷贝）
     * @param {string} kaomoji - 颜文字文本
     * @returns {Object|null} 颜文字对象的深拷贝，未找到返回 null
     */
    getKaomojiByText(kaomoji) {
        const found = this.kaomojis.find(item => item.kaomoji === kaomoji);
        return found ? this._deepCopy(found) : null;
    }

    /**
     * 获取所有关键词列表（去重）
     * @returns {Array} 关键词数组
     */
    getAllKeywords() {
        const keywords = new Set();
        this.kaomojis.forEach(item => {
            item.keywords.forEach(keyword => keywords.add(keyword));
        });
        return Array.from(keywords).sort();
    }

    /**
     * 获取特定颜文字的关键词
     * @param {string} kaomoji - 颜文字文本
     * @returns {Array} 关键词数组，未找到返回空数组
     */
    getKeywordsByKaomoji(kaomoji) {
        const item = this.kaomojis.find(e => e.kaomoji === kaomoji);
        return item ? [...item.keywords] : [];
    }

    /**
     * 按分类筛选（深拷贝）
     * @param {string|Array} category - 分类名称或分类数组
     * @returns {Array} 筛选后的颜文字数组的深拷贝
     */
    filterByCategory(category) {
        const categories = Array.isArray(category) ? category : [category];
        return this.kaomojis
            .filter(item => categories.includes(item.category))
            .map(item => this._deepCopy(item));
    }

    /**
     * 获取所有分类列表（去重）
     * @returns {Array} 分类数组
     */
    getAllCategories() {
        const categories = new Set();
        this.kaomojis.forEach(item => {
            if (item.category) {
                categories.add(item.category);
            }
        });
        return Array.from(categories).sort();
    }

    /**
     * 搜索包含特定关键词的颜文字（深拷贝）
     * @param {string|Array} keyword - 关键词或关键词数组（多个关键词使用 AND 逻辑）
     * @returns {Array} 包含该关键词的颜文字数组的深拷贝
     */
    findByKeyword(keyword) {
        const keywords = (Array.isArray(keyword) ? keyword : [keyword])
            .map(k => String(k || '').trim())
            .filter(k => k.length > 0);

        if (keywords.length === 0) {
            return [];
        }

        return this.kaomojis
            .filter(item => keywords.every(k => item.keywords.includes(k)))
            .map(item => this._deepCopy(item));
    }

    /**
     * 获取数据统计信息
     * @returns {Object} 统计数据
     */
    getStats() {
        return {
            totalKaomojis: this.kaomojis.length,
            totalKeywords: this.getAllKeywords().length,
            totalCategories: this.getAllCategories().length,
            averageKeywordsPerKaomoji: this.kaomojis.length > 0
                ? this.kaomojis.reduce((sum, e) => sum + e.keywords.length, 0) / this.kaomojis.length
                : 0
        };
    }

    // ========== 修改操作 ==========

    /**
     * 添加关键词
     * @param {string} kaomoji - 颜文字文本
     * @param {string} keyword - 要添加的关键词
     * @returns {boolean} 是否成功
     */
    addKeyword(kaomoji, keyword) {
        const item = this.kaomojis.find(e => e.kaomoji === kaomoji);
        if (!item) {
            console.warn(`Kaomoji "${kaomoji}" not found`);
            return false;
        }

        const trimmedKeyword = String(keyword).trim();
        if (!trimmedKeyword) {
            console.warn('Keyword cannot be empty');
            return false;
        }

        if (item.keywords.includes(trimmedKeyword)) {
            console.warn(`Keyword "${trimmedKeyword}" already exists`);
            return false;
        }

        item.keywords.push(trimmedKeyword);
        return true;
    }

    /**
     * 删除关键词
     * @param {string} kaomoji - 颜文字文本
     * @param {string} keyword - 要删除的关键词
     * @returns {boolean} 是否成功
     */
    removeKeyword(kaomoji, keyword) {
        const item = this.kaomojis.find(e => e.kaomoji === kaomoji);
        if (!item) {
            console.warn(`Kaomoji "${kaomoji}" not found`);
            return false;
        }

        const index = item.keywords.indexOf(keyword);
        if (index === -1) {
            console.warn(`Keyword "${keyword}" not found`);
            return false;
        }

        if (item.keywords.length <= 1) {
            console.warn('Cannot remove the last keyword');
            return false;
        }

        item.keywords.splice(index, 1);
        return true;
    }

    /**
     * 批量更新关键词
     * @param {string} kaomoji - 颜文字文本
     * @param {Array} keywords - 新的关键词数组
     * @returns {boolean} 是否成功
     */
    updateKeywords(kaomoji, keywords) {
        const item = this.kaomojis.find(e => e.kaomoji === kaomoji);
        if (!item) {
            console.warn(`Kaomoji "${kaomoji}" not found`);
            return false;
        }

        if (!Array.isArray(keywords) || keywords.length === 0) {
            console.warn('Keywords must be a non-empty array');
            return false;
        }

        const validKeywords = keywords
            .map(k => String(k).trim())
            .filter(k => k.length > 0);

        if (validKeywords.length === 0) {
            console.warn('No valid keywords provided');
            return false;
        }

        item.keywords = validKeywords;
        return true;
    }

    /**
     * 设置分类
     * @param {string} kaomoji - 颜文字文本
     * @param {string} category - 分类名称
     * @returns {boolean} 是否成功
     */
    setCategory(kaomoji, category) {
        const item = this.kaomojis.find(e => e.kaomoji === kaomoji);
        if (!item) {
            console.warn(`Kaomoji "${kaomoji}" not found`);
            return false;
        }

        item.category = category || '';
        return true;
    }

    /**
     * 设置权重
     * @param {string} kaomoji - 颜文字文本
     * @param {number} weight - 权重值
     * @returns {boolean} 是否成功
     */
    setWeight(kaomoji, weight) {
        const item = this.kaomojis.find(e => e.kaomoji === kaomoji);
        if (!item) {
            console.warn(`Kaomoji "${kaomoji}" not found`);
            return false;
        }

        if (typeof weight !== 'number' || weight <= 0) {
            console.warn('Weight must be a positive number');
            return false;
        }

        item.weight = weight;
        return true;
    }

    // ========== 颜文字管理 ==========

    /**
     * 添加新颜文字
     * @param {Object} data - 颜文字数据 { kaomoji, keywords, weight?, category? }
     * @returns {boolean} 是否成功
     */
    addKaomoji(data) {
        if (!this._validateItem(data, 'new')) {
            return false;
        }

        // 检查是否已存在
        if (this.kaomojis.find(e => e.kaomoji === data.kaomoji)) {
            console.warn(`Kaomoji "${data.kaomoji}" already exists`);
            return false;
        }

        this.kaomojis.push(this._normalizeItem(data));
        return true;
    }

    /**
     * 删除颜文字
     * @param {string} kaomoji - 颜文字文本
     * @returns {boolean} 是否成功
     */
    removeKaomoji(kaomoji) {
        const index = this.kaomojis.findIndex(e => e.kaomoji === kaomoji);
        if (index === -1) {
            console.warn(`Kaomoji "${kaomoji}" not found`);
            return false;
        }

        this.kaomojis.splice(index, 1);
        return true;
    }

    /**
     * 更新颜文字完整数据
     * @param {string} kaomoji - 原颜文字文本
     * @param {Object} newData - 新数据
     * @returns {boolean} 是否成功
     */
    updateKaomoji(kaomoji, newData) {
        const index = this.kaomojis.findIndex(e => e.kaomoji === kaomoji);
        if (index === -1) {
            console.warn(`Kaomoji "${kaomoji}" not found`);
            return false;
        }

        if (!this._validateItem(newData, 'update')) {
            return false;
        }

        // 如果更改了 kaomoji 文本，检查新文本是否已存在
        if (newData.kaomoji !== kaomoji) {
            if (this.kaomojis.find(e => e.kaomoji === newData.kaomoji)) {
                console.warn(`Kaomoji "${newData.kaomoji}" already exists`);
                return false;
            }
        }

        this.kaomojis[index] = this._normalizeItem(newData);
        return true;
    }

    // ========== 数据导出 ==========

    /**
     * 导出为 JSON 字符串
     * @param {boolean} pretty - 是否格式化输出
     * @returns {string} JSON 字符串
     */
    exportToJSON(pretty = true) {
        return JSON.stringify(this.kaomojis, null, pretty ? 2 : 0);
    }

    /**
     * 导出为对象数组
     * @returns {Array} 颜文字数组的深拷贝
     */
    exportToArray() {
        return this.kaomojis.map(item => ({ ...item, keywords: [...item.keywords] }));
    }

    // ========== 批量操作 ==========

    /**
     * 批量修改分类
     * @param {Array} kaomojis - 颜文字文本数组
     * @param {string} category - 分类名称
     * @returns {number} 成功修改的数量
     */
    batchSetCategory(kaomojis, category) {
        let count = 0;
        kaomojis.forEach(kaomoji => {
            if (this.setCategory(kaomoji, category)) {
                count++;
            }
        });
        return count;
    }

    /**
     * 批量删除颜文字
     * @param {Array} kaomojis - 颜文字文本数组
     * @returns {number} 成功删除的数量
     */
    batchRemove(kaomojis) {
        let count = 0;
        kaomojis.forEach(kaomoji => {
            if (this.removeKaomoji(kaomoji)) {
                count++;
            }
        });
        return count;
    }

    /**
     * 清空所有数据
     */
    clear() {
        this.kaomojis = [];
    }
}

/**
 * IndexedDBStorage.js
 * 前端 IndexedDB 存储管理
 * 用于在浏览器中持久化颜文字数据
 */

const DB_NAME = 'KaomojiReplacerDB';
const DB_VERSION = 1;
const STORE_NAME = 'kaomojis';
const DATA_KEY = 'kaomoji_data';

// 调试开关（默认关闭）
let DEBUG_MODE = false;

/**
 * 设置调试模式
 * @param {boolean} enabled - 是否启用调试模式
 */
function setDebugMode$1(enabled) {
    DEBUG_MODE = enabled;
}

/**
 * 调试日志（仅在调试模式开启时输出）
 */
function debugLog(message, ...args) {
    if (DEBUG_MODE) {
        console.log(`[KaomojiReplacer] ${message}`, ...args);
    }
}

function debugWarn(message, ...args) {
    if (DEBUG_MODE) {
        console.warn(`[KaomojiReplacer] ${message}`, ...args);
    }
}

function debugError(message, ...args) {
    // 错误总是输出，但在非调试模式下简化
    if (DEBUG_MODE) {
        console.error(`[KaomojiReplacer] ${message}`, ...args);
    } else {
        console.error(`[KaomojiReplacer] ${message}`);
    }
}

/**
 * 打开 IndexedDB 连接
 * @returns {Promise<IDBDatabase>}
 */
function openDatabase() {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB is not supported in this environment'));
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            reject(new Error('Failed to open IndexedDB'));
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // 创建对象存储
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
}

/**
 * 从 IndexedDB 读取颜文字数据
 * @returns {Promise<Array|null>} 颜文字数组，不存在返回 null
 */
async function getKaomojis$1() {
    try {
        const db = await openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(DATA_KEY);

            transaction.oncomplete = () => {
                db.close();
            };

            transaction.onerror = () => {
                db.close();
                reject(new Error('Transaction failed'));
            };

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = () => {
                reject(new Error('Failed to read from IndexedDB'));
            };
        });
    } catch (error) {
        debugError('Error reading from IndexedDB:', error);
        return null;
    }
}

/**
 * 保存颜文字数据到 IndexedDB
 * @param {Array} data - 颜文字数组
 * @returns {Promise<boolean>} 是否成功
 */
async function saveKaomojis$1(data) {
    if (!Array.isArray(data)) {
        debugError('Data must be an array');
        return false;
    }

    try {
        const db = await openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(data, DATA_KEY);

            transaction.oncomplete = () => {
                db.close();
                debugLog(`Saved ${data.length} kaomojis to IndexedDB`);
                resolve(true);
            };

            transaction.onerror = () => {
                db.close();
                reject(new Error('Transaction failed'));
            };

            request.onerror = () => {
                reject(new Error('Failed to save to IndexedDB'));
            };
        });
    } catch (error) {
        debugError('Error saving to IndexedDB:', error);
        return false;
    }
}

/**
 * 清空 IndexedDB 中的颜文字数据
 * @returns {Promise<boolean>} 是否成功
 */
async function clearKaomojis$1() {
    try {
        const db = await openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(DATA_KEY);

            transaction.oncomplete = () => {
                db.close();
                debugLog('Cleared kaomojis from IndexedDB');
                resolve(true);
            };

            transaction.onerror = () => {
                db.close();
                reject(new Error('Transaction failed'));
            };

            request.onerror = () => {
                reject(new Error('Failed to clear IndexedDB'));
            };
        });
    } catch (error) {
        debugError('Error clearing IndexedDB:', error);
        return false;
    }
}

/**
 * 从远程 URL 加载默认数据
 * @param {string} url - 数据 URL
 * @returns {Promise<Array|null>} 颜文字数组，失败返回 null
 */
async function loadFromRemote(url) {
    try {
        const response = await fetch(url);

        if (!response.ok) {
            debugWarn(`Failed to fetch from ${url}: ${response.status}`);
            return null;
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            debugWarn('Remote data is not an array');
            return null;
        }

        return data;
    } catch (error) {
        debugWarn('Failed to load from remote:', error);
        return null;
    }
}

/**
 * 初始化颜文字存储
 * - 如果 IndexedDB 中已有数据，直接返回
 * - 如果没有，尝试从远程 URL 加载并保存
 * - 远程加载失败则返回空数组
 *
 * @param {Object} options - 配置选项
 * @param {string} options.defaultURL - 默认数据的远程 URL
 * @param {boolean} options.forceReload - 是否强制重新加载（忽略缓存）
 * @returns {Promise<Array>} 颜文字数组
 */
async function initKaomojiStorage$1(options = {}) {
    const {
        defaultURL = null,
        forceReload = false
    } = options;

    try {
        // 检查 IndexedDB 是否已有数据
        if (!forceReload) {
            const existingData = await getKaomojis$1();
            if (existingData && existingData.length > 0) {
                debugLog(`Loaded ${existingData.length} kaomojis from IndexedDB cache`);
                return existingData;
            }
        }

        // 如果没有数据且提供了远程 URL，尝试加载
        if (defaultURL) {
            debugLog(`Loading default kaomojis from ${defaultURL}...`);
            const remoteData = await loadFromRemote(defaultURL);

            if (remoteData && remoteData.length > 0) {
                // 保存到 IndexedDB
                await saveKaomojis$1(remoteData);
                debugLog(`Initialized with ${remoteData.length} kaomojis from remote`);
                return remoteData;
            } else {
                debugWarn('Failed to load from remote, returning empty array');
            }
        }

        // 返回空数组
        return [];
    } catch (error) {
        debugError('Error initializing kaomoji storage:', error);
        return [];
    }
}

/**
 * 获取存储统计信息
 * @returns {Promise<Object>} 统计信息
 */
async function getStorageStats$1() {
    try {
        const data = await getKaomojis$1();

        return {
            hasData: data !== null,
            count: data ? data.length : 0,
            sizeKB: data ? (JSON.stringify(data).length / 1024).toFixed(2) : '0.00'
        };
    } catch (error) {
        return {
            hasData: false,
            count: 0,
            sizeKB: 0,
            error: error.message
        };
    }
}

var IndexedDBStorage = /*#__PURE__*/Object.freeze({
    __proto__: null,
    clearKaomojis: clearKaomojis$1,
    getKaomojis: getKaomojis$1,
    getStorageStats: getStorageStats$1,
    initKaomojiStorage: initKaomojiStorage$1,
    saveKaomojis: saveKaomojis$1,
    setDebugMode: setDebugMode$1
});

/**
 * Kaomoji Replacer - Unified API Entry Point
 *
 * 提供多种导入和使用方式：
 * 1. 类导入：const { KaomojiReplacer, SearchEngine, KaomojiDataManager } = require('kaomoji-replacer');
 * 2. 工厂函数：const { createReplacer, createManager } = require('kaomoji-replacer');
 * 3. 快捷 API：const { quickReplace } = require('kaomoji-replacer');
 */


// ========== 工厂函数 ==========

/**
 * 创建一个完整配置的 KaomojiReplacer 实例
 * @param {Object} options - 配置选项
 * @param {Array} options.kaomojis - 颜文字数据数组
 * @param {string} options.jsonData - JSON 格式的颜文字数据
 * @param {Object} options.searchConfig - SearchEngine 配置 { k1, b }
 * @param {Object} options.replaceConfig - KaomojiReplacer 配置
 * @returns {KaomojiReplacer} 配置好的 KaomojiReplacer 实例
 */
function createReplacer(options = {}) {
    const {
        kaomojis = [],
        jsonData = null,
        searchConfig = {},
        replaceConfig = {}
    } = options;

    // 创建搜索引擎
    const searchEngine = new SearchEngine(searchConfig);

    // 创建替换器
    const replacer = new KaomojiReplacer(searchEngine);

    // 应用配置
    if (replaceConfig) {
        replacer.setConfig(replaceConfig);
    }

    // 加载数据
    if (jsonData) {
        const manager = new KaomojiDataManager();
        manager.loadFromJSON(jsonData);
        replacer.loadKaomojis(manager.getAllKaomojis());
    } else if (kaomojis.length > 0) {
        replacer.loadKaomojis(kaomojis);
    }

    return replacer;
}

/**
 * 创建 KaomojiDataManager 实例并加载数据
 * @param {Array|string} data - 颜文字数据数组或 JSON 字符串
 * @returns {KaomojiDataManager} 加载好数据的 KaomojiDataManager 实例
 */
function createManager(data = null) {
    const manager = new KaomojiDataManager();

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
 * @param {Array|string} kaomojis - 颜文字数据（数组或 JSON 字符串）
 * @param {Object} options - 替换选项
 * @returns {Object} 替换结果
 */
function quickReplace(text, kaomojis, options = {}) {
    const replacer = createReplacer({
        kaomojis: Array.isArray(kaomojis) ? kaomojis : [],
        jsonData: typeof kaomojis === 'string' ? kaomojis : null,
        searchConfig: options.searchConfig,
        replaceConfig: options.replaceConfig
    });

    return replacer.replaceText(text, options);
}

/**
 * 快速查询关键词对应的颜文字
 * @param {string} keywords - 关键词
 * @param {Array|string} kaomojis - 颜文字数据
 * @param {number} topK - 返回前 K 个结果
 * @returns {Array} 匹配结果
 */
function quickQuery(keywords, kaomojis, topK = 5) {
    const replacer = createReplacer({
        kaomojis: Array.isArray(kaomojis) ? kaomojis : [],
        jsonData: typeof kaomojis === 'string' ? kaomojis : null
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
    if (typeof process === 'undefined') {
        throw new Error('loadFromFile is only available in Node.js environment');
    }

    const { promises: fs } = await import('fs');
    const fileContent = await fs.readFile(filePath, 'utf8');
    const manager = new KaomojiDataManager();
    manager.loadFromJSON(fileContent);
    return manager.getAllKaomojis();
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
    const manager = new KaomojiDataManager();
    manager.loadFromJSON(jsonText);
    return manager.getAllKaomojis();
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

        if (!item.kaomoji || typeof item.kaomoji !== 'string') {
            errors.push(`Item ${index}: Missing or invalid 'kaomoji' field`);
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
 * @param {Array|string} kaomojis - 颜文字数据
 * @param {Object} options - 替换选项
 * @returns {Array} 处理结果数组
 */
function batchReplace(texts, kaomojis, options = {}) {
    const replacer = createReplacer({
        kaomojis: Array.isArray(kaomojis) ? kaomojis : [],
        jsonData: typeof kaomojis === 'string' ? kaomojis : null,
        searchConfig: options.searchConfig,
        replaceConfig: options.replaceConfig
    });

    return replacer.replaceMultiple(texts, options);
}

// ========== 常量 ==========

const VERSION = '1.2.2';

const DEFAULT_CONFIG = {
    search: {
        k1: 1.5,
        b: 0.75
    },
    replace: {
        markerPattern: /\[kaomoji:([^\]]+)\]/gi,
        keywordSeparator: ',',
        replaceStrategy: 'best'
    }
};

const REPLACE_STRATEGIES = {
    FIRST: 'first',    // 使用第一个匹配结果
    BEST: 'best',      // 使用最佳匹配结果（默认）
    ALL: 'all'         // 返回所有匹配结果
};

// 导出 IndexedDB 存储函数（解构便于使用）
const {
    initKaomojiStorage,
    getKaomojis,
    saveKaomojis,
    clearKaomojis,
    getStorageStats,
    setDebugMode
} = IndexedDBStorage;

exports.DEFAULT_CONFIG = DEFAULT_CONFIG;
exports.IndexedDBStorage = IndexedDBStorage;
exports.KaomojiDataManager = KaomojiDataManager;
exports.KaomojiReplacer = KaomojiReplacer;
exports.REPLACE_STRATEGIES = REPLACE_STRATEGIES;
exports.SearchEngine = SearchEngine;
exports.VERSION = VERSION;
exports.batchReplace = batchReplace;
exports.clearKaomojis = clearKaomojis;
exports.createManager = createManager;
exports.createReplacer = createReplacer;
exports.createSearchEngine = createSearchEngine;
exports.getKaomojis = getKaomojis;
exports.getStorageStats = getStorageStats;
exports.initKaomojiStorage = initKaomojiStorage;
exports.loadFromFile = loadFromFile;
exports.loadFromURL = loadFromURL;
exports.quickQuery = quickQuery;
exports.quickReplace = quickReplace;
exports.saveKaomojis = saveKaomojis;
exports.setDebugMode = setDebugMode;
exports.validateData = validateData;
