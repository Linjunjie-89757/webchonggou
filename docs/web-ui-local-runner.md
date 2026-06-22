# Web UI Local Runner 最小版

Web UI Local Runner 是运行在用户本机的轻量执行器。它负责调用本机 Playwright + Chromium 打开被测页面、让用户手动登录、采集当前页元素候选，并把结果返回给平台。

## 启动

先安装依赖：

```bash
npm install
npx playwright install chromium
```

启动本地执行器：

```bash
npm run runner
```

默认监听：

```text
http://127.0.0.1:39118
```

## 接口

### 健康检查

```http
GET http://127.0.0.1:39118/health
```

返回 Runner 版本、Playwright 状态、Chromium 状态、当前会话。

### 打开采集页面

```http
POST http://127.0.0.1:39118/collect/open
Content-Type: application/json

{
  "url": "https://example.com",
  "workspaceId": "account-open",
  "environmentId": "test"
}
```

Runner 会在本机用 Playwright Chromium 打开页面。如果页面需要登录，用户在弹出的浏览器里手动登录。

### 采集当前页面

```http
POST http://127.0.0.1:39118/collect/capture
Content-Type: application/json

{
  "waitMs": 500
}
```

返回当前 URL、标题、是否疑似登录页、截图 Base64、候选元素列表。

### 保存登录态

```http
POST http://127.0.0.1:39118/auth/save
Content-Type: application/json

{
  "workspaceId": "account-open",
  "environmentId": "test"
}
```

登录态保存在用户本机：

```text
%USERPROFILE%\.auto-web-ui-runner\auth
```

### 清空登录态

```http
POST http://127.0.0.1:39118/auth/clear
Content-Type: application/json

{
  "workspaceId": "account-open",
  "environmentId": "test"
}
```

## 一期边界

- 只支持本机 `127.0.0.1`。
- 一期只要求 Chromium。
- 一期不做 exe 安装包、不做 CI Runner、不做远程节点。
- 平台前端接入后，AI 采集页会先检测 Runner，再调用打开页面和继续采集。
