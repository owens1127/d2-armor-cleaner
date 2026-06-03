import { beforeAll } from 'vitest';
import { initI18nForTests } from './test';

beforeAll(async () => {
  await initI18nForTests();
});
