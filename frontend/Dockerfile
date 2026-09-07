# --- STAGE 1: Build ---
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# --- STAGE 2: Production ---
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
