import 'server-only';
import { createHash } from 'node:crypto';
import { packAmount } from '@maengo/core/plans';
import { kstDate } from '@maengo/core/kst';
import { headers } from 'next/headers';
import { after } from 'next/server';
import { appInfoOf, deviceOf } from '../app-client';
import {
  categoryLabel, INQUIRY_DAILY_GUESTS, INQUIRY_DAILY_PER_USER, INQUIRY_HOURLY_PER_IP, INQUIRY_REPLY_MAX, inquirySubject, parseInquiry, replySubject, replyText, stripReplyFrame,
  type InquiryStatus,
} from '../inquiry';
import { appUrl, SUPPORT_EMAIL } from '../site';
import { db, must } from './db';
import { draftInquiryReply } from './inquiry-draft';
import { mailConfigured, sendMail } from './mailer';
import type { Profile } from './profile';
import { WEB_VERSION } from './web-version';

// 문의하기 양식(/contact): 검사 → 보내는 횟수 제한 → DB(inquiries)에 남김 → 운영자 메일(Resend)로 보냄.
// 메일이 실패해도 문의는 DB에 남고, 관리자 화면 알림 종에 '메일로 보내지 못한 문의'로 보인다(admin-alerts.ts). 맹고-문서/문의하기.md

/** 로그인하지 않고 보낸 문의를 남기는 기간(전자상거래법 시행령 6조, 소비자 불만·분쟁 처리 기록 3년) */
const GUEST_KEEP_DAYS = 3 * 365;

export type InquiryResult = { ok: true; replyTo: string } | { ok: false; error: string };

const day = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 9 * 3_600_000);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
};
const STORE: Record<string, string> = { app_store: 'App Store', play_store: 'Google Play', test_store: '시험 결제' };

/** 문제를 찾는 데 쓸 정보(메일 아래쪽과 inquiries.meta). 회원 이메일·이름은 넣지 않는다(답장 주소는 따로) */
async function metaOf(profile: Profile | null, ua: string | null): Promise<Record<string, string>> {
  const app = appInfoOf(ua);
  const meta: Record<string, string> = {
    앱: app ? `${app.version} (${app.platform})` : '웹 브라우저',
    웹: WEB_VERSION,
    기기: deviceOf(ua),
  };
  if (!profile) return { 회원: '로그인 안 함', ...meta };
  const [buys, wallet] = await Promise.all([
    db.from('purchases').select('product_id,kind,store,purchased_at,refunded_at').eq('user_id', profile.id).order('purchased_at', { ascending: false }).limit(3),
    db.from('wallets').select('balance').eq('user_id', profile.id).maybeSingle(),
  ]);
  const rows = (buys.data ?? []) as { product_id: string; kind: string; store: string; purchased_at: string | null; refunded_at: string | null }[];
  const until = profile.premiumUntil ? `, ${day(new Date(profile.premiumUntil).toISOString())}까지` : '';
  return {
    회원: `${profile.id.slice(0, 8)} (${profile.limits.name}${profile.plan === 'free' ? '' : until})`,
    ...meta,
    최근결제: rows.length
      ? rows
          .map((r) => `${r.purchased_at ? day(r.purchased_at) : '?'} ${r.kind === 'subscription' ? 'Premium 1개월' : `맹고 ${packAmount(r.product_id) ?? '?'}개`}(${STORE[r.store] ?? r.store}${r.refunded_at ? ', 환불됨' : ''})`)
          .join(' / ')
      : '없음',
    지갑맹고: `${(wallet.data as { balance: number } | null)?.balance ?? 0}개`,
  };
}

/**
 * Resend 중복 보내기 막는 키. 번호만 쓰면 로컬·운영(같은 Resend 계정)이나 DB를 다시 만든 뒤에 같은 번호가 24시간 안에 다시 나와
 * 다른 메일로 409가 난다(2026-10-26 로컬에서 겪음). 만든 시각을 붙여 겹치지 않게 한다
 */
const mailKey = (kind: string, row: { id: number; created_at: string }) => `${kind}-${row.id}-${Date.parse(row.created_at)}`;

async function count(q: PromiseLike<{ count: number | null; error: { message: string } | null }>, what: string): Promise<number> {
  const { count: n, error } = await q;
  if (error) throw new Error(`${what}: ${error.message}`);
  return n ?? 0;
}

/** 문의 하나를 받는다. trap은 사람 눈에 안 보이는 칸(채워져 있으면 스팸 봇이라 저장·메일 없이 보낸 척만 한다) */
export async function submitInquiry(profile: Profile | null, raw: { category: unknown; body: unknown; replyTo: unknown; trap: unknown }): Promise<InquiryResult> {
  const parsed = parseInquiry(raw);
  if (!parsed.ok) return parsed;
  const { category, body, replyTo } = parsed.value;
  if (typeof raw.trap === 'string' && raw.trap.trim()) return { ok: true, replyTo };

  const h = await headers();
  const ua = h.get('user-agent');
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
  const ipHash = profile ? null : createHash('sha256').update(`${process.env.SESSION_SECRET ?? 'maengo'}:${ip}`).digest('hex').slice(0, 32);

  // 보내는 횟수 제한: 회원은 하루, 로그인하지 않은 사람은 같은 곳에서 한 시간·전체 하루
  const inquiries = () => db.from('inquiries').select('id', { count: 'exact', head: true });
  const todayStart = `${kstDate()}T00:00:00+09:00`;
  if (profile) {
    if ((await count(inquiries().eq('user_id', profile.id).gte('created_at', todayStart), 'inquiries user')) >= INQUIRY_DAILY_PER_USER) {
      return { ok: false, error: '오늘은 더 보낼 수 없어요. 내일 다시 보내 주세요.' };
    }
  } else {
    const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const [mine, all] = await Promise.all([
      count(inquiries().is('user_id', null).eq('ip_hash', ipHash).gte('created_at', hourAgo), 'inquiries ip'),
      count(inquiries().is('user_id', null).gte('created_at', todayStart), 'inquiries guests'),
    ]);
    if (mine >= INQUIRY_HOURLY_PER_IP || all >= INQUIRY_DAILY_GUESTS) return { ok: false, error: '잠시 뒤 다시 보내 주세요.' };
  }

  const meta = await metaOf(profile, ua);
  const row = must(
    await db.from('inquiries').insert({ user_id: profile?.id ?? null, category, body, reply_to: replyTo, meta, ip_hash: ipHash }).select('id,created_at').single(),
    'inquiries insert',
  ) as { id: number; created_at: string };

  // 운영자 메일. 답장하면 회원이 적은 주소로 간다
  let status: 'sent' | 'failed' | 'skipped' = 'skipped';
  let mailError: string | null = null;
  if (mailConfigured() && SUPPORT_EMAIL) {
    const lines = [`종류: ${categoryLabel(category)}`, `답장 받을 메일: ${replyTo}`, ...Object.entries(meta).map(([k, v]) => `${k}: ${v}`), `문의 번호: ${row.id}`];
    try {
      await sendMail({ to: SUPPORT_EMAIL, replyTo, subject: inquirySubject(category, body), text: `${body}\n\n---\n${lines.join('\n')}`, idempotencyKey: mailKey('inquiry', row) });
      status = 'sent';
    } catch (e) {
      status = 'failed';
      mailError = String((e as Error).message ?? e).slice(0, 300);
      console.error('[inquiry] 메일 보내기 실패', row.id, mailError);
    }
  }
  must(await db.from('inquiries').update({ mail_status: status, mail_error: mailError }).eq('id', row.id), 'inquiries mail_status');

  // 응답을 보낸 뒤: AI 답장 초안(관리자 > 문의 탭 답장 칸에 미리 채워진다), 오래된 비회원 문의 정리(따로 배치를 두지 않고 문의가 들어올 때 함께)
  after(async () => {
    await draftInquiryReply(row.id);
    const before = new Date(Date.now() - GUEST_KEEP_DAYS * 86_400_000).toISOString();
    const { error } = await db.from('inquiries').delete().is('user_id', null).lt('created_at', before);
    if (error) console.error('[inquiry] 오래된 문의 정리 실패', error.message);
  });
  return { ok: true, replyTo };
}

/** 관리자 경고: 최근 7일 안에 메일로 보내지 못한 문의 수(DB에는 남아 있다) */
export async function unsentInquiries(now = new Date()): Promise<number> {
  const since = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  return count(db.from('inquiries').select('id', { count: 'exact', head: true }).in('mail_status', ['failed', 'skipped']).gte('created_at', since), 'inquiries unsent');
}

// ---- 관리자 > 운영 탭: 문의 보기·답장·닫기 ----

export interface InquiryReply {
  id: number;
  body: string;
  mailStatus: 'sent' | 'failed';
  mailError: string | null;
  createdAt: string;
}

export interface InquiryView {
  id: number;
  member: string | null;
  category: string;
  body: string;
  replyTo: string;
  meta: Record<string, string>;
  mailStatus: 'pending' | 'sent' | 'failed' | 'skipped';
  status: InquiryStatus;
  repliedAt: string | null;
  /** AI 답장 초안(가운데 본문만)과 운영자만 보는 확인할 점, 만든 시각 */
  aiDraft: string | null;
  aiCheck: string | null;
  aiDraftAt: string | null;
  /** 초안 전에 확인한 회원 기록(lib/server/inquiry-facts.ts) */
  aiFacts: { text: string; extra?: string }[];
  /** 10분 안에 답장함(관리자 화면에서 펼쳐 둔다) */
  justReplied: boolean;
  createdAt: string;
  replies: InquiryReply[];
}

type InquiryRow = {
  id: number;
  user_id: string | null;
  category: string;
  body: string;
  reply_to: string;
  meta: Record<string, string>;
  mail_status: InquiryView['mailStatus'];
  status: InquiryStatus;
  replied_at: string | null;
  ai_draft: string | null;
  ai_check: string | null;
  ai_draft_at: string | null;
  ai_facts: { text: string; extra?: string }[] | null;
  created_at: string;
};
const INQUIRY_COLS = 'id,user_id,category,body,reply_to,meta,mail_status,status,replied_at,ai_draft,ai_check,ai_draft_at,ai_facts,created_at';

/**
 * 답장 기다리는 문의는 기간과 상관없이 모두(오래된 것부터), 그 밖엔 기간(한국 날짜 from~to) 안에 받은 것(최근 것부터) limit개.
 * 회원은 번호 앞 8자리로만(이메일·이름은 답장 주소 말고는 보이지 않는다)
 */
export async function inquiryList(range: { from: string; to: string }, limit = 50): Promise<InquiryView[]> {
  const [open, recent] = await Promise.all([
    db.from('inquiries').select(INQUIRY_COLS).eq('status', 'open').order('created_at'),
    db
      .from('inquiries')
      .select(INQUIRY_COLS)
      .neq('status', 'open')
      .gte('created_at', `${range.from}T00:00:00+09:00`)
      .lte('created_at', `${range.to}T23:59:59.999+09:00`)
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);
  const rows = [...(must(open, 'inquiries open') as InquiryRow[]), ...(must(recent, 'inquiries recent') as InquiryRow[])];
  const replies = rows.length
    ? (must(
        await db.from('inquiry_replies').select('id,inquiry_id,body,mail_status,mail_error,created_at').in('inquiry_id', rows.map((r) => r.id)).order('id'),
        'inquiry_replies',
      ) as { id: number; inquiry_id: number; body: string; mail_status: 'sent' | 'failed'; mail_error: string | null; created_at: string }[])
    : [];
  return rows.map((r) => ({
    id: r.id,
    member: r.user_id ? r.user_id.slice(0, 8) : null,
    category: r.category,
    body: r.body,
    replyTo: r.reply_to,
    meta: r.meta ?? {},
    mailStatus: r.mail_status,
    status: r.status,
    repliedAt: r.replied_at,
    aiDraft: r.ai_draft,
    aiCheck: r.ai_check,
    aiDraftAt: r.ai_draft_at,
    aiFacts: Array.isArray(r.ai_facts) ? r.ai_facts : [],
    justReplied: r.replied_at !== null && Date.now() - Date.parse(r.replied_at) < 10 * 60_000,
    createdAt: r.created_at,
    replies: replies
      .filter((x) => x.inquiry_id === r.id)
      .map((x) => ({ id: x.id, body: x.body, mailStatus: x.mail_status, mailError: x.mail_error, createdAt: x.created_at })),
  }));
}

export type ReplyResult = { ok: true } | { ok: false; error: string };

/**
 * 운영자 답장: 문의에 적힌 답장 주소로 보낸다(보내는 사람 noreply, 회원이 다시 답장하면 운영자 메일로). 보내면 '답장 완료'.
 * 메일이 실패해도 답장 기록은 남기고(failed) 상태는 그대로 둔다(다시 보낼 수 있게)
 */
export async function replyInquiry(id: number, raw: string): Promise<ReplyResult> {
  const body = raw.trim();
  if (!stripReplyFrame(body)) return { ok: false, error: '답장 내용을 적어 주세요.' };
  if (body.length > INQUIRY_REPLY_MAX) return { ok: false, error: `답장은 ${INQUIRY_REPLY_MAX.toLocaleString('ko-KR')}자까지예요.` };
  if (!mailConfigured()) return { ok: false, error: 'RESEND_API_KEY가 없어 보낼 수 없어요.' };
  const q = must(await db.from('inquiries').select('id,category,body,reply_to,created_at').eq('id', id).maybeSingle(), 'inquiry') as
    | { id: number; category: string; body: string; reply_to: string; created_at: string }
    | null;
  if (!q) return { ok: false, error: '없는 문의예요.' };
  const row = must(await db.from('inquiry_replies').insert({ inquiry_id: id, body, mail_status: 'failed' }).select('id,created_at').single(), 'inquiry_replies insert') as {
    id: number;
    created_at: string;
  };
  try {
    await sendMail({
      to: q.reply_to,
      replyTo: SUPPORT_EMAIL ?? undefined,
      subject: replySubject(q.body),
      text: replyText(body, { body: q.body, category: q.category, createdAt: q.created_at }, appUrl('/')),
      idempotencyKey: mailKey('inquiry-reply', row),
    });
  } catch (e) {
    const error = String((e as Error).message ?? e).slice(0, 300);
    must(await db.from('inquiry_replies').update({ mail_error: error }).eq('id', row.id), 'inquiry_replies failed');
    console.error('[inquiry] 답장 보내기 실패', id, error);
    return { ok: false, error: `메일을 보내지 못했어요. ${error}` };
  }
  const now = new Date().toISOString();
  must(await db.from('inquiry_replies').update({ mail_status: 'sent' }).eq('id', row.id), 'inquiry_replies sent');
  must(await db.from('inquiries').update({ status: 'replied', replied_at: now }).eq('id', id), 'inquiries replied');
  return { ok: true };
}

/** 답장 없이 닫기(스팸·중복·Gmail로 직접 답함) 또는 다시 열기 */
export async function setInquiryStatus(id: number, status: 'open' | 'closed'): Promise<void> {
  must(await db.from('inquiries').update({ status }).eq('id', id), 'inquiries status');
}

/** 관리자 경고: 답장 기다리는 문의 수 */
export async function openInquiries(): Promise<number> {
  return count(db.from('inquiries').select('id', { count: 'exact', head: true }).eq('status', 'open'), 'inquiries open count');
}
