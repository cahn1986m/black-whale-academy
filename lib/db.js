import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. أضف رابط الاتصال بقاعدة بيانات Neon في متغيرات البيئة.');
}

export const sql = neon(process.env.DATABASE_URL);
