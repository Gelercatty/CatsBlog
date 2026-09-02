---
title: 最优永存：用雅可比伪逆求解 IK
date: 2026-04-06 18:58:41
tags:
  - 图形学
  - 游戏开发
  - IK
  - Unity
  - 线性代数
mathjax: true
---

在 Unity 里拖动一个 IK Target 时，我们希望角色的手、脚或者武器挂点跟着目标移动，而不是手动调骨骼链上的每一个关节。

这个需求说起来很直观：目标在那里，让手过去就行。但真正开始写 Solver，就会遇到几个问题：

- 一条骨骼链可能有很多自由度，同一个目标通常不止一个解；
- 目标可能在骨骼链的可达范围之外；
- 手臂完全伸直时，某些旋转几乎无法带来有效位移；
- 更新太激进会抖动甚至发散，太保守又会在有限帧数内追不上目标。

于是我把 CCD、Jacobian Transpose、固定阻尼 DLS 和基于 SVD 的自适应 DLS 都塞进 Unity，拿同一组目标点跑了一遍。这篇就顺着实现过程聊两个问题：**雅可比矩阵在 IK 里究竟代表什么，以及这些 Solver 到底该怎么选。**

完整代码放在 [Gelercatty/IK](https://github.com/Gelercatty/IK)。

![Jacobian IK Solver 演示](https://images.geler.org/blog/a7/a7d88015ef886c7a51aa.gif)

## 从 FK 到 IK

先看一条由 $n$ 个关节组成的骨骼链。每个关节相对父节点有一个固定偏移 $t_i$，以及由关节参数 $q_i$ 决定的局部旋转 $R_i(q_i)$。它的局部齐次变换可以写成

$$
T_i(q_i)=
\begin{bmatrix}
R_i(q_i) & t_i \\
0 & 1
\end{bmatrix}.
$$

从根节点一路把变换乘到末端，就得到了末端执行器的位置：

$$
\tilde p_e(q)=T_1(q_1)T_2(q_2)\cdots T_n(q_n)\tilde p_{\mathrm{local}}.
$$

这就是正向运动学（Forward Kinematics，FK）：给定关节参数 $q$，计算末端位置 $p_e$。

IK 做的是反方向的事。现在我们只有目标位置 $p_t$，需要找到一组 $q$，让末端尽量靠近它：

$$
\min_q \|p_t - p_e(q)\|^2.
$$

麻烦在于，FK 是一串旋转和平移的连乘，关于关节角通常是非线性的。想直接把它“倒过来”求解，大多数时候并不现实。

## 两种不需要矩阵求逆的办法

### Two-Bone IK

如果链上只有两段骨骼，例如上臂和前臂，可以利用余弦定理直接求解析解。先根据目标距离算出肘关节夹角，再结合指定的弯曲平面恢复肩部旋转。

Two-Bone IK 很快、很稳定，也容易控制肘部朝向，因此游戏里经常直接用于手臂和腿。但它依赖“两段骨骼”这个特殊结构，不能自然地扩展到尾巴、触手或脊柱这样的长链。

### CCD

CCD（Cyclic Coordinate Descent）更通用。它从末端向根节点倒着遍历关节，每次只旋转一个关节，让“关节到末端”的方向尽量对齐“关节到目标”的方向。

```text
repeat:
    for joint from end to root:
        u = end_effector - joint
        v = target - joint
        rotate joint from u toward v
        recompute forward kinematics
```

![CCD Solver 演示](https://images.geler.org/blog/f9/f9a68d44777ea49589cb.gif)

CCD 的优点是简单直观，而且不依赖大型矩阵运算。缺点也很明显：它逐关节贪心更新，容易产生比较夸张的弯曲；当需要同时处理末端朝向、多个控制点或软约束时，逻辑会迅速变复杂。

## 雅可比矩阵：关节动一点，末端会往哪走？

雅可比矩阵在这里并不神秘。它回答的是一个非常具体的问题：

> 当前姿态下，每个关节沿自己的自由度转动一点，末端执行器会产生怎样的瞬时位移？

把 FK 记为

$$
p_e=f(q),
$$

在当前姿态附近做一阶近似：

$$
f(q+\Delta q)\approx f(q)+J(q)\Delta q.
$$

令当前误差为

$$
e=p_t-f(q),
$$

那么一次关节更新需要尽量满足

$$
J(q)\Delta q\approx e.
$$

原本的非线性 IK，就这样被变成了一个局部线性问题。每次只相信当前姿态附近的一小步，更新关节后重新计算 FK 和 Jacobian，再继续下一轮。

```text
q = initial_pose

for iteration in max_iterations:
    p = FK(q)
    e = target - p
    if length(e) < tolerance:
        break

    J  = BuildJacobian(q)
    dq = SolveDeltaQ(J, e)
    q  = ApplyDelta(q, dq)
```

不同 Jacobian Solver 的核心区别，基本都集中在 `SolveDeltaQ` 这一步。

## 不用真的去求所有偏导

如果末端只约束三维位置，$J$ 的每一列对应一个旋转自由度对末端速度的贡献。

设某个旋转自由度的关节位置为 $o_j$，它在世界空间中的旋转轴为单位向量 $a_j$，末端位置为 $p_e$。刚体绕轴旋转时，末端的瞬时线速度满足

$$
v=\omega\times(p_e-o_j).
$$

因此 Jacobian 的第 $j$ 列可以直接写成

$$
J_j=a_j\times(p_e-o_j).
$$

整条链的位置 Jacobian 就是

$$
J_p(q)=
\begin{bmatrix}
a_1\times(p_e-o_1) &
a_2\times(p_e-o_2) &
\cdots &
a_n\times(p_e-o_n)
\end{bmatrix}.
$$

这在实现上很方便：执行一次 FK，拿到所有关节的世界坐标位置和旋转轴，就可以按列组装 Jacobian，不需要在运行时做符号求导。

如果还要约束末端朝向，可以把角速度 Jacobian 拼在位置部分下面：

$$
J_{task}(q)=
\begin{bmatrix}
a_1\times(p_e-o_1) & \cdots & a_n\times(p_e-o_n) \\
a_1 & \cdots & a_n
\end{bmatrix}.
$$

同理，想让肘部靠近某个平面、让武器挂点保持稳定，或者同时控制多个末端，也可以继续追加误差项和 Jacobian 子块。这是 Jacobian 方法相比 CCD 更有扩展性的地方。

## 直接使用 $J^{-1}e$ 的局限

如果 $J$ 恰好是可逆方阵，当然可以写成

$$
\Delta q=J^{-1}e.
$$

但游戏里的 IK 很少这么规整：

- 自由度多于约束时，$J$ 是宽矩阵，同一个末端目标可能有无穷多组关节解；
- 约束多于自由度时，$J$ 是高矩阵，目标通常只能近似满足；
- 骨骼完全伸直或折叠时，一些列会趋于相关，$J$ 会掉秩并接近奇异。

以完全伸直的手臂为例。此时两个关节带来的末端运动方向非常接近，某些方向几乎无法通过微小旋转实现。数学上表现为 Jacobian 的小奇异值；视觉上则表现为关节突然大幅旋转、来回震荡，或者怎么迭代都推不动末端。

因此我们通常不显式计算逆矩阵，而是选择更适合实时迭代的增量求解方法。

## 三种 Jacobian 更新方式

### Jacobian Transpose

把位置误差写成能量

$$
E(q)=\frac12\|e\|^2,
$$

其负梯度方向可以由 $J^{\mathsf T}e$ 得到，于是使用

$$
\Delta q=\alpha J^{\mathsf T}e,
$$

其中 $\alpha$ 是步长。

它不需要求逆，计算便宜，很适合实时游戏。但它对步长敏感：太小追不上，太大容易越过目标并震荡。

### 伪逆

Moore-Penrose 伪逆给出

$$
\Delta q=J^+e.
$$

在超定系统中，它给出最小二乘解；在欠定系统中，它给出满足约束的最小范数解。不过，接近奇异位形时，小奇异值会被取倒数并大幅放大，造成很大的关节更新。

### 阻尼最小二乘 DLS

DLS 在误差之外再惩罚过大的关节变化：

$$
\min_{\Delta q}
\|J\Delta q-e\|^2+\lambda^2\|\Delta q\|^2.
$$

对应的解为

$$
\Delta q=
(J^{\mathsf T}J+\lambda^2I)^{-1}J^{\mathsf T}e.
$$

$\lambda$ 越大，更新越保守、越稳定，但收敛也越慢。实际代码里没有必要真的构造逆矩阵，解对应的线性方程即可。

如果对 $J$ 做 SVD：

$$
J=U\Sigma V^{\mathsf T},
$$

就能更直接地观察每个方向的可控性。普通伪逆在奇异方向上的增益是 $1/\sigma_i$，而 DLS 将它变为

$$
\frac{\sigma_i}{\sigma_i^2+\lambda^2},
$$

从而抑制小奇异值带来的爆炸性放大。还可以根据最小奇异值动态调整 $\lambda$：姿态正常时少加阻尼，接近奇异时自动变得保守。

## 把几种 Solver 拉到同一张跑道上

我在 Unity 6.4 中实现了一套独立的骨骼链数据结构、FK、Jacobian 构建器和多种 Solver。下面两张图分别展示了目标可达和目标超出链长的情况。

![可达目标下的骨骼链](https://images.geler.org/blog/69/693be0bfcf93a4efdc3f.png)

![不可达目标下的骨骼链](https://images.geler.org/blog/69/690011d45264ce50ea48.png)

上场的选手有：

- CCD；
- Jacobian Transpose；
- 固定阻尼 DLS，$\lambda\in\{0.03,0.10,0.30\}$；
- 基于 SVD 的自适应阻尼 DLS。

可达目标和不可达目标各使用 200 个固定随机种子生成的样本，所有 Solver 共用同一批目标。最大迭代次数为 16，位置容忍度为 0.1，并在 $0.0001$ 到 $0.05$ 之间扫描步长。

除了成功率、最终误差和耗时，我还记录了关节相对初始姿态的平均旋转偏移。这个指标很重要：两个 Solver 即使都把手送到了目标点，其中一个可能只是轻微调整整条链，另一个却把中间关节扭得很夸张。

### 可达目标

![可达目标 benchmark](https://images.geler.org/blog/43/430109383b795b04de30.png)

### 不可达目标

![不可达目标 benchmark](https://images.geler.org/blog/10/1077f1945e8fe2db39c2.png)

为了方便横向看，我把成功率、迭代次数、运行时间、最终误差和关节偏移压成了一个归一化加权分数。这个分数不是 IK 界的英雄榜，只代表在这组测试条件下，我更在意哪种折中。

![不同 IK Solver 的综合评分](https://images.geler.org/blog/65/6595827ab8341563b95d.png)

| Solver | 最佳步长 | 综合分数 |
| --- | ---: | ---: |
| Jacobian Transpose | 0.05 | 79.1 |
| CCD | 0.05 | 75.7 |
| DLS，$\lambda=0.30$ | 0.05 | 73.2 |
| SVD 自适应 DLS | 0.05 | 71.9 |
| DLS，$\lambda=0.10$ | 0.05 | 70.7 |
| DLS，$\lambda=0.03$ | 0.02 | 66.7 |

## 结果比“高级算法一定更好”更有意思

这次测试里，最简单的 Jacobian Transpose 反而拿到了最高综合分。原因并不神秘：迭代预算只有 16 次，容忍度也相对宽松。在这种设置下，低成本、推进速度快的方法占了优势。

几个比较明显的现象：

1. **步长往往比 Solver 名字更重要。** 步长低于 0.01 时，大多数方法不是数值发散，而是根本来不及走到目标；进入 0.02 到 0.05 后表现才明显改善。
2. **CCD 仍然非常能打。** 它速度快、容易实现，也能稳定接近可达目标；代价是关节旋转偏移较大，姿态容易显得激进。
3. **DLS 的价值是稳定，而不是免费提升精度。** 较大的固定阻尼在这次测试中比低阻尼更好，说明抑制大幅关节更新确实有效，但它也付出了更多运行时间。
4. **SVD 自适应阻尼没有在这个简单场景里赢。** 它更适合多约束、严格精度和明显奇异位形。对于单末端位置、短迭代预算，额外计算还没有转化为足够收益。

所以 IK Solver 没有绝对排名。手脚的 Two-Bone IK、尾巴的 CCD、需要多目标和关节限制的 DLS，完全可能同时出现在一个项目里。

## 实际项目里我会怎么选

- **两段手臂或腿：** 优先 Two-Bone IK，配合明确的弯曲方向。
- **简单长链、追求低成本：** 先试 CCD。
- **需要在有限帧数内快速逼近：** Jacobian Transpose 很实用，但一定要认真调步长或做线搜索。
- **容易遇到完全伸直、不可达目标或多约束：** 使用 DLS，并对步长和阻尼做上限控制。
- **需要分析奇异方向或自适应稳定性：** 再考虑 SVD；不要因为它数学上更完整就默认它一定更快。

无论选择哪种方法，工程上都建议加入：最大单步关节角、关节限位、不可达目标预处理、误差停机条件，以及对目标和关节更新的时间滤波。Solver 负责找到“能走的方向”，动画系统还要负责让它看起来像角色，而不是一串数学关节。

## 代码与参考

- 项目代码：[Gelercatty/IK](https://github.com/Gelercatty/IK)
- 胡敏课程：[GAMES103 - 基于物理的计算机动画入门](https://games-cn.org/games103/)
- Unity 文档：[Animation Rigging](https://docs.unity3d.com/Packages/com.unity.animation.rigging@1.4/manual/index.html)
