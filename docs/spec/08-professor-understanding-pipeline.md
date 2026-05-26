# 08. Professor Understanding Pipeline SPEC

文档状态：已采纳 / 生效  
当前版本：v1.0-effective  
创建日期：2026-05-26  
采纳时间：2026-05-26  
审核人：项目拥有者  
适用范围：教授资料理解、结构化抽取、定位分析、AI 草稿生成、CMS 审核、页面渲染工作流

## 1. 项目目标

本系统用于将教授相关的原始资料，转换为：

- 结构化学术数据
- 教授 / 课题组定位分析
- 高质量学术主页文案
- 可稳定渲染的网站内容

系统禁止直接从原始资料生成完整网页。

系统必须采用“分阶段理解与生成”的工作流。

## 2. 核心原则

### 2.1 AI 生成的是草稿，不是真实数据

AI 输出内容属于：

- `draft data`（草稿）
- `positioning`（定位建议）
- `copywriting`（文案建议）

最终发布内容必须来自：

- 人工审核
- CMS 后台确认数据

AI 不能直接成为最终数据源。

### 2.2 先结构化，再生成文案

系统工作流必须是：

```text
原始资料
-> 信息抽取
-> 结构化 Schema
-> 语义理解
-> 定位分析
-> 文案生成
-> 页面渲染
```

禁止：

```text
原始资料
-> 直接生成网页
```

### 2.3 页面稳定性依赖稳定 Schema

所有页面必须读取结构化 Schema 进行渲染。

页面禁止直接解析自然语言。

## 3. Pipeline 阶段设计

### Stage 1 — 输入收集层

支持输入：

- PDF 简历
- 教授简介
- Google Scholar 链接
- 个人主页链接
- 论文列表
- 研究陈述
- 手动输入文本
- 上传文档

### Stage 2 — 结构化信息抽取层

目标：将原始资料转换为标准 Professor Schema。

输出 Schema：

```json
{
  "profile": {
    "name": "",
    "title": "",
    "institution": "",
    "department": "",
    "email": "",
    "office": "",
    "website": "",
    "photo_url": ""
  },
  "research": {
    "summary": "",
    "areas": [],
    "keywords": []
  },
  "education": [],
  "appointments": [],
  "publications": [],
  "projects": [],
  "awards": [],
  "teaching": [],
  "students": [],
  "services": [],
  "links": []
}
```

抽取规则：

- 优先抽取事实，不优先生成
- 禁止编造不存在的信息
- 缺失字段允许为空
- 尽量保留来源信息

### Stage 3 — 语义理解层

目标：对教授进行更高层次的理解与抽象。

这一层不是事实抽取。

这一层负责：

- 抽象
- 总结
- 学术风格理解
- 研究定位理解

输出 Schema：

```json
{
  "academic_identity": {
    "primary_domain": "",
    "secondary_domains": [],
    "research_style": [],
    "lab_culture": [],
    "international_profile": "",
    "industry_connection": ""
  },
  "strength_analysis": {
    "major_strengths": [],
    "differentiators": [],
    "high_impact_signals": []
  },
  "target_audience": {
    "prospective_students": [],
    "collaborators": [],
    "industry_partners": []
  }
}
```

`research_style` 示例：

- `interdisciplinary`
- `theory-driven`
- `systems-oriented`
- `translational`
- `AI-for-science`

`lab_culture` 示例：

- `collaborative`
- `frontier-driven`
- `student-focused`
- `international`

### Stage 4 — 定位分析层

目标：将语义理解结果转换为网站定位策略。

输出 Schema：

```json
{
  "positioning": {
    "core_message": "",
    "hero_direction": "",
    "tone_keywords": [],
    "brand_impression": [],
    "recruitment_style": ""
  }
}
```

示例：

```json
{
  "core_message": "Building AI systems for scientific discovery",
  "hero_direction": "Frontier interdisciplinary AI lab",
  "tone_keywords": [
    "modern",
    "international",
    "research-intensive"
  ]
}
```

### Stage 5 — 文案生成层

目标：生成高质量学术主页文案。

本阶段必须基于：

- 结构化数据
- 语义理解
- 定位分析

禁止直接读取原始资料。

需要生成的内容：

1. Hero Section

- `headline`
- `subheadline`
- CTA 文案

2. About Section

- 教授简介
- 研究概述
- 实验室使命

3. Research Section

- 研究方向叙事
- 研究主题组织
- 面向学生的解释

4. Recruitment Section

- 实验室文化
- 招生风格
- 合作邀请

文案规则：

- 避免 AI 味过重
- 避免空泛宣传
- 保持学术专业性
- 强调差异化
- 保持事实一致性

### Stage 6 — AI Discoveries 层

目标：允许 AI 发现 Schema 之外但有价值的信息。

输出 Schema：

```json
{
  "ai_discoveries": [
    {
      "type": "",
      "title": "",
      "description": "",
      "confidence": 0.0,
      "evidence": "",
      "suggested_section": ""
    }
  ]
}
```

规则：

AI discoveries：

- 禁止直接发布
- 必须进入人工审核
- 可以建议潜在奖项、隐藏研究方向、合作模式、品牌机会、页面亮点

### Stage 7 — Draft Review Workflow

工作流：

```text
AI 生成草稿
-> 人工审核
-> 编辑
-> 确认
-> 发布
```

关键规则：

CMS 后台确认后的数据，才是最终真实数据。

AI 输出永远只是草稿。

### Stage 8 — 页面渲染层

目标：将结构化内容渲染为网页。

渲染规则：

页面必须：

- 读取结构化 Schema
- 使用模板系统
- 禁止嵌入 AI 逻辑

支持的输出：

- 教授主页
- 招生页面
- 移动端页面
- SEO 页面
- PDF 简历
- 教授卡片
- 院系目录

### Stage 9 — 多租户支持

每位教授必须属于一个 tenant。

Tenant 规则：

- 必须存在 `tenant_id`
- 必须数据隔离
- 模板可按租户配置
- 风格可按租户配置

### Stage 10 — 未来扩展方向

未来可扩展：

- 风格模板插件
- 多语言生成
- 自动论文更新
- 学术图谱分析
- AI 招生助手
- 学生匹配
- 学术 SEO 优化

### Stage 11 — 当前版本非目标

当前版本不追求：

- 完全自动发布
- 替代人工编辑
- 全自动爬虫
- 自主 Agent 系统
- 任意布局生成

### Stage 12 — 核心约束总结

系统必须保证：

- 先结构化，再生成
- Schema 稳定
- AI 只是草稿生成器
- 人工审核后才能发布
- 数据、理解、渲染彻底解耦
- 页面模板独立于 AI 生成逻辑

## 4. 变更记录

| 版本 | 日期 | 状态 | 变更摘要 | 审核人 |
| --- | --- | --- | --- | --- |
| v1.0-effective | 2026-05-26 | 已采纳 / 生效 | 新增 Professor Understanding Pipeline，明确教授资料必须经过结构化抽取、语义理解、定位分析、文案生成、人工审核、模板渲染，不允许原始资料直接生成网页。 | 项目拥有者 |
