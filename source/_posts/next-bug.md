---
title: 修改为next主题的bug
date: 2021-07-13 10:08:47
tags: Bug
---
# 问题出现
为了给网站添加搜索功能，网上教程只需要3步：
> 1.安装插件
```html
npm install hexo-generator-searchdb --save
```
> 2.修改站点配置文件
```yaml
search:
    path: search.xml
    field: post
    format: html
    limit: 10000
```
> 3.修改主题配置文件
```yaml
local_search:
  enable: true
```
# 解决方案
> 由于是需要支持搜索的主题才能启用搜索，所以原先的百度efe主题只能弃用，Clone`nexo`主题。
> 配置好后，运行
```html
hexo clean & hexo g & s
```
点击搜索后一直在载入，网上说可能资源文件被浏览器插件拦截了或第一次加载比较慢，然而本地看了一下，都不是也不能解决问题。
发现控制器里提示`search.html 404`，查看配置文件发现`path: search.xml`错写成了`path: search.html`，由此问题解决

# 参考链接
1.[hexo 搜索功能](https://blog.csdn.net/ganzhilin520/article/details/79047983)