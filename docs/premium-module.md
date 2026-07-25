# SYLVAN 付费模块 MVP

## 当前实现

- 支付 Provider：`mock`
- 登录方式：开发环境邮箱验证码（验证码仅在非生产环境返回）
- 本地数据库：Node.js 内置 SQLite，运行文件位于 `data/runtime/premium.db`
- 付费文件：不放在公开静态目录；当前下载接口返回鉴权后的测试文本包
- 真实支付：未接入、未伪装完成

## 本地运行

1. 使用 Node.js 22 或更高版本。
2. 复制 `.env.example` 为 `.env`，本地测试至少保持 `PAYMENT_PROVIDER=mock`。
3. 运行 `npm run dev`。
4. 打开 `http://127.0.0.1:4173/premium/`。

项目不依赖第三方 npm 包，SQLite 使用 Node.js 内置模块。

## 支付适配层

统一入口在 `server/payments/index.mjs`。每个 Provider 需要实现：

- `createPayment`
- `queryPayment`
- `verifyCallback`
- `refundPayment`
- `closePayment`

`mock` 额外实现内部测试专用的 `settle`，可以模拟成功、失败和取消。微信、支付宝和 Stripe 当前只是未配置占位适配器，不能用于真实收款。

切换 Provider：

```env
PAYMENT_PROVIDER=mock
```

在真实 Provider 完成签名、回调验签、退款、关单并填入服务器端环境变量后，才可以切换为 `wechat`、`alipay` 或 `stripe`。

## 生产部署前必须完成

当前线上平台是 Vercel。Vercel Serverless 的本地文件系统不能作为持久数据库，因此本地 SQLite 仅用于 MVP 开发和业务验收，不能直接承载生产订单。

生产上线付费能力前需要：

1. 将数据库适配到持久化托管数据库（推荐 Supabase Postgres 或 Vercel Postgres）。
2. 将邮箱验证码接入真实邮件服务或成熟认证服务。
3. 将付费压缩包上传到私有对象存储，并由下载接口生成 5–15 分钟短期签名地址。
4. 将 Node API 拆为 Vercel Functions 或部署为可持久运行的后端服务。
5. 在 Vercel 控制台配置环境变量，绝不提交 `.env`。
6. 完成真实支付平台的商户申请、回调域名配置和验签测试。

在以上项目完成前，请保持生产环境 `PAYMENT_PROVIDER=mock`，并明确显示“测试支付、不会扣款”。

## 商品与私有文件

测试商品在 `db/seed.sql` 中创建，价格单位是分，`1990` 即 ¥19.9。商品详情由数据库读取，浏览器不能提交或覆盖订单金额。

正式商品文件不得放入 `assets/` 或其他公开目录。`product_files.storage_key` 只保存私有存储键，下载时由服务端检查登录用户的购买记录。

