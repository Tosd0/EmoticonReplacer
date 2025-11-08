/**
 * test.js
 * 测试脚本 - 用于 Node.js 环境测试核心功能
 * 运行: node examples/test.js
 */

// 加载模块
import SearchEngine from '../src/core/SearchEngine.js';
import KaomojiReplacer from '../src/core/KaomojiReplacer.js';
import KaomojiDataManager from '../src/core/KaomojiDataManager.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Modules 环境中获取 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 测试数据
const testKaomojis = [
    {
        kaomoji: "= =",
        keywords: ["无语", "黑脸", "无奈", "翻白眼"],
        weight: 1.0,
        category: ""
    },
    {
        kaomoji: "(╯°□°）╯︵ ┻━┻",
        keywords: ["掀桌", "愤怒", "生气", "暴躁"],
        weight: 1.0,
        category: ""
    },
    {
        kaomoji: "ヽ(´▽`)/",
        keywords: ["开心", "高兴", "快乐", "兴奋"],
        weight: 1.0,
        category: ""
    },
    {
        kaomoji: "_(:3」∠)_",
        keywords: ["躺平", "摆烂", "咸鱼", "懒"],
        weight: 1.0,
        category: ""
    }
];

// 颜色输出
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function separator() {
    console.log('='.repeat(60));
}

// 测试套件
class TestSuite {
    constructor() {
        this.passed = 0;
        this.failed = 0;
        this.tests = [];
    }

    test(name, fn) {
        this.tests.push({ name, fn });
    }

    async run() {
        log('\n🧪 Starting Test Suite\n', 'cyan');
        separator();

        for (const test of this.tests) {
            try {
                log(`\n▶ ${test.name}`, 'blue');
                await test.fn();
                this.passed++;
                log(`✓ PASSED`, 'green');
            } catch (error) {
                this.failed++;
                log(`✗ FAILED: ${error.message}`, 'red');
                console.error(error);
            }
        }

        separator();
        log(`\n📊 Test Results:`, 'cyan');
        log(`  Passed: ${this.passed}`, 'green');
        log(`  Failed: ${this.failed}`, this.failed > 0 ? 'red' : 'green');
        log(`  Total:  ${this.tests.length}`, 'yellow');

        if (this.failed === 0) {
            log('\n🎉 All tests passed!\n', 'green');
        } else {
            log(`\n❌ ${this.failed} test(s) failed\n`, 'red');
        }
    }
}

// 断言函数
function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(
            message || `Expected ${expected}, but got ${actual}`
        );
    }
}

// 创建测试
const suite = new TestSuite();

// 测试 1: SearchEngine 初始化
suite.test('SearchEngine initialization', () => {
    const engine = new SearchEngine();
    assert(engine instanceof SearchEngine, 'SearchEngine should be instantiated');
    assertEqual(engine.documents.length, 0, 'Documents should be empty initially');
});

// 测试 2: 构建索引
suite.test('SearchEngine buildIndex', () => {
    const engine = new SearchEngine();
    engine.buildIndex(testKaomojis);

    assertEqual(engine.documents.length, testKaomojis.length, 'Should load all kaomojis');
    assert(engine.avgDocLength > 0, 'Average document length should be calculated');
    assert(engine.idf.size > 0, 'IDF should be calculated');

    log(`  Loaded ${engine.documents.length} kaomojis`);
    log(`  Average doc length: ${engine.avgDocLength.toFixed(2)}`);
    log(`  IDF terms: ${engine.idf.size}`);
});

// 测试 3: BM25 搜索
suite.test('SearchEngine BM25 search', () => {
    const engine = new SearchEngine();
    engine.buildIndex(testKaomojis);

    const results = engine.search('我很开心', 5, 0);
    assert(results.length > 0, 'Should find matches');
    assert(results[0].kaomoji === 'ヽ(´▽`)/');
    assert(results[0].score > 0, 'Score should be positive');

    log(`  Query: "我很开心"`);
    log(`  Found ${results.length} results`);
    log(`  Best match: ${results[0].kaomoji} (score: ${results[0].score.toFixed(2)})`);
});

// 测试 4: 精确匹配
suite.test('SearchEngine exact match', () => {
    const engine = new SearchEngine();
    engine.buildIndex(testKaomojis);

    const results = engine.exactMatch('无语黑脸');
    assert(results.length > 0, 'Should find exact matches');
    assertEqual(results[0].kaomoji, '= =', 'Should match the correct kaomoji');

    log(`  Query: "无语黑脸"`);
    log(`  Found: ${results[0].kaomoji}`);
});

// 测试 5: KaomojiReplacer 初始化
suite.test('KaomojiReplacer initialization', () => {
    const engine = new SearchEngine();
    const replacer = new KaomojiReplacer(engine);

    assert(replacer instanceof KaomojiReplacer, 'KaomojiReplacer should be instantiated');
    assert(replacer.searchEngine === engine, 'Should store search engine reference');
});

// 测试 6: 文本替换
suite.test('KaomojiReplacer text replacement', () => {
    const engine = new SearchEngine();
    const replacer = new KaomojiReplacer(engine);
    replacer.loadKaomojis(testKaomojis);

    const input = '今天真是[kaomoji:无语,黑脸]，想要[kaomoji:掀桌,愤怒]';
    const result = replacer.replaceText(input);

    assert(result.hasReplacements, 'Should have replacements');
    assert(result.text.includes('= ='), 'Should replace with kaomoji');
    assert(result.text.includes('(╯°□°）╯︵ ┻━┻'), 'Should replace multiple kaomojis');
    assertEqual(result.successCount, 2, 'Should have 2 successful replacements');

    log(`  Input:  ${input}`);
    log(`  Output: ${result.text}`);
    log(`  Replacements: ${result.successCount}`);
});

// 测试 7: 未找到的情况
suite.test('KaomojiReplacer not found handling', () => {
    const engine = new SearchEngine();
    const replacer = new KaomojiReplacer(engine);
    replacer.loadKaomojis(testKaomojis);

    const input = '测试[kaomoji:不存在的关键词]文本';

    // keepOriginalOnNotFound = true
    const result1 = replacer.replaceText(input, { keepOriginalOnNotFound: true });
    assert(result1.text.includes('[kaomoji:不存在的关键词]'), 'Should keep original marker');
    assertEqual(result1.successCount, 0, 'Should have 0 successful replacements');

    // keepOriginalOnNotFound = false
    const result2 = replacer.replaceText(input, { keepOriginalOnNotFound: false });
    assert(!result2.text.includes('[kaomoji'), 'Should remove marker when not found');

    // markNotFound = true
    const result3 = replacer.replaceText(input, { markNotFound: true });
    assert(result3.text.includes('[?'), 'Should mark not found with [?...]');

    log(`  Original: ${input}`);
    log(`  Keep original: ${result1.text}`);
    log(`  Remove marker: ${result2.text}`);
    log(`  Mark not found: ${result3.text}`);
});

// 测试 8: 预览功能
suite.test('KaomojiReplacer preview', () => {
    const engine = new SearchEngine();
    const replacer = new KaomojiReplacer(engine);
    replacer.loadKaomojis(testKaomojis);

    const input = '今天[kaomoji:开心,高兴]又[kaomoji:躺平,摆烂]';
    const preview = replacer.preview(input);

    assertEqual(preview.length, 2, 'Should find 2 markers');
    assert(preview[0].bestMatch !== null, 'Should have best match');
    assert(preview[0].matches.length > 0, 'Should have matches');

    log(`  Found ${preview.length} markers:`);
    preview.forEach((p, i) => {
        log(`    ${i + 1}. ${p.marker} -> ${p.bestMatch?.kaomoji || 'N/A'}`);
    });
});

// 测试 9: KaomojiDataManager 数据加载和验证
suite.test('KaomojiDataManager load and validate', () => {
    const manager = new KaomojiDataManager();
    manager.loadFromArray(testKaomojis);

    const loaded = manager.getAllKaomojis();
    assertEqual(loaded.length, testKaomojis.length, 'Should load all items');

    const invalidData = [
        { kaomoji: '😊' }, // 缺少 keywords
        { keywords: ['test'] }, // 缺少 kaomoji
        { kaomoji: '😊', keywords: ['valid'] } // 有效
    ];

    const manager2 = new KaomojiDataManager();
    manager2.loadFromArray(invalidData);
    assertEqual(manager2.getAllKaomojis().length, 1, 'Should only load valid items');

    log(`  Valid items loaded: ${manager2.getAllKaomojis().length}`);
});

// 测试 10: 批量替换
suite.test('KaomojiReplacer batch replacement', () => {
    const engine = new SearchEngine();
    const replacer = new KaomojiReplacer(engine);
    replacer.loadKaomojis(testKaomojis);

    const texts = [
        '第一条[kaomoji:开心,高兴]消息',
        '第二条[kaomoji:无语]消息',
        '第三条[kaomoji:掀桌,愤怒]消息'
    ];

    const results = replacer.replaceMultiple(texts);
    assertEqual(results.length, 3, 'Should process all texts');
    assert(results.every(r => r.hasReplacements), 'All should have replacements');

    log(`  Processed ${results.length} texts`);
    results.forEach((r, i) => {
        log(`    ${i + 1}. ${texts[i]} -> ${r.text}`);
    });
});

// 测试 11: 从文件加载数据
suite.test('Load kaomojis from template file', () => {
    const dataPath = path.join(__dirname, '../data/kaomojis.template.json');
    const fileContent = fs.readFileSync(dataPath, 'utf8');

    const manager = new KaomojiDataManager();
    manager.loadFromJSON(fileContent);

    const data = manager.getAllKaomojis();
    assert(data.length > 0, 'Should load kaomojis from file');
    assert(data[0].kaomoji, 'Should have kaomoji field');
    assert(Array.isArray(data[0].keywords), 'Should have keywords array');

    log(`  Loaded ${data.length} kaomojis from template`);
});

// 测试 12: 复杂文本替换
suite.test('Complex text replacement', () => {
    const engine = new SearchEngine();
    const replacer = new KaomojiReplacer(engine);
    replacer.loadKaomojis(testKaomojis);

    const input = `
        今天遇到一个bug，让我很[kaomoji:无语,黑脸]。
        调试了半天，想要[kaomoji:掀桌,愤怒]。
        最后解决了，非常[kaomoji:开心,高兴]！
        现在可以[kaomoji:躺平,摆烂]了。
    `;

    const result = replacer.replaceText(input);

    assertEqual(result.successCount, 4, 'Should replace all 4 markers');
    assert(result.text.includes('= ='), 'Should contain replaced kaomojis');

    log(`  Original length: ${input.length}`);
    log(`  Replaced length: ${result.text.length}`);
    log(`  Success count: ${result.successCount}`);
});

// 测试 13: KaomojiDataManager CRUD - 关键词管理
suite.test('KaomojiDataManager keyword management', () => {
    const manager = new KaomojiDataManager();
    manager.loadFromArray(testKaomojis);

    // 添加关键词
    assert(manager.addKeyword('= =', '不开心'), 'Should add new keyword');
    const keywords = manager.getKeywordsByKaomoji('= =');
    assert(keywords.includes('不开心'), 'Should contain new keyword');

    // 删除关键词
    assert(manager.removeKeyword('= =', '无语'), 'Should remove keyword');
    const updatedKeywords = manager.getKeywordsByKaomoji('= =');
    assert(!updatedKeywords.includes('无语'), 'Should not contain removed keyword');

    // 批量更新关键词
    assert(manager.updateKeywords('= =', ['测试1', '测试2']), 'Should update keywords');
    const newKeywords = manager.getKeywordsByKaomoji('= =');
    assertEqual(newKeywords.length, 2, 'Should have 2 keywords');

    log(`  Keywords after update: ${newKeywords.join(', ')}`);
});

// 测试 14: KaomojiDataManager CRUD - 颜文字管理
suite.test('KaomojiDataManager kaomoji management', () => {
    const manager = new KaomojiDataManager();
    manager.loadFromArray(testKaomojis);

    const initialCount = manager.getAllKaomojis().length;

    // 添加颜文字
    assert(manager.addKaomoji({
        kaomoji: '(๑•̀ㅂ•́)و✧',
        keywords: ['加油', '努力'],
        weight: 1.5,
        category: '鼓励'
    }), 'Should add new kaomoji');
    assertEqual(manager.getAllKaomojis().length, initialCount + 1, 'Count should increase');

    // 删除颜文字
    assert(manager.removeKaomoji('(๑•̀ㅂ•́)و✧'), 'Should remove kaomoji');
    assertEqual(manager.getAllKaomojis().length, initialCount, 'Count should return to initial');

    log(`  Final count: ${manager.getAllKaomojis().length}`);
});

// 测试 15: KaomojiDataManager 查询功能
suite.test('KaomojiDataManager query functions', () => {
    const manager = new KaomojiDataManager();
    manager.loadFromArray(testKaomojis);

    // 设置分类
    manager.setCategory('= =', '表情');
    manager.setCategory('ヽ(´▽`)/', '表情');

    // 按分类筛选
    const filtered = manager.filterByCategory('表情');
    assert(filtered.length >= 2, 'Should find kaomojis by category');

    // 获取所有关键词
    const allKeywords = manager.getAllKeywords();
    assert(allKeywords.length > 0, 'Should get all keywords');

    // 按关键词查找
    const found = manager.findByKeyword('开心');
    assert(found.length > 0, 'Should find kaomojis by keyword');

    // 获取统计信息
    const stats = manager.getStats();
    assert(stats.totalKaomojis > 0, 'Should have stats');

    log(`  Total keywords: ${stats.totalKeywords}`);
    log(`  Total categories: ${stats.totalCategories}`);
});

// 测试 16: KaomojiDataManager 导出功能
suite.test('KaomojiDataManager export', () => {
    const manager = new KaomojiDataManager();
    manager.loadFromArray(testKaomojis);

    // 导出为 JSON
    const json = manager.exportToJSON(false);
    assert(json.length > 0, 'Should export to JSON');

    // 导出为数组
    const array = manager.exportToArray();
    assertEqual(array.length, testKaomojis.length, 'Should export to array');

    // 验证导出的数据可以重新加载
    const manager2 = new KaomojiDataManager();
    manager2.loadFromJSON(json);
    assertEqual(manager2.getAllKaomojis().length, testKaomojis.length, 'Should reload from exported JSON');

    log(`  Exported JSON length: ${json.length} bytes`);
});

// 测试 17: 数据隔离 - 验证深拷贝防止外部修改
suite.test('KaomojiDataManager data isolation', () => {
    const manager = new KaomojiDataManager();
    manager.loadFromArray(testKaomojis);

    // 测试 getAllKaomojis 的数据隔离
    const kaomojis = manager.getAllKaomojis();
    const originalLength = kaomojis[0].keywords.length;

    // 尝试修改返回的数据
    kaomojis[0].keywords.push('外部添加的关键词');
    kaomojis[0].category = '被修改的分类';

    // 验证内部数据未被修改
    const kaomojiAgain = manager.getAllKaomojis();
    assertEqual(kaomojiAgain[0].keywords.length, originalLength, 'Keywords should not be modified');
    assert(!kaomojiAgain[0].keywords.includes('外部添加的关键词'), 'External keyword should not exist');
    assertEqual(kaomojiAgain[0].category, testKaomojis[0].category, 'Category should not be modified');

    // 测试 getKaomojiByText 的数据隔离
    const kaomoji = manager.getKaomojiByText('= =');
    kaomoji.keywords.push('另一个外部关键词');

    const kaomojiCheck = manager.getKaomojiByText('= =');
    assert(!kaomojiCheck.keywords.includes('另一个外部关键词'), 'getKaomojiByText should return deep copy');

    // 测试 filterByCategory 的数据隔离
    manager.setCategory('= =', '测试分类');
    const filtered = manager.filterByCategory('测试分类');
    filtered[0].keywords.push('筛选后添加');

    const filteredCheck = manager.filterByCategory('测试分类');
    assert(!filteredCheck[0].keywords.includes('筛选后添加'), 'filterByCategory should return deep copy');

    // 测试 findByKeyword 的数据隔离
    const found = manager.findByKeyword('无语');
    if (found.length > 0) {
        found[0].keywords.push('查找后添加');
        const foundCheck = manager.findByKeyword('无语');
        assert(!foundCheck[0].keywords.includes('查找后添加'), 'findByKeyword should return deep copy');
    }

    log(`  ✓ All data isolation tests passed`);
    log(`  ✓ External modifications do not affect internal data`);
});

// 测试 18: BM25 单字匹配功能
suite.test('SearchEngine character-level matching', () => {
    const engine = new SearchEngine({ charWeight: 0.6 });
    engine.buildIndex(testKaomojis);

    // 测试1: 查询词包含部分字，应该通过单字匹配找到结果
    const results1 = engine.search('我很心', 5, 0);
    assert(results1.length > 0, 'Should find matches using character-level matching');
    log(`  Query "我很心" found ${results1.length} results`);
    if (results1.length > 0) {
        log(`  Best match: ${results1[0].kaomoji} (score: ${results1[0].score.toFixed(2)})`);
    }

    // 测试2: 整词匹配分数应该远高于纯单字匹配
    const wholeWordResults = engine.search('开心', 5, 0);
    const charOnlyResults = engine.search('开', 5, 0);
    if (wholeWordResults.length > 0 && charOnlyResults.length > 0) {
        const doc1 = wholeWordResults.find(r => r.kaomoji === 'ヽ(´▽`)/');
        assert(doc1, 'Should find document in whole-word results');
        const doc2 = charOnlyResults.find(r => r.kaomoji === 'ヽ(´▽`)/');
        assert(doc2, 'Should find document in char-only results');

        // 验证分数差异
        assert(doc1.score > doc2.score, 'Whole-word match should score higher than character-only match');
        assert(doc1.score > 2.0, 'Whole-word match should score > 2.0');
        assert(doc2.score < 1.0, 'Single char match should score < 1.0');

        log(`  Whole-word "开心" score: ${doc1.score.toFixed(2)}`);
        log(`  Char-only "开" score: ${doc2.score.toFixed(2)}`);
    } else {
        assert(false, 'Search results for "开心" or "开" were empty.');
    }

    // 测试3: 验证阈值过滤低分结果
    // 修复重复计分bug后，单字匹配分数约为0.7，完整词匹配约为2.5+
    // threshold=0.5可以保留有单字匹配的结果，同时过滤噪音
    const lowScoreResults = engine.search('开', 5, 0.5);
    log(`  Query "开" with threshold=0.5 found ${lowScoreResults.length} results`);
    assert(lowScoreResults.length > 0, 'Single char match should be kept with threshold=0.5');

    const partialResults = engine.search('我很心', 5, 0.5);
    log(`  Query "我很心" with threshold=0.5 found ${partialResults.length} results`);
    assert(partialResults.length > 0, 'Partial matches should be kept with threshold=0.5');

    log(`  ✓ Character-level matching works correctly`);
    log(`  ✓ Whole-word matching has higher priority`);
    log(`  ✓ Threshold filters low-quality single char matches`);
});

// 运行所有测试
(async () => {
    try {
        await suite.run();
        process.exit(suite.failed === 0 ? 0 : 1);
    } catch (error) {
        console.error('Test suite error:', error);
        process.exit(1);
    }
})();
