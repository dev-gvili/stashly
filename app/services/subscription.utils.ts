import type { StoragePlanType } from "@/prisma/enums"

// Map plan type to quota in bytes (example values)
export function toQuota(plan: StoragePlanType): bigint {
  switch (plan) {
    case 'free':
      return BigInt(15 * 1_000_000_000) // 15 GB
    case 'basic':
      return BigInt(100 * 1_000_000_000) // 100 GB in decimal bytes 
    case 'standard':
      return BigInt(200 * 1_000_000_000) // 200 GB in decimal bytes
    case 'premium':
      return BigInt(2 * 1_000_000_000_000) // 2 TB in decimal bytes
    default:
      return BigInt(0)
  }
}
