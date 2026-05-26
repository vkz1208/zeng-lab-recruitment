# 04. 数据模型与接口 SPEC

文档状态：已采纳/生效  
当前版本：v0.1-effective  
创建日期：2026-05-26
生效日期：2026-05-26

## 4.1 租户模型

租户模型需逐步扩展以下字段：

- `id`：租户唯一 ID。
- `name`：租户名称。
- `slug`：平台内唯一 slug。
- `status`：租户状态，例如 active、disabled、frozen。
- `planId`：当前套餐 ID。
- `features`：租户功能开关。
- `domains`：独立域名列表。
- `subdomain`：平台二级域名。
- `stylePluginId`：当前风格插件 ID。
- `aiProviderConfigRef`：AI 配置引用。
- `initializedAt`：初始化完成时间。
- `createdAt`、`updatedAt`：创建和更新时间。

## 4.2 套餐模型

套餐模型需支持：

- 套餐 ID。
- 套餐名称。
- 价格模式。
- 服务项目列表。
- AI 使用额度。
- 可用风格范围。
- 可绑定域名数量。
- 自动抓取频率。
- 访问统计能力等级。
- 协作者数量限制。
- 启用状态。

## 4.3 风格插件模型

风格插件模型需支持：

- 插件 ID。
- 插件名称。
- 插件版本。
- 插件状态。
- 支持页面类型。
- 支持内容模块。
- 资产路径。
- 预览图。
- 主题配置项。
- 默认配置。
- 兼容的内容 schema 版本。

## 4.4 内容模型

内容模型应保留当前固定页面能力，同时支持动态页面：

- 固定页面：home、team、papers、research、news、join、contact。
- 动态页面：projects、activities、courses、resources、datasets 等。
- 页面应支持 slug、标题、语言、排序、启用状态和模块列表。
- 模块应支持不同类型，例如文本、图文卡片、论文列表、成员列表、新闻列表、项目列表、富文本、图片墙等。

## 4.5 统计模型

统计模型需记录：

- PV。
- UV。
- IP。
- IP 对应地理位置。
- 页面路径。
- 来源。
- 访问时间。
- 用户代理。
- 租户 ID。

后台展示时应优先展示聚合数据，避免暴露不必要的原始隐私数据。

## 4.6 审核模型

自动更新审核模型需记录：

- 候选内容 ID。
- 租户 ID。
- 内容来源。
- 原文链接。
- 标题。
- 摘要。
- AI 建议文案。
- 推荐发布页面或模块。
- 审核状态：pending、approved、rejected、needs_revision、published。
- 审核人。
- 审核意见。
- 发布时间。
- 创建和更新时间。

## 4.7 AI Provider 抽象

AI provider 抽象必须保留以下方向：

- provider 可配置。
- baseUrl 可配置。
- model 可配置。
- apiKey 不写入前端，不进入公开仓库。
- 文本生成和图片生成可分别配置。
- 支持超时、错误处理和 fallback。
- 支持后续按租户或套餐做额度控制。
