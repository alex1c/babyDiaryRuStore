# Дневник малыша

Offline-first дневник для родителей малыша (Expo / React Native).

## Phase 0

Фундамент: навигация, SQLite + migrations, repositories, тема, error boundary, skeleton экранов.

## Scripts

```bash
npm start
npm test
npm run typecheck
npm run lint
```

## Stack

- Expo SDK 57
- React Native 0.86
- React 19
- TypeScript strict
- expo-sqlite (serialized access — no parallel queries on one NativeDatabase)
