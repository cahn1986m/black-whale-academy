import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  return NextResponse.json({ error: 'المسح صار حصراً عبر موظف النادي، تواصل مع الموظف لإتمام تسجيل الحضور' }, { status: 403 });
}
