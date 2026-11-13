import { randomBytes } from "crypto";
import type {
  SecurityEventCategory,
  SecurityEventItem,
  SecurityEventSeverity,
  TelemetrySnapshot,
} from "@/types/zero-trace";

interface RuntimeTelemetryStore {
  instanceStartedAt: string;
  totalOperations: number;
  webhookUpdatesProcessed: number;
  webhookDuplicatesIgnored: number;
  securityBlocksCount: number;
  errorsCount: number;
  toolUsageCounts: Record<string, number>;
  events: SecurityEventItem[];
  processedUpdateIds: Map<number, number>;
}

const MAX_EVENTS = 250;
const MAX_UPDATE_IDS = 1500;
const UPDATE_ID_TTL_MS = 1000 * 60 * 30;

const globalRef = globalThis as unknown as {
  __zeroTraceTelemetry?: RuntimeTelemetryStore;
};

function getStore(): RuntimeTelemetryStore {
  if (!globalRef.__zeroTraceTelemetry) {
    globalRef.__zeroTraceTelemetry = {
      instanceStartedAt: new Date().toISOString(),
      totalOperations: 0,
      webhookUpdatesProcessed: 0,
      webhookDuplicatesIgnored: 0,
      securityBlocksCount: 0,
      errorsCount: 0,
      toolUsageCounts: {},
      events: [],
      processedUpdateIds: new Map<number, number>(),
    };
  }
  return globalRef.__zeroTraceTelemetry;
}

export function recordSecurityEvent(params: {
  category: SecurityEventCategory;
  severity: SecurityEventSeverity;
  action: string;
  actor: string;
  status: "success" | "blocked" | "error";
  details: string;
}): SecurityEventItem {
  const store = getStore();
  store.totalOperations += 1;

  if (params.status === "blocked") {
    store.securityBlocksCount += 1;
  }
  if (params.status === "error") {
    store.errorsCount += 1;
  }

  const item: SecurityEventItem = {
    id: `evt_${Date.now()}_${randomBytes(4).toString("hex")}`,
    timestamp: new Date().toISOString(),
    category: params.category,
    severity: params.severity,
    action: params.action.slice(0, 140),
    actor: params.actor.slice(0, 120),
    status: params.status,
    details: params.details.slice(0, 500),
  };

  store.events.unshift(item);
  if (store.events.length > MAX_EVENTS) {
    store.events.length = MAX_EVENTS;
  }

  return item;
}

export function recordToolExecution(toolId: string, actor: string, success: boolean, targetSummary: string): void {
  const store = getStore();
  store.toolUsageCounts[toolId] = (store.toolUsageCounts[toolId] || 0) + 1;
  recordSecurityEvent({
    category: "TOOL",
    severity: success ? "info" : "warning",
    action: `tool:${toolId}`,
    actor,
    status: success ? "success" : "error",
    details: targetSummary,
  });
}

export function claimTelegramUpdateId(updateId: number): boolean {
  const store = getStore();
  const now = Date.now();

  for (const [id, ts] of store.processedUpdateIds.entries()) {
    if (now - ts > UPDATE_ID_TTL_MS || store.processedUpdateIds.size > MAX_UPDATE_IDS) {
      store.processedUpdateIds.delete(id);
    }
  }

  if (store.processedUpdateIds.has(updateId)) {
    store.webhookDuplicatesIgnored += 1;
    return false;
  }

  store.processedUpdateIds.set(updateId, now);
  store.webhookUpdatesProcessed += 1;
  return true;
}

export function getTelemetrySnapshot(): TelemetrySnapshot {
  const store = getStore();
  return {
    instanceStartedAt: store.instanceStartedAt,
    ephemeralNotice:
      "Serverless runtime telemetry reflects real operations recorded in the active instance without any database; permanent historical analytics require an external log/metrics sink.",
    totalOperations: store.totalOperations,
    webhookUpdatesProcessed: store.webhookUpdatesProcessed,
    webhookDuplicatesIgnored: store.webhookDuplicatesIgnored,
    securityBlocksCount: store.securityBlocksCount,
    errorsCount: store.errorsCount,
    toolUsageCounts: { ...store.toolUsageCounts },
    recentEvents: [...store.events],
  };
}

export function clearRuntimeEvents(actor: string): void {
  const store = getStore();
  store.events = [];
  recordSecurityEvent({
    category: "CONFIG",
    severity: "info",
    action: "logs.clear",
    actor,
    status: "success",
    details: "Runtime event buffer cleared by administrator.",
  });
}
