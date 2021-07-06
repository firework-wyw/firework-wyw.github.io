---
title: 什么是JWT
date: 2021-07-06 16:28:51
tags: 计算机基础
---
# 什么是JWT
>JWT(Json web token)，用为了在网络应用环境间传递声明而执行的一种基于JSON的开放标准。特别适用于分布式站点的单点登录场景。
> JWT的声明一般被用来在用户和服务器之间传递被认证的用户身份信息，也可以增加一些额外的其他业务逻辑所必的声明信息。
> 该token也可直接被用于认证，也可被加密
# 为什么要用JWT
* 基于Session的认证难以扩展
* 基于Session认证的记录被保存在服务器中，随着认证用户的增多，服务端的开销会明显增大
* 基于Cookie的认证容易受到CSRF攻击
# 如何使用JWT
基于Token的鉴权机制类似于http协议，也是无状态的，它不需要在服务器去保留用户的认证信息或会话信息。
>## 流程是这样的
> * 用户使用用户名、密码来请求服务器
> * 服务器验证用户信息
> * 服务器通过验证发送给用户一个token
> * 客户端存储token，每次请求时附带token
> * 服务器验证token的值，并返回数据

>Tips:token的加密方式使验证不需要像上篇介绍的防范web攻击而每次请求最好带上随机字符

# JWT长什么样
```html
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWV9.TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ
```
JWT是由三段信息构成的，用<font color="red">.</font>连接。
## header
包含两部分信息：
* 声明类型，这里是jwt
* 声明加密的算法
```html
{
  'typ': 'JWT',
  'alg': 'HS256'
}
```
然后将头部进行base64加密（该加密是可以对称解密的），构成了第一部分
```html
eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9
```
## payload
载荷就是存放有效信息的地方，包含三个部分：
* 标准中注册的声明
* 公开的声明
* 私有的声明

标准中注册的声明（建议但不强制使用）
* iss:jwt签发者
* sub:jwt所面向的用户
* aud:接收jwt的一方
* exp:jwt的过期时间，这个过期时间必须大于签发时间
* nbf:定义在什么时间之前，该jwt都是不可用的
* iat:jwt的签发时间
* jti:jwt的唯一身份标识，主要用来作为一次性的token，从而回避重放攻击

公有的声明：
可以添加任何信息一般添加用户的相关信息或其他业务需要的必要信息，但不建议添加敏感信息，因为该部分在客户端可解密

私有的声明：
是提供者和消费真所共同定义的声明，一般不建议存放敏感信息，因为base64是对称解密的，意味着该部分信息可以归为类明文信息

定义一个payload:
```html
{
  "sub": "1234567890",
  "name": "John Doe",
  "admin": true
}
```
然后将其进行base64加密，得到jwt的第二部分
```html
eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWV9
```

## signature
jwt的第三部分是一个签证信息，这个签证信息由三部分组成：
* header(base64后的)
* payload(base64后的)
* secret
这个部分需要base64加密后的header和base64加密后的payload，使用<font color="red">.</font>连接组成字符串，然后通过header中声明的加密方式进行加盐secret组合加密，就构成了jwt的第三部分
  
```html
// javascript
var encodedString = base64UrlEncode(header) + '.' + base64UrlEncode(payload);

var signature = HMACSHA256(encodedString, 'secret'); // TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ
```