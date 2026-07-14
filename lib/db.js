import { neon } from '@neondatabase/serverless';

let _sql = null;

function getClient() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set.');
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

export function sql(strings, ...values) {
  return getClient()(strings, ...values);
}
