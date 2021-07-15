---
title: Spring Bean 的三种定义方式
date: 2021-07-14 17:27:57
tags: 计算机基础
---
# 基于XML的配置
```xml
<beans>
    <import resource="resource.xml"/>
    <bean id="userService" class="com.example.***.UserService" init-method="init" destory-method="destory">
    </bean>
    <bean id="message" class="java.lang.String">
        <constructctor-arg index="0" value="test"></constructctor-arg>
    </bean>
</beans>
```

# 基于注解的配置
1.使用注解声明Bean
> Spring提供了四个注解，这些注解与xml定义Bean的效果一致，将组件交给Spring容器管理。组件的名称默认是类名（首字母变小写），可自定义
> * @Component
> * @Controller
> * @Service
> * @Repository
2.配置扫描包的路径
```xml
<context:component-scan bean-package="com.example.spring">
    <context:include-filter type="regex" expression="com.example.spring.*"></context:include-filter>
    <context:exclude-filter type="aspectj" expression="com.example.spring"></context:exclude-filter>
</context:component-scan>
```
# 基于JAVA类的配置
1.使用@Configuration注解
2.使用@Bean注解

# 参考链接
1.[Spring Bean定义的三种方式](https://www.cnblogs.com/wslook/p/9161560.html)
