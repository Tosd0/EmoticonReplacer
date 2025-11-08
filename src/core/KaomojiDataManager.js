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
     * @param {string} keyword - 关键词
     * @returns {Array} 包含该关键词的颜文字数组的深拷贝
     */
    findByKeyword(keyword) {
        return this.kaomojis
            .filter(item => item.keywords.includes(keyword))
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

// ES Modules 导出
export default KaomojiDataManager;
