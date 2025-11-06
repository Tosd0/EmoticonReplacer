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

        // 索引数据
        this.documents = [];         // 文档列表（每个emoticon的keywords作为一个文档）
        this.avgDocLength = 0;       // 平均文档长度
        this.idf = new Map();        // IDF 值缓存
    }

    /**
     * 构建索引
     * @param {Array} emoticons - emoticon 数据数组
     */
    buildIndex(emoticons) {
        this.documents = emoticons.map(item => ({
            emoticon: item.emoticon,
            keywords: [...item.keywords],
            weight: item.weight || 1.0,
            category: item.category || ''
        }));

        // 计算平均文档长度
        const totalLength = this.documents.reduce((sum, doc) =>
            sum + doc.keywords.length, 0);
        this.avgDocLength = totalLength / this.documents.length;

        // 计算 IDF
        this._calculateIDF();
    }

    /**
     * 计算 IDF (Inverse Document Frequency)
     */
    _calculateIDF() {
        const termDocCount = new Map();
        const N = this.documents.length;

        // 统计每个词出现在多少个文档中
        this.documents.forEach(doc => {
            const uniqueTerms = new Set(doc.keywords);
            uniqueTerms.forEach(term => {
                termDocCount.set(term, (termDocCount.get(term) || 0) + 1);
            });
        });

        // 计算 IDF: log((N - df + 0.5) / (df + 0.5) + 1)
        termDocCount.forEach((df, term) => {
            this.idf.set(term, Math.log((N - df + 0.5) / (df + 0.5) + 1));
        });
    }

    /**
     * 计算 BM25 分数
     * @param {Array} queryTerms - 查询词列表
     * @param {Object} doc - 文档对象
     * @returns {number} BM25 分数
     */
    _calculateBM25(queryTerms, doc) {
        let score = 0;
        const docLength = doc.keywords.length;

        queryTerms.forEach(term => {
            // 计算词频 (TF)
            const tf = doc.keywords.filter(k => k === term).length;

            if (tf === 0) return;

            // 获取 IDF
            const idf = this.idf.get(term) || 0;

            // BM25 公式
            const numerator = tf * (this.k1 + 1);
            const denominator = tf + this.k1 * (1 - this.b + this.b * (docLength / this.avgDocLength));

            score += idf * (numerator / denominator);
        });

        // 应用权重
        return score * doc.weight;
    }

    /**
     * 搜索匹配的 emoticon
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

        // 计算每个文档的分数
        const results = this.documents.map(doc => ({
            emoticon: doc.emoticon,
            score: this._calculateBM25(queryTerms, doc),
            matchedKeywords: doc.keywords.filter(k => queryTermsSet.has(k)),
            category: doc.category
        }));

        // 过滤、排序并返回 top K
        return results
            .filter(r => r.score > threshold && r.matchedKeywords.length > 0)
            .sort((a, b) => b.score - a.score)
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
                results.push({
                    emoticon: doc.emoticon,
                    matchedKeywords: matchedKeywords,
                    score: matchedKeywords.length * doc.weight,
                    category: doc.category
                });
            }
        });

        return results.sort((a, b) => b.score - a.score);
    }
}

// 导出（支持 CommonJS 和 ES6）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SearchEngine;
}
if (typeof window !== 'undefined') {
    window.SearchEngine = SearchEngine;
}
