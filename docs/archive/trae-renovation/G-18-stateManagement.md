# G-18: 前端状态管理优化改造清单

> 涉及: `client/src/store/useAppStore.js` | 优先级: P2(架构级变更)

## 改造步骤

### SM-01: 引入React Query ✅
- [x] `npm install @tanstack/react-query`
- [x] 在 `client/src/main.jsx` 添加 QueryClientProvider
- [x] 配置: staleTime=30s, refetchOnWindowFocus=true, retry=1

### SM-02: 创建数据获取Hook ✅
- [x] 创建 `client/src/hooks/useProjects.js` — useQuery/useMutation封装
- [x] 创建 `client/src/hooks/useChapters.js` — useQuery/useMutation封装
- [x] 创建 `client/src/hooks/useMaterials.js` — useQuery/useMutation封装(含乐观更新)
- [x] 创建 `client/src/hooks/useReviews.js` — useQuery/useMutation封装

### SM-03: 创建桥接Hook ✅
- [x] 创建 `client/src/hooks/useStoreSync.js` — React Query→Zustand桥接
- [x] 创建 `client/src/hooks/useInvalidateOnMutation.js` — 变更后自动失效缓存
- [x] 创建 `client/src/hooks/index.js` — 统一导出

### SM-04: 迁移App.jsx ✅
- [x] App.jsx使用useStoreSync替代手动API调用
- [x] useAppStore保留UI状态(当前项目/侧边栏/主题等)
- [x] 向后兼容: 现有页面无需修改

### SM-05: 清理验证 ✅
- [x] `npm run check` 通过（19项全通过）
- [x] `npm test` 通过（391测试全通过）
- [x] `vite build` 通过

## 架构变化
```
之前: Component → useAppStore(数据+UI) → API
之后: Component → useXxxQuery(数据) + useAppStore(UI) → API
      (向后兼容: useStoreSync桥接React Query数据到Zustand)
```

## 最终结构
```
client/src/hooks/
├── index.js              (统一导出)
├── useProjects.js        (项目CRUD)
├── useChapters.js        (章节CRUD)
├── useMaterials.js       (素材CRUD+乐观更新)
├── useReviews.js         (审核CRUD)
└── useStoreSync.js       (React Query→Zustand桥接)
```

## G-18改造成果总结

| 文件 | 类型 | 状态 |
|------|------|------|
| useProjects.js | 新增 | ✅ |
| useChapters.js | 新增 | ✅ |
| useMaterials.js | 新增(含乐观更新) | ✅ |
| useReviews.js | 新增 | ✅ |
| useStoreSync.js | 新增(桥接) | ✅ |
| main.jsx | 修改(添加QueryClientProvider) | ✅ |
| App.jsx | 修改(使用useStoreSync) | ✅ |
