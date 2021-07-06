---
title: 关于网站安全的若干事项
date: 2021-07-06 13:45:43
tags: 计算机基础
categories:
- 计算机基础
---
# 序言
> 以下内容为个人学习总结，不保证完全信息严谨可靠

# 背景
>由于Http协议是无状态协议，也就是说当用户通过浏览器像服务器发送请求时，服务器无法判断用户身份，所以为了确定请求的合法性，浏览器请求时必须提交额外的数据，比如cookie等

# 产生的问题
>为了窃取用户数据就产生了各种各样的非法请求，总的来说分为两类：
>  * 1.合法用户（受害者）提交非法请求（XSS跨站脚本攻击，点击劫持/UI覆盖攻击）
>  * 2.非法用户提交合法请求（CSRF跨站请求伪造）
>## XSS跨站脚本攻击
>>### 名称
>>跨站脚本攻击（Cross Site Scripting），为了不和层叠样式表（Cascading Style Sheets,CSS）的缩写混淆，故将跨站脚本攻击缩写为XSS。
>>### 分类
>> + ReflectedXSS（基于反射的XSS攻击）
>> + StoredXSS（基于存储的XSS攻击）
>> + DOM-bases or local XSS（基于DOM或本地的XSS攻击）
>>### 概括
>>XSS攻击的本质：利用一切手段在目标用户的浏览器中执行攻击脚本
> 
> 
>## CSRF攻击
>>### 名称
>>CSRF(Cross-site request forgery)，跨站请求伪造，也被称为one cliclk attack/session riding，缩写为：CSRF/XSRF
>>### 原理
>>攻击者盗用用户身份，以合法名义发送请求。
>>### 示意图
>>![CSRF攻击思想](https://pic002.cnblogs.com/img/hyddd/200904/2009040916453171.jpg "CSRF攻击思想")
>>从上图可以看出，完成一次CSRF攻击，受害者必须依次完成两个步骤：
>>* 1.登录受信任的网站A，并在本地生成Cookie
>>* 2.在不登出A的情况下，访问危险网站B

>>Csrf攻击是源于WEB的隐式身份验证机制，WEB的身份验证机制虽然可以保证一个请求来自某个用户的浏览器，但却无法保证该请求是用户批准发送的。

>>### CSRF的防御
>>主要从服务端和客户端两方面着手，从防御效果来看，服务端防御比较好
>>#### 服务端CSRF防御
>>服务端的CSRF方式总的思想就是在客户端页面增加<font color="red">伪随机数</font>
>>+ Cookie Hashing（所有表单都包含同一个伪随机值）
>>   - 在表单里增加Hash值，以认证是用户发送的请求
>>   - 然后在服务器端进行Hash值验证
>>+ 验证码
>>   - 每次用户提交都需要在表单中填写一个图片上的随机字符串，这个完全可以解决CSRF
>>+ One-Time Tokens（不同的表单包含不同的伪随机值）



## 参考链接
1.[关于web安全的三个攻防姿势](http://blog.nsfocus.net/offensive-defensive-stances-web-security/)

2.[浅谈CSRF攻击方式](https://www.cnblogs.com/hyddd/archive/2009/04/09/1432744.html)