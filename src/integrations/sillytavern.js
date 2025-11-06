/**
 * sillytavern.js
 * SillyTavern 集成层
 */

// SillyTavern Extension 主类
class EmoticonReplacerExtension {
    constructor() {
        this.extensionName = 'emoticon-replacer';
        this.replacer = null;
        this.searchEngine = null;
        this.settings = {
            enabled: true,
            autoProcess: true,              // 是否自动处理新消息
            modifyMode: 'display',          // 'display' 或 'content'
            processUserMessages: false,      // 是否处理用户消息
            processAIMessages: true,         // 是否处理 AI 消息
            replaceStrategy: 'best',        // 'first', 'best', 'all'
            keepOriginalOnNotFound: true,   // 找不到时保留原标记
            markNotFound: false,            // 找不到时标记为 [?...]
            dataPath: 'scripts/extensions/emoticon-replacer/data/emoticons.json'
        };

        this.isInitialized = false;
    }

    /**
     * 初始化扩展
     */
    async init() {
        console.log('Initializing Emoticon Replacer Extension...');

        try {
            // 加载核心模块
            await this.loadModules();

            // 加载数据
            await this.loadEmoticonData();

            // 注册事件监听器
            this.registerEventListeners();

            // 创建 UI
            this.createUI();

            this.isInitialized = true;
            console.log('Emoticon Replacer Extension initialized successfully');

            return true;
        } catch (error) {
            console.error('Failed to initialize Emoticon Replacer Extension:', error);
            return false;
        }
    }

    /**
     * 加载核心模块
     */
    async loadModules() {
        // 注意: 实际使用时需要确保这些文件已经被加载
        // 可以通过 HTML script 标签或动态加载
        if (typeof SearchEngine === 'undefined' ||
            typeof EmoticonReplacer === 'undefined' ||
            typeof EmoticonDataManager === 'undefined') {
            throw new Error('Core modules not loaded. Please include SearchEngine.js, EmoticonReplacer.js, and EmoticonDataManager.js');
        }

        this.searchEngine = new SearchEngine();
        this.replacer = new EmoticonReplacer(this.searchEngine);
        this.replacer.setConfig({
            replaceStrategy: this.settings.replaceStrategy
        });
    }

    /**
     * 加载 emoticon 数据（带回退机制）
     */
    async loadEmoticonData() {
        const manager = new EmoticonDataManager();

        try {
            // 尝试加载用户自定义数据
            const response = await fetch(this.settings.dataPath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const jsonText = await response.text();
            manager.loadFromJSON(jsonText);

            const data = manager.getAllEmoticons();
            this.replacer.loadEmoticons(data);
            console.log(`Loaded ${data.length} emoticons from ${this.settings.dataPath}`);

        } catch (error) {
            console.warn('Failed to load custom emoticon data, trying template:', error.message);

            try {
                // 回退：尝试加载模板数据
                const templatePath = this.settings.dataPath.replace('emoticons.json', 'emoticons.template.json');
                const response = await fetch(templatePath);

                if (!response.ok) {
                    throw new Error(`Template not found: ${response.status}`);
                }

                const jsonText = await response.text();
                manager.loadFromJSON(jsonText);

                const data = manager.getAllEmoticons();
                this.replacer.loadEmoticons(data);
                console.log(`Loaded ${data.length} emoticons from template (fallback)`);

            } catch (fallbackError) {
                console.error('Failed to load template data:', fallbackError);
                throw new Error('No emoticon data available. Please create emoticons.json or check emoticons.template.json');
            }
        }
    }

    /**
     * 注册 SillyTavern 事件监听器
     */
    registerEventListeners() {
        // 监听消息发送后事件
        if (typeof eventSource !== 'undefined') {
            eventSource.on(event_types.MESSAGE_RECEIVED, (messageId) => {
                if (this.settings.enabled && this.settings.autoProcess) {
                    this.processMessage(messageId);
                }
            });

            eventSource.on(event_types.MESSAGE_SENT, (messageId) => {
                if (this.settings.enabled && this.settings.autoProcess && this.settings.processUserMessages) {
                    this.processMessage(messageId);
                }
            });
        }
    }

    /**
     * 处理单条消息
     * @param {number} messageId - 消息索引
     */
    async processMessage(messageId) {
        try {
            const context = getContext();
            const message = context.chat[messageId];

            if (!message) {
                console.warn('Message not found:', messageId);
                return false;
            }

            // 检查是否应该处理此消息
            if (!this.shouldProcessMessage(message)) {
                return false;
            }

            // 获取原始消息文本
            const originalText = message.mes;

            // 执行替换
            const result = this.replacer.replaceText(originalText, {
                strategy: this.settings.replaceStrategy,
                keepOriginalOnNotFound: this.settings.keepOriginalOnNotFound,
                markNotFound: this.settings.markNotFound
            });

            // 如果没有替换，直接返回
            if (!result.hasReplacements || result.successCount === 0) {
                return false;
            }

            // 根据模式应用替换
            if (this.settings.modifyMode === 'display') {
                await this.modifyMessageDisplay(messageId, result.text, originalText);
            } else {
                await this.modifyMessageContent(messageId, result.text, originalText);
            }

            console.log(`Processed message ${messageId}: ${result.successCount} replacements`);
            return true;

        } catch (error) {
            console.error('Error processing message:', error);
            return false;
        }
    }

    /**
     * 判断是否应该处理此消息
     * @param {Object} message - 消息对象
     * @returns {boolean}
     */
    shouldProcessMessage(message) {
        if (message.is_system) return false;

        if (message.is_user && !this.settings.processUserMessages) {
            return false;
        }

        if (!message.is_user && !this.settings.processAIMessages) {
            return false;
        }

        return true;
    }

    /**
     * 方案一：仅修改显示层
     */
    async modifyMessageDisplay(messageId, displayContent, originalContent) {
        const context = getContext();
        const message = context.chat[messageId];

        if (!message) return false;

        // 初始化 extra 对象
        if (!message.extra) {
            message.extra = {};
        }

        // 备份原始内容（如果还没有备份）
        if (!message.extra.emoticon_original) {
            message.extra.emoticon_original = originalContent;
        }

        // 设置显示文本
        message.extra.display_text = displayContent;

        // 更新 UI 显示
        updateMessageBlock(Number(messageId), message);

        // 保存聊天记录
        await context.saveChat();

        return true;
    }

    /**
     * 方案二：直接修改消息内容
     */
    async modifyMessageContent(messageId, newContent, originalContent) {
        const context = getContext();
        const message = context.chat[messageId];

        if (!message) return false;

        // 初始化 extra 对象
        if (!message.extra) {
            message.extra = {};
        }

        // 备份原始内容
        if (!message.extra.emoticon_original) {
            message.extra.emoticon_original = originalContent;
        }

        // 直接修改消息内容
        message.mes = newContent;

        // 更新 UI 显示
        updateMessageBlock(Number(messageId), message);

        // 保存聊天记录
        await context.saveChat();

        // 触发消息编辑事件
        if (typeof eventSource !== 'undefined') {
            await eventSource.emit(event_types.MESSAGE_EDITED, messageId);
        }

        return true;
    }

    /**
     * 恢复消息原始内容
     * @param {number} messageId - 消息索引
     */
    async restoreMessage(messageId) {
        const context = getContext();
        const message = context.chat[messageId];

        if (!message?.extra?.emoticon_original) {
            return false;
        }

        const originalContent = message.extra.emoticon_original;

        if (this.settings.modifyMode === 'display') {
            delete message.extra.display_text;
        } else {
            message.mes = originalContent;
        }

        delete message.extra.emoticon_original;

        updateMessageBlock(Number(messageId), message);
        await context.saveChat();

        return true;
    }

    /**
     * 批量处理所有消息
     */
    async processAllMessages() {
        const context = getContext();
        let processedCount = 0;

        for (let i = 0; i < context.chat.length; i++) {
            const success = await this.processMessage(i);
            if (success) processedCount++;
        }

        console.log(`Processed ${processedCount} messages`);
        return processedCount;
    }

    /**
     * 批量恢复所有消息
     */
    async restoreAllMessages() {
        const context = getContext();
        let restoredCount = 0;

        for (let i = 0; i < context.chat.length; i++) {
            const success = await this.restoreMessage(i);
            if (success) restoredCount++;
        }

        console.log(`Restored ${restoredCount} messages`);
        return restoredCount;
    }

    /**
     * 创建 UI 设置面板
     */
    createUI() {
        // 这里可以添加 SillyTavern 的 UI 设置面板
        // 实际实现需要根据 SillyTavern 的 UI 框架进行
        console.log('Creating UI settings panel...');
    }

    /**
     * 保存设置
     */
    async saveSettings() {
        const context = getContext();
        if (typeof context.saveSettingsDebounced === 'function') {
            context.extensionSettings[this.extensionName] = this.settings;
            context.saveSettingsDebounced();
        }
    }

    /**
     * 加载设置
     */
    loadSettings() {
        const context = getContext();
        if (context.extensionSettings?.[this.extensionName]) {
            Object.assign(this.settings, context.extensionSettings[this.extensionName]);
        }
    }
}

// 创建全局实例
let emoticonReplacerExtension = null;

// SillyTavern 扩展入口点
jQuery(async () => {
    emoticonReplacerExtension = new EmoticonReplacerExtension();

    // 加载设置
    emoticonReplacerExtension.loadSettings();

    // 初始化
    await emoticonReplacerExtension.init();
});

// 导出供外部使用
if (typeof window !== 'undefined') {
    window.EmoticonReplacerExtension = EmoticonReplacerExtension;
    window.getEmoticonReplacerExtension = () => emoticonReplacerExtension;
}
