/**
 * EmoticonReplacer.js
 * 核心替换引擎 - 可独立使用，不依赖任何框架
 * 负责检测文本中的标记并替换为对应的 emoticon
 */

class EmoticonReplacer {
    constructor(searchEngine) {
        this.searchEngine = searchEngine;

        // 标记格式配置
        this.config = {
            // 标记的正则表达式: [emoticon:关键词1,关键词2,...]
            markerPattern: /\[emoticon:([^\]]+)\]/gi,
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
     * 加载 emoticon 数据
     * @param {Array} emoticons - emoticon 数据数组
     */
    loadEmoticons(emoticons) {
        this.searchEngine.buildIndex(emoticons);
    }

    /**
     * 处理文本，替换所有标记为 emoticon
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

            // 搜索匹配的 emoticon
            const searchText = keywords.join(' ');
            const matches = this.searchEngine.search(searchText, 5, threshold);

            let replacement = '';
            let selectedEmoticon = null;

            if (matches.length > 0) {
                // 根据策略选择 emoticon
                switch (strategy) {
                    case 'first':
                        selectedEmoticon = matches[0];
                        replacement = matches[0].emoticon;
                        break;

                    case 'best':
                        // 选择分数最高的
                        selectedEmoticon = matches[0];
                        replacement = matches[0].emoticon;
                        break;

                    case 'all':
                        // 返回所有匹配的 emoticon
                        replacement = matches.map(m => m.emoticon).join(' ');
                        selectedEmoticon = matches;
                        break;

                    default:
                        selectedEmoticon = matches[0];
                        replacement = matches[0].emoticon;
                }

                // 记录替换信息
                replacements.push({
                    index: matchIndex++,
                    original: match,
                    keywords: keywords,
                    emoticon: replacement,
                    offset: offset,
                    matches: matches,
                    selected: selectedEmoticon
                });

                return replacement;
            } else {
                // 没有找到匹配的 emoticon
                replacements.push({
                    index: matchIndex++,
                    original: match,
                    keywords: keywords,
                    emoticon: null,
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
     * 查询关键词对应的 emoticon（不需要标记格式）
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
            totalEmoticons: this.searchEngine.documents.length,
            avgDocLength: this.searchEngine.avgDocLength,
            config: { ...this.config }
        };
    }
}

// 导出（支持 CommonJS 和 ES6）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EmoticonReplacer;
}
if (typeof window !== 'undefined') {
    window.EmoticonReplacer = EmoticonReplacer;
}
