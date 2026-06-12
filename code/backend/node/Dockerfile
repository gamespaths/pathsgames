# Multi-stage build
FROM node:20-alpine AS builder

WORKDIR /app

# Install openssl for Prisma
RUN apk add --no-cache openssl

# Install all dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma

# Build TypeScript + generate Prisma client
RUN npm run build
RUN npm run prisma:generate

# Production image
FROM node:20-alpine

WORKDIR /app

# Install openssl for Prisma
RUN apk add --no-cache openssl

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built app + prisma schema + generated client from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY prisma ./prisma
# Expose ports
EXPOSE 8042 8044

# Run migrations then start
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && (node prisma/seed.js || echo 'seed skipped') && node dist/main.js"]
