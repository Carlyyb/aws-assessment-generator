# theme.css 结构与优先级分析

本文档旨在分析 `ui/src/styles/theme.css` 文件的结构和 CSS 优先级规则，以便在未来开发和问题排查中提供清晰的指导。

## 1. 文件核心结构

`theme.css` 文件主要遵循以下结构化顺序，从基础定义到具体组件覆盖：

1.  **CSS 变量定义 (`:root`)**:
    *   文件首先在 `:root` 选择器中定义了一套基础的现代化主题变量，作为默认主题（YAS Blue）。
    *   随后，通过属性选择器 `[data-theme="..."]` 为多个不同主题（如 `cloudscape-light`, `cloudscape-dark` 等）定义了各自的变量值。这是实现主题切换的核心机制。

2.  **动态主题应用器**:
    *   定义了一些规则，用于将 CSS 变量应用到全局。
    *   特别是 `[style*="--theme-primary-color"]` 选择器，它允许通过内联样式（inline styles）从 React 组件动态传递主题颜色，实现实时主题预览和自定义。

3.  **基础组件样式覆盖 (`.awsui-*`)**:
    *   这是文件的主体部分，针对 Cloudscape Design System 的各个组件（如 `awsui-app-layout`, `awsui-top-navigation`, `awsui-button`, `awsui-input` 等）进行了样式增强和覆盖。
    *   这些样式大量使用了文件中定义的 CSS 变量，确保组件外观与当前主题保持一致。

4.  **布局与定位覆盖**:
    *   包含一些高优先级的规则（例如，使用 ID 选择器 `#h`），用于修改核心布局组件（如 `AppLayout`, `TopNavigation`）的定位行为，例如将其设置为 `position: fixed` 以实现固定导航栏。

5.  **全局样式增强**:
    *   使用宽泛的选择器（如 `body`, `a[class*="awsui"]`）来强制应用全局背景色、文本颜色和链接颜色，确保整个应用视觉风格的统一。

6.  **响应式设计与可访问性**:
    *   文件末尾包含 `@media` 查询，用于处理响应式布局（如 `@media (max-width: 768px)`）和可访问性需求（如 `prefers-reduced-motion`, `prefers-contrast`）。

## 2. CSS 优先级与特异性（Specificity）分析

在排查 CSS 问题时，理解样式的优先级至关重要。此文件中的优先级顺序如下：

1.  **`!important` 标记**:
    *   **最高优先级**。文件中大量使用了 `!important`，尤其是在覆盖 Cloudscape 默认组件样式时。
    *   **排查指南**: 如果某个样式无法生效，首先检查是否有其他规则使用了 `!important` 覆盖了它。例如，按钮和顶部导航栏的背景色几乎总是被 `!important` 强制设定。

2.  **内联样式 (Inline Styles)**:
    *   虽然文件中没有直接编写内联样式，但 `[style*="--theme-primary-color"]` 规则的设计就是为了配合 React 组件中的内联样式，赋予其极高的优先级，用于动态主题切换。

3.  **ID 选择器 (`#`)**:
    *   例如 `#h` 用于定位顶部导航栏。ID 选择器具有非常高的特异性，仅次于 `!important`。

4.  **属性选择器 (`[]`) 与伪类组合**:
    *   文件广泛使用属性选择器（如 `[data-theme]`, `[class*="..."]`）和伪类（如 `:hover`, `:focus`）的组合。
    *   `[class*="..."]` (属性包含选择器) 被用来匹配 Cloudscape 动态生成的、包含随机字符串的类名。这使得选择器非常具体，因此优先级较高。
    *   **排查指南**: 当样式不符合预期时，需要使用浏览器的开发者工具检查元素上的具体类名，并确认 CSS 选择器是否正确匹配。

5.  **类选择器 (`.`)**:
    *   标准的组件类，如 `.awsui-button`, `.awsui-container`。

6.  **类型选择器 (Type Selectors)**:
    *   基础的 HTML 元素选择器，如 `body`, `a`, `h1`。它们的优先级较低。

7.  **通用选择器 (`*`)**:
    *   优先级最低，用于设置全局过渡效果 (`transition`) 和重置样式。

## 3. 关键排查点

*   **顶部导航栏 (`TopNavigation`) 和侧边栏 (`SideNavigation`)**:
    *   这些组件的样式被多个高优先级规则锁定，包括 ID 选择器 `#h` 和大量 `!important`。
    *   它们的 `position` 被强制修改为 `fixed`。如果出现布局问题（如内容被遮挡），应检查 `awsui-app-layout` 的 `padding-top` 和 `margin-left` 是否正确设置。

*   **按钮 (`Button`)**:
    *   按钮样式（特别是 `primary` 变体）被 `!important` 强力覆盖，以确保其在任何情况下都显示主题色。
    *   不同变体（`primary`, `normal`, `link`）的样式是通过不同的类名或属性选择器（`data-variant`）来区分的。

*   **颜色不生效**:
    *   检查 CSS 变量是否正确定义和应用。
    *   使用开发者工具检查元素的 `computed` 样式，查看最终是哪个 CSS 变量（如 `--primary-color`）和规则在起作用。
    *   注意 `dark` 主题有自己的一套颜色变量，确保在暗黑模式下使用的是正确的变量。

*   **动态主题**:
    *   动态主题依赖于在根元素（通常是 `<html>`）上设置 `data-theme` 属性，或通过内联样式传递 CSS 变量。如果主题未生效，请检查该属性是否已正确应用。

通过理解以上结构和优先级规则，可以更高效地定位和解决 `theme.css` 相关的样式问题。
