export type Language = "ar" | "en";

export type BotButtonType = "submenu" | "url" | "tool" | "media" | "text";

export type MediaType = "video" | "photo" | "document";

export type ApiCategory =
  | "OSINT"
  | "DNS"
  | "IP_INFO"
  | "WHOIS"
  | "SSL"
  | "DOMAIN"
  | "URL_ANALYSIS"
  | "THREAT_INTEL"
  | "HASHING"
  | "CRYPTOGRAPHY"
  | "SECURITY_HEADERS"
  | "HTTP_ANALYSIS"
  | "EDUCATIONAL"
  | "LINUX_LEARNING"
  | "CTF";

export type CyberToolId =
  | "ip_info"
  | "dns_lookup"
  | "whois_lookup"
  | "ssl_checker"
  | "security_headers"
  | "url_reputation"
  | "hash_generator"
  | "base64_codec"
  | "password_strength"
  | "http_analyzer"
  | "domain_info"
  | "network_education"
  | "learning_center";

export interface BotCommandItem {
  id: string;
  command: string;
  descriptionAr: string;
  descriptionEn: string;
  enabled: boolean;
  linkedTool?: CyberToolId;
  responseTextAr?: string;
  responseTextEn?: string;
}

export interface BotButtonItem {
  id: string;
  labelAr: string;
  labelEn: string;
  type: BotButtonType;
  parentId: string | null;
  categoryId: string | null;
  row: number;
  order: number;
  enabled: boolean;
  url?: string;
  toolId?: CyberToolId;
  mediaId?: string;
  responseTextAr?: string;
  responseTextEn?: string;
}

export interface CategoryItem {
  id: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  icon: string;
  order: number;
  enabled: boolean;
}

export interface MediaItem {
  id: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  type: MediaType;
  categoryId: string | null;
  linkedButtonId: string | null;
  externalUrl: string;
  telegramFileId?: string;
  mimeType: string;
  fileSizeBytes: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiServiceEntry {
  id: string;
  name: string;
  category: ApiCategory;
  endpointPattern: string;
  probeUrl: string;
  docsUrl: string;
  requiresKey: boolean;
  envKeyName?: string;
  freeTierLimit: string;
  termsSummaryAr: string;
  termsSummaryEn: string;
  enabled: boolean;
  verifiedSource: string;
  lastStatus?: "online" | "degraded" | "offline" | "untested";
  lastLatencyMs?: number;
  lastCheckedAt?: string;
}

export interface BotProfileSettings {
  displayNameAr: string;
  displayNameEn: string;
  shortDescriptionAr: string;
  shortDescriptionEn: string;
  descriptionAr: string;
  descriptionEn: string;
  welcomeMessageAr: string;
  welcomeMessageEn: string;
  helpMessageAr: string;
  helpMessageEn: string;
  defaultLanguage: Language;
}

export interface BotFeatureFlags {
  botEnabled: boolean;
  maintenanceMode: boolean;
  inlineMenuEnabled: boolean;
  cyberToolsEnabled: boolean;
  mediaDeliveryEnabled: boolean;
  antiSpamEnabled: boolean;
  maxRequestsPerMinutePerUser: number;
}

export interface SystemGeneralSettings {
  platformTitle: string;
  defaultLocale: Language;
  authorizedScopeNoticeAr: string;
  authorizedScopeNoticeEn: string;
  telegramChannelUrl: string;
  githubPublicUrl: string;
  apiRateLimitPerMinute: number;
  strictSsrfProtection: boolean;
}

export interface ZeroTraceConfig {
  schemaVersion: number;
  revision: number;
  updatedAt: string;
  updatedBy: string;
  botProfile: BotProfileSettings;
  botFeatures: BotFeatureFlags;
  commands: BotCommandItem[];
  categories: CategoryItem[];
  buttons: BotButtonItem[];
  media: MediaItem[];
  apis: ApiServiceEntry[];
  settings: SystemGeneralSettings;
}

export interface StorageSyncState {
  mode: "github" | "ephemeral";
  configured: boolean;
  sha: string | null;
  repository: string | null;
  configPath: string;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export type SecurityEventSeverity = "info" | "warning" | "critical";

export type SecurityEventCategory =
  | "AUTH"
  | "WEBHOOK"
  | "CONFIG"
  | "TOOL"
  | "MEDIA"
  | "SECURITY_BLOCK"
  | "API_PROBE"
  | "BOT_SYNC";

export interface SecurityEventItem {
  id: string;
  timestamp: string;
  category: SecurityEventCategory;
  severity: SecurityEventSeverity;
  action: string;
  actor: string;
  status: "success" | "blocked" | "error";
  details: string;
}

export interface TelemetrySnapshot {
  instanceStartedAt: string;
  ephemeralNotice: string;
  totalOperations: number;
  webhookUpdatesProcessed: number;
  webhookDuplicatesIgnored: number;
  securityBlocksCount: number;
  errorsCount: number;
  toolUsageCounts: Record<string, number>;
  recentEvents: SecurityEventItem[];
}
