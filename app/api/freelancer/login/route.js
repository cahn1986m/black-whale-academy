import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { signFreelancerSession } from '@/lib/freelancer-session';

export const dynamic = 'force-dynamic';

const SESSION_COOKIE = 'bwa_freelancer_session';
const GENERIC_ERROR = 'رقم الجوال أو الرمز غير صحيح';
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000;
const REMEMBER_ME_SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_SESSION_MS = 60 * 60 * 1000;
// bcrypt.hashSync('0000', 10) — precomputed so it costs nothing at
// request time. Used only to burn the same bcrypt.compare duration
// when the phone number doesn't exist, so a nonexistent-phone request
// and a wrong-PIN request take the same amount of time.
const DUMMY_HASH = '$2b$10$LnFbgeDlFgJK/g7Iz1RizOp.oxupyh.yrsLO39FzWTdkDyZKwEYmC';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const phone = typeof body.phone === 'string' ? body.phone : '';
    const pin = typeof body.pin === 'string' ? body.pin : '';
    const rememberMe = body.rememberMe === true;

    if (!phone || !pin) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    const [freelancer] = await sql`SELECT * FROM freelancers WHERE phone = ${phone}`;

    if (!freelancer) {
      await bcrypt.compare(pin, DUMMY_HASH);
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    if (!freelancer.is_active) {
      return NextResponse.json({ error: 'هذا الحساب معطّل، تواصل مع الإدارة' }, { status: 403 });
    }

    if (freelancer.locked_until && new Date(freelancer.locked_until).getTime() > Date.now()) {
      return NextResponse.json({ error: 'الحساب مقفول مؤقتاً، حاول لاحقاً' }, { status: 423 });
    }

    const pinMatches = await bcrypt.compare(pin, freelancer.pin_hash);

    if (!pinMatches) {
      const newAttempts = freelancer.failed_login_attempts + 1;
      if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + LOCK_DURATION_MS).toISOString();
        await sql`
          UPDATE freelancers
          SET failed_login_attempts = ${newAttempts}, locked_until = ${lockedUntil}
          WHERE id = ${freelancer.id}
        `;
      } else {
        await sql`
          UPDATE freelancers
          SET failed_login_attempts = ${newAttempts}
          WHERE id = ${freelancer.id}
        `;
      }
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    await sql`
      UPDATE freelancers
      SET failed_login_attempts = 0, locked_until = NULL
      WHERE id = ${freelancer.id}
    `;

    const expiresInMs = rememberMe ? REMEMBER_ME_SESSION_MS : DEFAULT_SESSION_MS;
    const token = await signFreelancerSession(freelancer.id, expiresInMs);

    const response = NextResponse.json({
      success: true,
      freelancer: { id: freelancer.id, name: freelancer.name },
    });

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    };
    // No explicit maxAge when rememberMe is false — a session cookie
    // the browser discards on close, rather than one that merely holds
    // a short-lived token while staying present in storage.
    if (rememberMe) {
      cookieOptions.maxAge = REMEMBER_ME_SESSION_MS / 1000;
    }
    response.cookies.set(SESSION_COOKIE, token, cookieOptions);

    return response;
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
