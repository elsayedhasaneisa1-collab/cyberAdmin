import { isIP } from "net";
import type { MediaType } from "@/types/zero-trace";
import { isPrivateOrReservedIp } from "./ssrf";

export const TELEGRAM_LIMITS = {
  URL_PHOTO_MAX_BYTES: 5 * 1024 * 1024,
  URL_OTHER_MAX_BYTES: 20 * 1024 * 1024,
  UPLOAD_PHOTO_MAX_BYTES: 10 * 1024 * 1024,
  UPLOAD_OTHER_MAX_BYTES: 50 * 1024 * 1024,
  CAPTION_MAX_CHARS: 1024,
  MESSAGE_MAX_CHARS: 4096,
  BOT_NAME_MAX_CHARS: 64,
  BOT_SHORT_DESC_MAX_CHARS: 120,
  BOT_DESC_MAX_CHARS: 512,
};

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function sanitizePlainText(input: unknown, maxLen = 500): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLen);
}

export function sanitizeRichTelegramHtml(input: unknown, maxLen = 4000): string {
  if (typeof input !== "string") return "";
  const cleaned = input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/javascript:/gi, "")
    .trim();
  return cleaned.slice(0, maxLen);
}

export function validateDomainName(raw: string): { valid: boolean; domain?: string; error?: string } {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    ?.split(":")[0]
    ?.replace(/\.$/, "");

  if (!cleaned || cleaned.length > 253) {
    return { valid: false, error: "Invalid domain length." };
  }
  if (
    cleaned === "localhost" ||
    cleaned.endsWith(".local") ||
    cleaned.endsWith(".internal") ||
    cleaned.endsWith(".localhost")
  ) {
    return { valid: false, error: "Local or internal domain names are not permitted." };
  }
  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
  if (!domainRegex.test(cleaned)) {
    return { valid: false, error: "Invalid domain syntax." };
  }
  return { valid: true, domain: cleaned };
}

export function validatePublicIpInput(raw: string): { valid: boolean; ip?: string; error?: string } {
  const ip = raw.trim().replace(/^\[|\]$/g, "");
  const ver = isIP(ip);
  if (ver === 0) {
    return { valid: false, error: "Invalid IPv4 or IPv6 syntax." };
  }
  if (isPrivateOrReservedIp(ip)) {
    return { valid: false, error: "Private, loopback, or reserved IP addresses cannot be queried." };
  }
  return { valid: true, ip };
}

export function validateBotCommandName(raw: string): { valid: boolean; command?: string; error?: string } {
  const cleaned = raw.trim().toLowerCase().replace(/^\//, "");
  if (!/^[a-z0-9_]{1,32}$/.test(cleaned)) {
    return {
      valid: false,
      error: "Command must contain 1-32 lowercase letters, digits, or underscores.",
    };
  }
  return { valid: true, command: cleaned };
}

export function validateMediaConstraints(params: {
  type: MediaType;
  fileSizeBytes: number;
  mimeType: string;
  deliveryMethod: "url" | "upload" | "file_id";
}): { valid: boolean; error?: string; maxAllowedBytes: number } {
  const { type, fileSizeBytes, mimeType, deliveryMethod } = params;

  const allowedMimePrefixes: Record<MediaType, string[]> = {
    video: ["video/mp4", "video/webm", "video/quicktime"],
    photo: ["image/jpeg", "image/png", "image/webp"],
    document: [
      "application/pdf",
      "text/plain",
      "text/markdown",
      "application/zip",
      "image/png",
      "image/jpeg",
      "video/mp4",
    ],
  };

  const normalizedMime = mimeType.trim().toLowerCase();
  if (normalizedMime && !allowedMimePrefixes[type].some((m) => normalizedMime.startsWith(m))) {
    return {
      valid: false,
      maxAllowedBytes: 0,
      error: `Unsupported MIME type (${normalizedMime}) for media category ${type}.`,
    };
  }

  if (deliveryMethod === "file_id") {
    return { valid: true, maxAllowedBytes: Number.MAX_SAFE_INTEGER };
  }

  const maxAllowedBytes =
    deliveryMethod === "url"
      ? type === "photo"
        ? TELEGRAM_LIMITS.URL_PHOTO_MAX_BYTES
        : TELEGRAM_LIMITS.URL_OTHER_MAX_BYTES
      : type === "photo"
      ? TELEGRAM_LIMITS.UPLOAD_PHOTO_MAX_BYTES
      : TELEGRAM_LIMITS.UPLOAD_OTHER_MAX_BYTES;

  if (fileSizeBytes < 0) {
    return { valid: false, maxAllowedBytes, error: "Invalid negative file size." };
  }

  if (fileSizeBytes > maxAllowedBytes) {
    const maxMb = Math.round(maxAllowedBytes / (1024 * 1024));
    return {
      valid: false,
      maxAllowedBytes,
      error: `File size exceeds official Telegram Bot API ${deliveryMethod === "url" ? "HTTP URL" : "multipart upload"} limit of ${maxMb} MB for ${type}.`,
    };
  }

  return { valid: true, maxAllowedBytes };
}
