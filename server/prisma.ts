import { PrismaClient } from '@prisma/client'

const prismaGlobal = globalThis as unknown as { prisma?: PrismaClient }

function runtimeDatabaseUrl() {
  const raw = process.env.DATABASE_URL
  if (!raw) return undefined
  const url = new URL(raw)
  if (!url.searchParams.has('connect_timeout')) url.searchParams.set('connect_timeout', '8')
  if (!url.searchParams.has('pool_timeout')) url.searchParams.set('pool_timeout', '8')
  return url.toString()
}

const datasourceUrl = runtimeDatabaseUrl()
export const prisma = prismaGlobal.prisma ?? new PrismaClient(datasourceUrl ? { datasourceUrl } : undefined)

if (process.env.NODE_ENV !== 'production') prismaGlobal.prisma = prisma
