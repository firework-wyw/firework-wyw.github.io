---
title: 复杂匹配规则
date: 2021-07-05 13:57:30
tags: 计算机基础
---
匹配开头和结尾
>用`^`表示开头，用`$`表示结尾

匹配指定范围
> * <font color="red">[123456789]</font>可以匹配<font color="red">[1~9]</font>，还有另外一种表示方法<font color="red">[0-9a-fA-F]</font>，
> 还有一种排除法，即不包含指定范围的字符。<font color="red">[^1-9]</font>

或规则匹配
>用`|`连接的两个正则规则是或规则，例如<font color="red">AB|CD</font>

使用括号
>如果匹配字符串<font color="red">learn java</font>、<font color="red">learn php</font>、<font color="red">learn go</font>，可以这样写`learn\\s(java|php|go)`
