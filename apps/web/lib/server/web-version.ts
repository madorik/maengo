import 'server-only';

/** 웹 버전: 배포한 커밋(Vercel이 넣는다). 커밋 정보 없이 올린 배포면 배포 id(dpl_…) 앞부분, 로컬은 '개발' */
export const WEB_VERSION = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || process.env.VERCEL_DEPLOYMENT_ID?.replace(/^dpl_/, '').slice(0, 7) || '개발';
