# Stage 1: Build the Next.js application
FROM node:20-alpine AS builder

WORKDIR /app

# Install build-time dependencies
RUN apk add --no-cache libc6-compat openssl

# Copy dependency files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (including devDependencies for build steps)
RUN npm ci

# Copy application source code
COPY . .

# Generate Prisma client artifacts
RUN npx prisma generate

# Build Next.js application
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production
RUN npm run build

# Stage 2: Production runner
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl direnv

ENV NODE_ENV production
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Create a non-privileged system user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy essential build artifacts and dependencies from builder stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

# Make sure database directory has write permissions for the nextjs user
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

# Executing start script which automatically generates and triggers DB migrations in SQLite
CMD ["npm", "run", "start"]
