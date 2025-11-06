/**
 * test.js
 * 测试脚本 - 用于 Node.js 环境测试核心功能
 * 运行: node examples/test.js
 */

// 加载模块
const SearchEngine = require('../src/core/SearchEngine.js');
const EmoticonReplacer = require('../src/core/EmoticonReplacer.js');
const EmoticonDataManager = require('../src/core/EmoticonDataManager.js');
const fs = require('fs');
const path = require('path');

// 测试数据
const testEmoticons = [
    {
        emoticon: "= =",
        keywords: ["无语", "黑脸", "无奈", "翻白眼"],
        weight: 1.0,
        category: ""
    },
    {
        emoticon: "(╯°□°）╯︵ ┻━┻",
        keywords: ["掀桌", "愤怒", "生气", "暴躁"],
        weight: 1.0,
        category: ""
    },
    {
        emoticon: "ヽ(´▽`)/",
        keywords: ["开心", "高兴", "快乐", "兴奋"],
        weight: 1.0,
        category: ""
    },
    {
        emoticon: "_(:3」∠)_",
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
    engine.buildIndex(testEmoticons);

    assertEqual(engine.documents.length, testEmoticons.length, 'Should load all emoticons');
    assert(engine.avgDocLength > 0, 'Average document length should be calculated');
    assert(engine.idf.size > 0, 'IDF should be calculated');

    log(`  Loaded ${engine.documents.length} emoticons`);
    log(`  Average doc length: ${engine.avgDocLength.toFixed(2)}`);
    log(`  IDF terms: ${engine.idf.size}`);
});

// 测试 3: BM25 搜索
suite.test('SearchEngine BM25 search', () => {
    const engine = new SearchEngine();
    engine.buildIndex(testEmoticons);

    const results = engine.search('我很开心', 5, 0);
    assert(results.length > 0, 'Should find matches');
    assert(results[0].emoticon === 'ヽ(´▽`)/');
    assert(results[0].score > 0, 'Score should be positive');

    log(`  Query: "我很开心"`);
    log(`  Found ${results.length} results`);
    log(`  Best match: ${results[0].emoticon} (score: ${results[0].score.toFixed(2)})`);
});

// 测试 4: 精确匹配
suite.test('SearchEngine exact match', () => {
    const engine = new SearchEngine();
    engine.buildIndex(testEmoticons);

    const results = engine.exactMatch('无语黑脸');
    assert(results.length > 0, 'Should find exact matches');
    assertEqual(results[0].emoticon, '= =', 'Should match the correct emoticon');

    log(`  Query: "无语黑脸"`);
    log(`  Found: ${results[0].emoticon}`);
});

// 测试 5: EmoticonReplacer 初始化
suite.test('EmoticonReplacer initialization', () => {
    const engine = new SearchEngine();
    const replacer = new EmoticonReplacer(engine);

    assert(replacer instanceof EmoticonReplacer, 'EmoticonReplacer should be instantiated');
    assert(replacer.searchEngine === engine, 'Should store search engine reference');
});

// 测试 6: 文本替换
suite.test('EmoticonReplacer text replacement', () => {
    const engine = new SearchEngine();
    const replacer = new EmoticonReplacer(engine);
    replacer.loadEmoticons(testEmoticons);

    const input = '今天真是[emoticon:无语,黑脸]，想要[emoticon:掀桌,愤怒]';
    const result = replacer.replaceText(input);

    assert(result.hasReplacements, 'Should have replacements');
    assert(result.text.includes('= ='), 'Should replace with emoticon');
    assert(result.text.includes('(╯°□°）╯︵ ┻━┻'), 'Should replace multiple emoticons');
    assertEqual(result.successCount, 2, 'Should have 2 successful replacements');

    log(`  Input:  ${input}`);
    log(`  Output: ${result.text}`);
    log(`  Replacements: ${result.successCount}`);
});

// 测试 7: 未找到的情况
suite.test('EmoticonReplacer not found handling', () => {
    const engine = new SearchEngine();
    const replacer = new EmoticonReplacer(engine);
    replacer.loadEmoticons(testEmoticons);

    const input = '测试[emoticon:不存在的关键词]文本';

    // keepOriginalOnNotFound = true
    const result1 = replacer.replaceText(input, { keepOriginalOnNotFound: true });
    assert(result1.text.includes('[emoticon:不存在的关键词]'), 'Should keep original marker');
    assertEqual(result1.successCount, 0, 'Should have 0 successful replacements');

    // keepOriginalOnNotFound = false
    const result2 = replacer.replaceText(input, { keepOriginalOnNotFound: false });
    assert(!result2.text.includes('[emoticon'), 'Should remove marker when not found');

    // markNotFound = true
    const result3 = replacer.replaceText(input, { markNotFound: true });
    assert(result3.text.includes('[?'), 'Should mark not found with [?...]');

    log(`  Original: ${input}`);
    log(`  Keep original: ${result1.text}`);
    log(`  Remove marker: ${result2.text}`);
    log(`  Mark not found: ${result3.text}`);
});

// 测试 8: 预览功能
suite.test('EmoticonReplacer preview', () => {
    const engine = new SearchEngine();
    const replacer = new EmoticonReplacer(engine);
    replacer.loadEmoticons(testEmoticons);

    const input = '今天[emoticon:开心,高兴]又[emoticon:躺平,摆烂]';
    const preview = replacer.preview(input);

    assertEqual(preview.length, 2, 'Should find 2 markers');
    assert(preview[0].bestMatch !== null, 'Should have best match');
    assert(preview[0].matches.length > 0, 'Should have matches');

    log(`  Found ${preview.length} markers:`);
    preview.forEach((p, i) => {
        log(`    ${i + 1}. ${p.marker} -> ${p.bestMatch?.emoticon || 'N/A'}`);
    });
});

// 测试 9: EmoticonDataManager 数据加载和验证
suite.test('EmoticonDataManager load and validate', () => {
    const manager = new EmoticonDataManager();
    manager.loadFromArray(testEmoticons);

    const loaded = manager.getAllEmoticons();
    assertEqual(loaded.length, testEmoticons.length, 'Should load all items');

    const invalidData = [
        { emoticon: '😊' }, // 缺少 keywords
        { keywords: ['test'] }, // 缺少 emoticon
        { emoticon: '😊', keywords: ['valid'] } // 有效
    ];

    const manager2 = new EmoticonDataManager();
    manager2.loadFromArray(invalidData);
    assertEqual(manager2.getAllEmoticons().length, 1, 'Should only load valid items');

    log(`  Valid items loaded: ${manager2.getAllEmoticons().length}`);
});

// 测试 10: 批量替换
suite.test('EmoticonReplacer batch replacement', () => {
    const engine = new SearchEngine();
    const replacer = new EmoticonReplacer(engine);
    replacer.loadEmoticons(testEmoticons);

    const texts = [
        '第一条[emoticon:开心,高兴]消息',
        '第二条[emoticon:无语]消息',
        '第三条[emoticon:掀桌,愤怒]消息'
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
suite.test('Load emoticons from template file', () => {
    const dataPath = path.join(__dirname, '../data/emoticons.template.json');
    const fileContent = fs.readFileSync(dataPath, 'utf8');

    const manager = new EmoticonDataManager();
    manager.loadFromJSON(fileContent);

    const data = manager.getAllEmoticons();
    assert(data.length > 0, 'Should load emoticons from file');
    assert(data[0].emoticon, 'Should have emoticon field');
    assert(Array.isArray(data[0].keywords), 'Should have keywords array');

    log(`  Loaded ${data.length} emoticons from template`);
});

// 测试 12: 复杂文本替换
suite.test('Complex text replacement', () => {
    const engine = new SearchEngine();
    const replacer = new EmoticonReplacer(engine);
    replacer.loadEmoticons(testEmoticons);

    const input = `
        今天遇到一个bug，让我很[emoticon:无语,黑脸]。
        调试了半天，想要[emoticon:掀桌,愤怒]。
        最后解决了，非常[emoticon:开心,高兴]！
        现在可以[emoticon:躺平,摆烂]了。
    `;

    const result = replacer.replaceText(input);

    assertEqual(result.successCount, 4, 'Should replace all 4 markers');
    assert(result.text.includes('= ='), 'Should contain replaced emoticons');

    log(`  Original length: ${input.length}`);
    log(`  Replaced length: ${result.text.length}`);
    log(`  Success count: ${result.successCount}`);
});

// 测试 13: EmoticonDataManager CRUD - 关键词管理
suite.test('EmoticonDataManager keyword management', () => {
    const manager = new EmoticonDataManager();
    manager.loadFromArray(testEmoticons);

    // 添加关键词
    assert(manager.addKeyword('= =', '不开心'), 'Should add new keyword');
    const keywords = manager.getKeywordsByEmoticon('= =');
    assert(keywords.includes('不开心'), 'Should contain new keyword');

    // 删除关键词
    assert(manager.removeKeyword('= =', '无语'), 'Should remove keyword');
    const updatedKeywords = manager.getKeywordsByEmoticon('= =');
    assert(!updatedKeywords.includes('无语'), 'Should not contain removed keyword');

    // 批量更新关键词
    assert(manager.updateKeywords('= =', ['测试1', '测试2']), 'Should update keywords');
    const newKeywords = manager.getKeywordsByEmoticon('= =');
    assertEqual(newKeywords.length, 2, 'Should have 2 keywords');

    log(`  Keywords after update: ${newKeywords.join(', ')}`);
});

// 测试 14: EmoticonDataManager CRUD - 颜文字管理
suite.test('EmoticonDataManager emoticon management', () => {
    const manager = new EmoticonDataManager();
    manager.loadFromArray(testEmoticons);

    const initialCount = manager.getAllEmoticons().length;

    // 添加颜文字
    assert(manager.addEmoticon({
        emoticon: '(๑•̀ㅂ•́)و✧',
        keywords: ['加油', '努力'],
        weight: 1.5,
        category: '鼓励'
    }), 'Should add new emoticon');
    assertEqual(manager.getAllEmoticons().length, initialCount + 1, 'Count should increase');

    // 删除颜文字
    assert(manager.removeEmoticon('(๑•̀ㅂ•́)و✧'), 'Should remove emoticon');
    assertEqual(manager.getAllEmoticons().length, initialCount, 'Count should return to initial');

    log(`  Final count: ${manager.getAllEmoticons().length}`);
});

// 测试 15: EmoticonDataManager 查询功能
suite.test('EmoticonDataManager query functions', () => {
    const manager = new EmoticonDataManager();
    manager.loadFromArray(testEmoticons);

    // 设置分类
    manager.setCategory('= =', '表情');
    manager.setCategory('ヽ(´▽`)/', '表情');

    // 按分类筛选
    const filtered = manager.filterByCategory('表情');
    assert(filtered.length >= 2, 'Should find emoticons by category');

    // 获取所有关键词
    const allKeywords = manager.getAllKeywords();
    assert(allKeywords.length > 0, 'Should get all keywords');

    // 按关键词查找
    const found = manager.findByKeyword('开心');
    assert(found.length > 0, 'Should find emoticons by keyword');

    // 获取统计信息
    const stats = manager.getStats();
    assert(stats.totalEmoticons > 0, 'Should have stats');

    log(`  Total keywords: ${stats.totalKeywords}`);
    log(`  Total categories: ${stats.totalCategories}`);
});

// 测试 16: EmoticonDataManager 导出功能
suite.test('EmoticonDataManager export', () => {
    const manager = new EmoticonDataManager();
    manager.loadFromArray(testEmoticons);

    // 导出为 JSON
    const json = manager.exportToJSON(false);
    assert(json.length > 0, 'Should export to JSON');

    // 导出为数组
    const array = manager.exportToArray();
    assertEqual(array.length, testEmoticons.length, 'Should export to array');

    // 验证导出的数据可以重新加载
    const manager2 = new EmoticonDataManager();
    manager2.loadFromJSON(json);
    assertEqual(manager2.getAllEmoticons().length, testEmoticons.length, 'Should reload from exported JSON');

    log(`  Exported JSON length: ${json.length} bytes`);
});

// 测试 17: 数据隔离 - 验证深拷贝防止外部修改
suite.test('EmoticonDataManager data isolation', () => {
    const manager = new EmoticonDataManager();
    manager.loadFromArray(testEmoticons);

    // 测试 getAllEmoticons 的数据隔离
    const emoticons = manager.getAllEmoticons();
    const originalLength = emoticons[0].keywords.length;

    // 尝试修改返回的数据
    emoticons[0].keywords.push('外部添加的关键词');
    emoticons[0].category = '被修改的分类';

    // 验证内部数据未被修改
    const emoticonAgain = manager.getAllEmoticons();
    assertEqual(emoticonAgain[0].keywords.length, originalLength, 'Keywords should not be modified');
    assert(!emoticonAgain[0].keywords.includes('外部添加的关键词'), 'External keyword should not exist');
    assertEqual(emoticonAgain[0].category, testEmoticons[0].category, 'Category should not be modified');

    // 测试 getEmoticonByText 的数据隔离
    const emoticon = manager.getEmoticonByText('= =');
    emoticon.keywords.push('另一个外部关键词');

    const emoticonCheck = manager.getEmoticonByText('= =');
    assert(!emoticonCheck.keywords.includes('另一个外部关键词'), 'getEmoticonByText should return deep copy');

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
