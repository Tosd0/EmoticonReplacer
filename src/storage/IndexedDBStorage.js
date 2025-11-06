/**
 * IndexedDBStorage.js
 * 前端 IndexedDB 存储管理
 * 用于在浏览器中持久化颜文字数据
 */

const DB_NAME = 'EmoticonReplacerDB';
const DB_VERSION = 1;
const STORE_NAME = 'emoticons';
const DATA_KEY = 'emoticon_data';

// 调试开关（默认关闭）
let DEBUG_MODE = false;

/**
 * 设置调试模式
 * @param {boolean} enabled - 是否启用调试模式
 */
function setDebugMode(enabled) {
    DEBUG_MODE = enabled;
}

/**
 * 调试日志（仅在调试模式开启时输出）
 */
function debugLog(message, ...args) {
    if (DEBUG_MODE) {
        console.log(`[EmoticonReplacer] ${message}`, ...args);
    }
}

function debugWarn(message, ...args) {
    if (DEBUG_MODE) {
        console.warn(`[EmoticonReplacer] ${message}`, ...args);
    }
}

function debugError(message, ...args) {
    // 错误总是输出，但在非调试模式下简化
    if (DEBUG_MODE) {
        console.error(`[EmoticonReplacer] ${message}`, ...args);
    } else {
        console.error(`[EmoticonReplacer] ${message}`);
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
async function getEmoticons() {
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
async function saveEmoticons(data) {
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
                debugLog(`Saved ${data.length} emoticons to IndexedDB`);
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
async function clearEmoticons() {
    try {
        const db = await openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(DATA_KEY);

            transaction.oncomplete = () => {
                db.close();
                debugLog('Cleared emoticons from IndexedDB');
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
async function initEmoticonStorage(options = {}) {
    const {
        defaultURL = null,
        forceReload = false
    } = options;

    try {
        // 检查 IndexedDB 是否已有数据
        if (!forceReload) {
            const existingData = await getEmoticons();
            if (existingData && existingData.length > 0) {
                debugLog(`Loaded ${existingData.length} emoticons from IndexedDB cache`);
                return existingData;
            }
        }

        // 如果没有数据且提供了远程 URL，尝试加载
        if (defaultURL) {
            debugLog(`Loading default emoticons from ${defaultURL}...`);
            const remoteData = await loadFromRemote(defaultURL);

            if (remoteData && remoteData.length > 0) {
                // 保存到 IndexedDB
                await saveEmoticons(remoteData);
                debugLog(`Initialized with ${remoteData.length} emoticons from remote`);
                return remoteData;
            } else {
                debugWarn('Failed to load from remote, returning empty array');
            }
        }

        // 返回空数组
        return [];
    } catch (error) {
        debugError('Error initializing emoticon storage:', error);
        return [];
    }
}

/**
 * 获取存储统计信息
 * @returns {Promise<Object>} 统计信息
 */
async function getStorageStats() {
    try {
        const data = await getEmoticons();

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

// 导出（支持 CommonJS 和 ES6）
const IndexedDBStorage = {
    initEmoticonStorage,
    getEmoticons,
    saveEmoticons,
    clearEmoticons,
    getStorageStats,
    setDebugMode
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = IndexedDBStorage;
}

if (typeof window !== 'undefined') {
    window.IndexedDBStorage = IndexedDBStorage;
}
