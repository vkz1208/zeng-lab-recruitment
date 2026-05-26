# 学术网页生成器实现架构

状态：工程说明，非产品 spec。
最后更新：2026-05-26。

## 目标

本项目当前采用静态前端、Vercel/本地 Node API、JSON/Vercel Blob 存储的轻量架构。生产级长期维护的方向是：

- 业务规则、数据种子、页面渲染、后台编辑、认证流程、存储层分离。
- 本地开发与线上构建共享同一份静态资源清单。
- 内容数据逐步从可执行 JS 迁移到 JSON 种子、后台内容存储，最终可替换为数据库。
- 保持每次架构调整都有自动化回归验证。

## 前端模块边界

- `script.js`：应用入口、路由调度、通用安全工具、全局状态初始化。
- `api-client.js`：浏览器端 API 请求、登录上下文、保存、访问统计上报。
- `public-pages-ui.js`：公开网站页面渲染，包括首页、论文、研究、新闻、资源、加入、联系、动态页面。
- `team-ui.js`：团队成员数据补全、排序、Team 页面渲染。
- `admin-ui.js`：WYSIWYG 字段编辑器、inline 编辑、后台预览编辑。
- `admin-auth-ui.js`：注册/登录/邮箱验证、租户初始化、超级后台、legacy token 后台入口。
- `site-data.js`：默认站点内容加载器。
- `papers-data.js`：论文列表加载器。

## 数据与种子文件

- `data/site-defaults.json`：默认站点内容种子。
- `data/papers.json`：默认论文列表种子。
- `content.json`：单站点/本地内容覆盖文件，生产中应逐步迁移为租户级内容存储。
- `.data/*.json`：本地开发的租户、用户、审核、统计等模拟持久化文件，不进入 Git。

## 后端模块边界

- `local-server.js`：本地开发服务器、API 路由挂载、静态文件服务、SPA fallback。
- `static-manifest.js`：静态根文件、页面目录、构建复制目录的单一来源。
- `vercel-build.js`：Vercel 静态输出构建。
- `tenant-auth.js`：会话、注册、登录、租户权限、超级管理员操作。
- `tenant-model.js`：租户字段规范化、公开字段裁剪、套餐功能推导。
- `tenant-store.js`：租户/用户/邮箱验证 JSON 存储访问。
- `content-store.js`：内容 JSON/Vercel Blob 存储。
- `analytics-store.js`：访问统计聚合存储。
- `review-store.js`：候选更新审核队列存储。
- `ai-provider.js`：AI provider 抽象，默认 OpenAI 兼容接口。
- `academic-site-generator.js`：AI 草稿生成和本地 fallback。

## 生产化迁移方向

1. 存储层：将 JSON/Vercel Blob 替换为数据库表，并保留当前 store 模块作为适配层。
2. 前端构建：将 classic scripts 迁移到 ESM/Vite 或同类构建工具，消除隐式全局依赖。
3. 样式系统：继续拆分 `styles.css`、`admin.css` 为 base/components/pages/admin 层。
4. 租户域名：增加 DNS 校验、证书状态、域名绑定状态机。
5. 微信小程序：引入 openid/session 绑定，替换当前复用租户登录态的 v1 接口策略。
6. 统计：从 JSON 聚合迁移到追加日志或数据库聚合，避免高并发覆盖。
7. 测试：将当前 smoke/e2e 流程迁移到可提交的测试目录，并接入 CI。

## 验证命令

每次修改生产路径代码后至少运行：

```bash
npm.cmd run check
npm.cmd test
npm.cmd run test:admin-crud
npm.cmd run test:full-flow
npm.cmd run build
```
