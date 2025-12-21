---
title: PPO
date: 2025-12-19 23:59:31
tags: RL UE
mathjax: true
---


## 一些RL的常见概念
### On-policy / Off-policy
- On-policy:  `学习的策略`和`收集数据用`的策略是同一个
  - 用当前策略$\pi$去和环境交互采样
  - 更新的目标也是让同一个$\pi$变的更好
  - 当前策略产生数据，学习目标也是当前策略
- Off-policy: `target policy` 要学习/评估的策略，可以和 收集数据的策略（behavior policy）
  - 用一个更发散的策略去采样数据
  - 更新时假设目标策略是另一个策略。
  - |
## 在AirSim里尝试RL！

第一次接触RL的结果是，对问题建模的方式发生了根本性的变化。

