// 엣지(proxy.ts) 쪽 Sentry. instrumentation.ts가 엣지 런타임이 뜰 때 한 번 불러온다
import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./lib/sentry-options";

Sentry.init(sentryOptions);
