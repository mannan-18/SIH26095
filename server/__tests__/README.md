# Server Test Suite (`server/__tests__`)

## Overview
This folder contains all automated Vitest unit and integration test suites for the Securesight server.

## Test File Naming
- All test files must be named `*.test.ts` or `*.spec.ts`.
- Mirror the corresponding server layer/module under test (e.g., `secureEngine.test.ts`, `demoStore.test.ts`, `rbac.providers.test.ts`).

## Running Tests
Run tests via Vitest:
```bash
npx vitest run
```
