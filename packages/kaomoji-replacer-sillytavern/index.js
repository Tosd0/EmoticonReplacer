/**
 * Kaomoji Replacer - SillyTavern Extension
 * 自动将消息中的 [kaomoji:关键词] 标记替换为对应的颜文字
 */

// ✅ 正确导入 SillyTavern API
import {
    eventSource,
    event_types,
    saveSettingsDebounced,
    updateMessageBlock
} from '../../../../script.js';

import {
    getContext,
    extension_settings
} from '../../../extensions.js';

import { loadFileToDocument } from '../../../../utils.js';

// 扩展常量
const EXT_NAME = 'kaomoji-replacer';
const EXT_FOLDER = 'scripts/extensions/third-party/kaomoji-replacer';

// 默认设置
const defaultSettings = {
    enabled: true,
    autoProcess: true,              // 自动处理新消息
    modifyMode: 'display',          // 'display' 或 'content'
    processUserMessages: false,     // 是否处理用户消息
    processAIMessages: true,        // 是否处理 AI 消息
    replaceStrategy: 'best',        // 'first', 'best', 'all'
    keepOriginalOnNotFound: true,   // 找不到时保留原标记
    markNotFound: false             // 找不到时标记为 [?...]
};

// 扩展状态
let isInitialized = false;
let replacer = null;
let searchEngine = null;

/**
 * 初始化设置
 */
function initSettings() {
    if (!extension_settings[EXT_NAME]) {
        extension_settings[EXT_NAME] = structuredClone(defaultSettings);
        saveSettingsDebounced();
    }
}

/**
 * 加载核心库
 */
async function loadCoreLibrary() {
    console.log('[Kaomoji] Loading core library...');

    // ✅ 使用 loadFileToDocument 加载 UMD bundle
    await loadFileToDocument(
        `/${EXT_FOLDER}/lib/kaomoji-replacer.umd.min.js`,
        'js'
    );

    // ✅ 验证全局变量是否正确挂载
    if (!window.KaomojiReplacer) {
        throw new Error('Failed to load KaomojiReplacer UMD bundle');
    }

    console.log('[Kaomoji] Core library loaded successfully');
}

/**
 * 加载颜文字数据（带回退机制）
 */
async function loadKaomojiData() {
    const { KaomojiDataManager } = window.KaomojiReplacer;
    const manager = new KaomojiDataManager();

    try {
        // ✅ 尝试加载用户数据（使用绝对路径）
        const response = await fetch(`/${EXT_FOLDER}/data/kaomojis.json`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const jsonText = await response.text();
        manager.loadFromJSON(jsonText);

        const data = manager.getAllKaomojis();
        replacer.loadKaomojis(data);
        console.log(`[Kaomoji] Loaded ${data.length} kaomojis from user data`);

    } catch (error) {
        console.warn('[Kaomoji] Failed to load user data, trying template:', error.message);

        try {
            // ✅ 回退：加载模板数据
            const response = await fetch(`/${EXT_FOLDER}/data/kaomojis.template.json`);

            if (!response.ok) {
                throw new Error(`Template not found: ${response.status}`);
            }

            const jsonText = await response.text();
            manager.loadFromJSON(jsonText);

            const data = manager.getAllKaomojis();
            replacer.loadKaomojis(data);
            console.log(`[Kaomoji] Loaded ${data.length} kaomojis from template (fallback)`);

        } catch (fallbackError) {
            console.error('[Kaomoji] Failed to load template data:', fallbackError);
            throw new Error('No kaomoji data available');
        }
    }
}

/**
 * 初始化核心模块
 */
async function initCoreModules() {
    const { SearchEngine, KaomojiReplacer } = window.KaomojiReplacer;

    searchEngine = new SearchEngine();
    replacer = new KaomojiReplacer(searchEngine);

    // 应用配置
    replacer.setConfig({
        replaceStrategy: extension_settings[EXT_NAME].replaceStrategy
    });

    // 加载数据
    await loadKaomojiData();
}

/**
 * 注册事件监听器
 */
function registerEventListeners() {
    // 监听 AI 消息接收
    eventSource.on(event_types.MESSAGE_RECEIVED, (messageId) => {
        if (extension_settings[EXT_NAME].enabled &&
            extension_settings[EXT_NAME].autoProcess &&
            extension_settings[EXT_NAME].processAIMessages) {
            processMessage(messageId);
        }
    });

    // 监听用户消息发送
    eventSource.on(event_types.MESSAGE_SENT, (messageId) => {
        if (extension_settings[EXT_NAME].enabled &&
            extension_settings[EXT_NAME].autoProcess &&
            extension_settings[EXT_NAME].processUserMessages) {
            processMessage(messageId);
        }
    });

    console.log('[Kaomoji] Event listeners registered');
}

/**
 * 处理单条消息
 */
async function processMessage(messageId) {
    try {
        const context = getContext();
        const message = context.chat[messageId];

        if (!message || message.is_system) {
            return false;
        }

        // 检查是否应该处理此消息
        if (message.is_user && !extension_settings[EXT_NAME].processUserMessages) {
            return false;
        }

        if (!message.is_user && !extension_settings[EXT_NAME].processAIMessages) {
            return false;
        }

        // 获取原始文本
        const originalText = message.mes;

        // 执行替换
        const result = replacer.replaceText(originalText, {
            strategy: extension_settings[EXT_NAME].replaceStrategy,
            keepOriginalOnNotFound: extension_settings[EXT_NAME].keepOriginalOnNotFound,
            markNotFound: extension_settings[EXT_NAME].markNotFound
        });

        // 如果没有替换,直接返回
        if (!result.hasReplacements || result.successCount === 0) {
            return false;
        }

        // 根据模式应用替换
        if (extension_settings[EXT_NAME].modifyMode === 'display') {
            await modifyMessageDisplay(messageId, result.text, originalText);
        } else {
            await modifyMessageContent(messageId, result.text, originalText);
        }

        console.log(`[Kaomoji] Processed message ${messageId}: ${result.successCount} replacements`);
        return true;

    } catch (error) {
        console.error('[Kaomoji] Error processing message:', error);
        return false;
    }
}

/**
 * 方案一：仅修改显示层（推荐）
 */
async function modifyMessageDisplay(messageId, displayContent, originalContent) {
    const context = getContext();
    const message = context.chat[messageId];

    if (!message) return false;

    // 初始化 extra 对象
    if (!message.extra) {
        message.extra = {};
    }

    // 备份原始内容
    if (!message.extra.kaomoji_original) {
        message.extra.kaomoji_original = originalContent;
    }

    // ✅ 设置显示文本（不修改 mes）
    message.extra.display_text = displayContent;

    // 更新 UI
    updateMessageBlock(Number(messageId), message);

    // 保存聊天记录
    await context.saveChat();

    return true;
}

/**
 * 方案二：直接修改消息内容
 */
async function modifyMessageContent(messageId, newContent, originalContent) {
    const context = getContext();
    const message = context.chat[messageId];

    if (!message) return false;

    // 初始化 extra 对象
    if (!message.extra) {
        message.extra = {};
    }

    // 备份原始内容
    if (!message.extra.kaomoji_original) {
        message.extra.kaomoji_original = originalContent;
    }

    // 直接修改消息内容
    message.mes = newContent;

    // 更新 UI
    updateMessageBlock(Number(messageId), message);

    // 保存聊天记录
    await context.saveChat();

    // 触发消息编辑事件
    await eventSource.emit(event_types.MESSAGE_EDITED, messageId);

    return true;
}

/**
 * 批量处理所有消息
 */
async function processAllMessages() {
    const context = getContext();
    let processedCount = 0;

    for (let i = 0; i < context.chat.length; i++) {
        const success = await processMessage(i);
        if (success) processedCount++;
    }

    console.log(`[Kaomoji] Processed ${processedCount} messages`);
    return processedCount;
}

/**
 * 恢复消息原始内容
 */
async function restoreMessage(messageId) {
    const context = getContext();
    const message = context.chat[messageId];

    if (!message?.extra?.kaomoji_original) {
        return false;
    }

    const originalContent = message.extra.kaomoji_original;

    if (extension_settings[EXT_NAME].modifyMode === 'display') {
        delete message.extra.display_text;
    } else {
        message.mes = originalContent;
    }

    delete message.extra.kaomoji_original;

    updateMessageBlock(Number(messageId), message);
    await context.saveChat();

    return true;
}

/**
 * 批量恢复所有消息
 */
async function restoreAllMessages() {
    const context = getContext();
    let restoredCount = 0;

    for (let i = 0; i < context.chat.length; i++) {
        const success = await restoreMessage(i);
        if (success) restoredCount++;
    }

    console.log(`[Kaomoji] Restored ${restoredCount} messages`);
    return restoredCount;
}

// ========== 扩展入口点 ==========

jQuery(async () => {
    try {
        console.log('[Kaomoji] Initializing extension...');

        // 1. 初始化设置
        initSettings();

        // 2. 加载核心库（UMD bundle）
        await loadCoreLibrary();

        // 3. 初始化核心模块
        await initCoreModules();

        // 4. 注册事件监听器
        registerEventListeners();

        isInitialized = true;
        console.log('[Kaomoji] Extension initialized successfully');

    } catch (error) {
        console.error('[Kaomoji] Failed to initialize extension:', error);
    }
});

// ========== 暴露 API 到全局 ==========

window.KaomojiReplacerExtension = {
    processAllMessages,
    restoreAllMessages,
    processMessage,
    restoreMessage,
    getSettings: () => extension_settings[EXT_NAME],
    isInitialized: () => isInitialized
};
