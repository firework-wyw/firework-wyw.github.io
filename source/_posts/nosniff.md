---
title: nosniff
date: 2021-07-19 12:17:49
tags: Bug
---
**问题**
> 来自“http://localhost:8080/login.html”的资源已被阻止，因为 MIME 类型（“text/html”）不匹配（X-Content-Type-Options: nosniff）
# 解决方案
> 有网友是这样说的 ：
>> 我想知道该文件是否根本不存在，而 Joomla 会返回默认的 404 响应？

>然后在浏览器里查看网络资源，果然没有，应该是被Spring Security拦截掉了，然后Spring Security返回的不是网页期待的格式，所有报错。
在Spring SecurityConfig中放开css权限就可以了。
# 参考链接
1. [X-Content-Type-Options ](https://developer.mozilla.org/docs/Web/HTTP/Headers/X-Content-Type-Options?utm_source=mozilla&utm_medium=firefox-console-errors&utm_campaign=default)
2. [自定义文件的位置错误...](https://github.com/gantry/gantry5/issues/2600)