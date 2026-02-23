---
title: Path Tracing
date: 2026-02-17 22:37:45
tags:
  - graphics
  - games101
mathjax: true
---
## 基于光线追踪的渲染
与基于光栅化的render相比，光线追踪最直接的不同在于渲染一个frame buffer时，不再遍历场景中的所有mesh，通过zbuffer等算法判断他们是否能过被打在相机平面上；而是直接遍历成像平面的每个像素，发出一条条的射线，记录射线击中的物体情况，直到最大次数或者击中光源（光源有很多，我们暂且考虑点光源），由于光路的可逆性，命中光源的射线的源像素将得到着色信息并计算最终结果。

## 几何的表达

对于场景中的所有物体，我们希望能快速做到：
- 快速得到一个射线和这个物体的相交情况
- 获得物体表面的属性（如法向量）
这里用可以用数学描述的球和mesh中最小的三角形来示范。
### 射线

一条射线可以通过原点$O$和方向$D$决定。射线上的任意一点$p$ $$p = O+tD$$
当方向$D$是单位长度的时候，$t$就代表了从原点出发的距离。
### 球
球的几何表达可以由半径$r$, 球心$C$决定。
```cpp
struct Sphare{

Vector3f center;  
float radius, radius2;

}
```
球上任意一点$p$ 可以描述为：$$||p - C|| = r^2$$
### mesh
mesh本质是一堆三角形。
我们要存储：
- 每个顶点vert的三维坐标xyz
- 哪些顶点组成一个三角形
- 三角形的数量
- 每个顶点用于采样贴图的uv坐标
```cpp
struct Mesh{
std::unique_ptr<Vector3f[]> vertices;     // 顶点 的三维坐标  
uint32_t numTriangles;                    // 顶点组成的三角形的数量  
std::unique_ptr<uint32_t[]> vertexIndex;  // 顶点的索引 len = numTriangles * 3
std::unique_ptr<Vector2f[]> stCoordinates;// uv for every vert, index by vertexIndex[i_Tri]
}
```
对于三角形内任意一点，可以通过重心坐标表示。三维情况下满足：

$$P = wv_0 + uv_1 + vv_2\space, u+v+w = 1 \space, 当且仅当u ，v ， w > 0时， P在三角形内$$
### 射线和几何的求交
对于任何可以用数学公式描述的几何形状，求交点最直观的做法就是直接定义一个同时满足射线和几何数学描述的理想交点$P_{intersect}$ ,然后判断这个点是否存在。

对于球来说，就是联立射线和球的数学方程。$$||O+tD - C|| = r^2$$
```cpp
bool intersect(const Vector3f& orig, const Vector3f& dir, float& tnear, uint32_t&, Vector2f&) const override  
{  
    // analytic solution  
    Vector3f L = orig - center;  
    float a = dotProduct(dir, dir);  
    float b = 2 * dotProduct(dir, L);  
    float c = dotProduct(L, L) - radius2;  
    float t0, t1;  
    if (!solveQuadratic(a, b, c, t0, t1))  
        return false;  
    if (t0 < 0)  
        t0 = t1;  
    if (t0 < 0)  
        return false;  
    tnear = t0;  
  
    return true;  
}
```
对于三角形而言情况相对复杂一些。但可以很自然的想到：三个点确定一个平面，首先判断射线是否和这个平面相交，再判断交点是否满足在三角形内的条件即可。

每个三角形的三个顶点$v_0, v_1, v_2$, 可以**固定顺序**的得到两个向量：
$$e_1 = v_1 - v_0$$ $$e_2 = v_2 - v_0$$
那么这两个向量张成的平面的法线就是$$N = e_1  \times e_2$$
这时候只要$D · N = 0$那么射线垂直于法线也就平行于平面，此时永远无法相交；反之必然相交。
平面上任意一点P满足：$$n·(P - v_0) = 0$$
带入射线方程解得:
$$t = \frac{(v_0 - O)}{D· n}\space, \space  P = O+tD$$

判断点P是否在三角形内就需要计算重心坐标：
$$P = wv_0 + uv_1 + vv_2, 当且仅当u ，v ， w > 0时， P在三角形内$$
其中uvw的值也可以通过$P$和三角形两个顶点围成的三角形的面积与整个三角形的面积之比得到：
$$u = \frac{S_{pv_{0}v_{1}}}{S},  v = \frac{S_{pv_{0}v_{1}}}{S}$$
整个三角形的面积是可以直接得到的。小三角形也只需要计算出两个即可，$w$可以通过$w = 1 - u - v$得到。

我们还需要知道射线方向和三角形法线的方向是否一致来判断我们射线时从正面还是反面打到三角形上的，来决定光源是否能过穿透。这也很好做，只需要对射线方向$dir$和$N$算一次点乘即可。

至此已经完成了射线和三角形的求交。注意我们需要关注的部分：1、P是否和三角形面有交；2、P是否在三角形内；3、射线和三角形法线方向是否一致。可以发现以上的计算过程每次的结果都是一个结论，对于之后的计算还需要增加新的条件计算。我们希望一次性把**判断平行 + uvw +t**全部完成。其实上面的所有步骤都是在解决一个线性方程组：$$O + tdir = v_0 + ue_1 + ve_2 $$
如果这个方程有解，其行列式$det$的值一定是大于0的。这个式子里面$O, v_0$都是常数，则有
$$T = O-v_0 = ue_1 + ve_2 -tdir$$
未知量提出来:$$Ax = T， 即 \begin{bmatrix}e_1 & e_2 & -D\end{bmatrix}\begin{bmatrix}u \\ v \\ t \end{bmatrix} = T$$
克莱姆法则描述了：
$$x_i = \frac{det(A_i)}{det(A)}$$其中$A_i$是把第i列替换成T得到的新矩阵。
至此，对于直线与三角形相交的求解问题通过一个线性方程组变成了如何求解$det(A)、det(A_i)$的值。这个问题转换最直接的好处是，这些值都能通过已知量快速的组合计算出来。

$$\begin{aligned}
det(A) &= det([e_1, e_2, -D]) \\
       &= -det([e_1, e_2, D])
\end{aligned}$$
3x3的行列式可以通过三个列向量的组合直接得到值：
$$-det({e_1, e_2, D}) = -e_1 · (e_2 \times D)$$
叉乘交换顺序需要加符号：
$$ -e_1 · (e_2 \times D) = -e_1 · (-D \times e_2)$$
$$\begin{aligned}
det(A) = e_1 · (D\times e_2) \\
\end{aligned}$$
将T分别替换三个位置，利用克莱姆法则得到xi的列向量组合后经过简单的推导，可以得到：

|                                         |                                |
| --------------------------------------- | ------------------------------ |
| $\det(A)= e1\cdot(D\times e2)$          | `det = dot(e1, cross(dir,e2))` |
| $u=\frac{T\cdot(D\times e2)}{\det(A)}$  | `u = dot(tvec,pvec)/det`       |
| $v=\frac{D\cdot(T\times e1)}{\det(A)}$  | `v = dot(dir,qvec)/det`        |
| $t=\frac{e2\cdot(T\times e1)}{\det(A)}$ | `t = dot(e2,qvec)/det`         |
这样，我们只需要使用$D, e_1, e_2$就能得到uvt，判断射入的正反。大大提升了判断命中的效率。

```cpp
bool rayTriangleIntersect(const Vector3f& v0, const Vector3f& v1, 
const Vector3f& v2, const Vector3f& orig, const Vector3f& dir, 
float& tnear, float& u, float& v)  
{  
  
    float ESP = 1e-5;  
    Vector3f e1 = v1 - v0;  
    Vector3f e2 = v2 - v0;  
  
    Vector3f pvec = crossProduct(dir, e2);  
    float det = dotProduct(e1, pvec);  
  
    if (fabs(det) < ESP) return false;  
  
    float invDet = 1.0f / det;  
  
    Vector3f tvec = orig - v0;  
    u = dotProduct(tvec, pvec) * invDet;  
    if (u < 0.0f || u > 1.0f) return false;  
    Vector3f qvec = crossProduct(tvec, e1);  
    v = dotProduct(dir, qvec) * invDet;  
    if (v < 0.0f || u + v > 1.0f) return false;  
    float t = dotProduct(e2, qvec) * invDet;  
    tnear = t;  
    return true;  
  
}
```
## 相机射线

## 碎碎念

现在是2026年的2月17日。晚上刚刷到thu的一个工作，直接通过diffusion在VR中实施生成和输入图片交互的结果。不禁让我再次感叹：图形学的终点是否已经到来？Rendering这个繁重庞大的工程领域，是否已经要被当作旧时的精密机器被刻在历史的丰碑之上？刚刚窥见这个美丽领域一眼，却要转瞬迎来大模型时代的滚滚车轮。技术爆炸面前的无奈或许就是这样吧。

或许有一天rendering将会不复存在，我们也将成为数字丰碑上的一行小字。

谁知道呢 :) .