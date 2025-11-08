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
     * 构建索引
     * @param {Array} kaomojis - kaomoji 数据数组
     */
    buildIndex(kaomojis) {
        this.documents = kaomojis.map(item => {
            const keywords = [...item.keywords];
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
                keywords: keywords,      // 整词关键词
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

        queryTerms.forEach(term => {
            // 使用预计算的词频Map（避免每次filter）
            const tf = doc.keywordFreq.get(term) || 0;

            if (tf === 0) return;

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

        // 应用权重
        return totalScore * doc.weight;
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
                    kaomoji: doc.kaomoji,
                    matchedKeywords: matchedKeywords,
                    score: matchedKeywords.length * doc.weight,
                    category: doc.category
                });
            }
        });

        return results.sort((a, b) => b.score - a.score);
    }
}

// ES Modules 导出
export default SearchEngine;
