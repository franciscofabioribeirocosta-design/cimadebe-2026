# ==============================================================================
# CIMADEBE / SIGM - CORE BANKING & PRINTING BUREAU
# Production Dockerfile (Cloud-Ready Automation Template)
# ==============================================================================

# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./

RUN npm ci

COPY . .

# Build application (Vite production bundle + TypeScript compilation of server)
RUN npm run build

# Stage 2: Production runtime image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/firebase-applet-config.json ./

RUN npm ci --only=production

USER nodejs

EXPOSE 3000

CMD ["node", "dist/server.js"]
