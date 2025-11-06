# Emoticon Replacer

基于 BM25 算法的智能颜文字替换工具，支持将文本中的关键词标记替换为对应的颜文字。可集成SillyTavern（酒馆）&小手机，节省颜文字世界书的Token，并提供更大量的颜文字选择区间。

## 功能特性

- 🔍 **智能匹配** - 使用 BM25 算法进行关键词搜索和评分
- 🗃️ **数据管理** - 完整的 CRUD 功能：添加/删除/修改颜文字、关键词、分组
- 🧩 **模块化设计** - 易于集成到其他项目
- 🎭 **SillyTavern 集成** - 提供开箱即用的 ST 扩展
- 📝 **自定义数据** - 支持自定义颜文字和关键词映射

## 快速开始

### 数据格式

在 `data/emoticons.template.json` 中定义颜文字映射：

```json
[
  {
    "emoticon": "= =",
    "keywords": ["无语", "黑脸", "无奈"],
    "weight": 1.0,
    "category": ""
  }
]
```

### 基础使用

```javascript
// 1. 创建数据管理器并加载数据
const manager = new EmoticonDataManager();
const response = await fetch('data/emoticons.template.json');
const jsonText = await response.text();
manager.loadFromJSON(jsonText);

// 2. 初始化搜索引擎和替换器
const searchEngine = new SearchEngine();
const replacer = new EmoticonReplacer(searchEngine);
replacer.loadEmoticons(manager.getAllEmoticons());

// 3. 替换文本
const input = '今天真是[emoticon:无语,黑脸]';
const result = replacer.replaceText(input);
console.log(result.text); // 输出: 今天真是 = =

// 4. 数据管理
manager.addKeyword('= =', '不爽');           // 添加关键词
manager.setCategory('= =', '表情');          // 设置分类
const filtered = manager.filterByCategory('表情'); // 按分类筛选
```

### 标记格式

在文本中使用 `[emoticon:关键词1,关键词2,...]` 格式标记需要替换的位置：

```
今天很[emoticon:开心,高兴]  →  今天很 ヽ(´▽`)/
真是[emoticon:无语]         →  真是 = =
```

## SillyTavern 集成

### 安装步骤

1. 将整个项目复制到 SillyTavern 扩展目录：
   ```
   SillyTavern/public/scripts/extensions/emoticon-replacer/
   ```

2. 在 `manifest.json` 中注册扩展（如需要）

3. 在 SillyTavern 设置中启用扩展

### 使用说明

扩展会自动处理包含 `[emoticon:...]` 标记的消息，支持两种模式：

- **display 模式**: 仅修改显示内容，不影响 AI 上下文
- **content 模式**: 直接修改消息内容，会影响 AI 上下文

## 项目结构

```
EmoticonReplacer/
├── src/
│   ├── core/                         # 核心模块（可独立使用）
│   │   ├── SearchEngine.js           # BM25 搜索引擎
│   │   ├── EmoticonReplacer.js       # 替换引擎
│   │   └── EmoticonDataManager.js    # 数据管理器（CRUD）
│   └── integrations/                 # 集成层
│       └── sillytavern.js            # SillyTavern 集成
├── data/
│   └── emoticons.template.json       # 数据模板
└── examples/
    ├── basic-usage.html              # 使用示例
    └── test.js                       # 测试脚本
```

## API 参考

### EmoticonReplacer

```javascript
// 替换文本
replacer.replaceText(text, {
  strategy: 'best',              // 'first' | 'best' | 'all'
  keepOriginalOnNotFound: true,  // 找不到时保留原标记
  markNotFound: false            // 找不到时标记为 [?...]
});

// 预览匹配
replacer.preview(text);

// 查询关键词
replacer.query('开心', 5);
replacer.exactQuery('开心');
```

### SearchEngine

```javascript
// 构建索引
engine.buildIndex(emoticons);

// BM25 搜索
engine.search('文本', topK, threshold);

// 精确匹配
engine.exactMatch('文本');
```

### EmoticonDataManager

```javascript
// 数据加载
const manager = new EmoticonDataManager();
manager.loadFromJSON(jsonString);
manager.loadFromArray(dataArray);

// 读取操作
manager.getAllEmoticons();                    // 获取所有颜文字
manager.getKeywordsByEmoticon('= =');        // 获取特定颜文字的关键词
manager.getAllKeywords();                    // 获取所有关键词列表
manager.filterByCategory('表情');            // 按分类筛选
manager.findByKeyword('开心');               // 按关键词查找

// 修改操作
manager.addKeyword('= =', '无奈');          // 添加关键词
manager.removeKeyword('= =', '黑脸');       // 删除关键词
manager.updateKeywords('= =', ['新1', '新2']); // 批量更新关键词
manager.setCategory('= =', '表情');         // 设置分类
manager.setWeight('= =', 1.5);              // 设置权重

// 颜文字管理
manager.addEmoticon({                        // 添加新颜文字
  emoticon: '(๑•̀ㅂ•́)و✧',
  keywords: ['加油', '努力'],
  weight: 1.0,
  category: '鼓励'
});
manager.removeEmoticon('= =');               // 删除颜文字

// 数据导出
const json = manager.exportToJSON();         // 导出为 JSON
const array = manager.exportToArray();       // 导出为数组
```

## 许可证

MIT License
