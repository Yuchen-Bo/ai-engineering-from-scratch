# 前端页面打开方式

这个项目的前端页面是一个静态站点，入口文件在 `site/` 目录下，不需要 `npm install`，也没有 `package.json` 里的前端启动脚本。

## 推荐方式：本地静态服务器

在项目根目录运行：

```powershell
python -m http.server 8000 -d site
```

然后在浏览器打开：

```text
http://localhost:8000/
```

常用页面：

```text
http://localhost:8000/index.html
http://localhost:8000/catalog.html
http://localhost:8000/glossary.html
http://localhost:8000/prereqs.html
```

如果 `8000` 端口被占用，可以换成其他端口，例如：

```powershell
python -m http.server 5173 -d site
```

对应打开：

```text
http://localhost:5173/
```

## 直接打开 HTML

也可以直接双击或用浏览器打开：

```text
site/index.html
```

这种方式适合快速看首页。更推荐使用本地静态服务器，因为课程阅读页和浏览器安全策略、外部资源请求相关，用 `http://localhost` 打开更稳定。

## 课程阅读页

课程详情页使用 `lesson.html`，通过 `path` 参数指定课程目录，例如：

```text
http://localhost:8000/lesson.html?path=phases/01-math-foundations/01-linear-algebra-intuition
```

注意：`lesson.html` 会从 GitHub raw URL 拉取课程正文和 quiz 数据，因此需要联网才能完整显示课程内容。

## 重新生成前端数据

如果修改了 `README.md`、`ROADMAP.md` 或 `glossary/terms.md`，可以重新生成 `site/data.js`：

```powershell
node site/build.js
```

项目的 Vercel 配置也是这样构建站点的：

```text
buildCommand: node site/build.js
outputDirectory: site
```

## 线上页面

README 中给出的线上地址是：

```text
https://aiengineeringfromscratch.com
```
