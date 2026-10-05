FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/shared ./packages/shared
COPY apps/web/package*.json ./apps/web/

RUN npm install

COPY apps/web ./apps/web

WORKDIR /app/apps/web

ENV NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=builder /app/apps/web/package*.json ./apps/web/
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public

WORKDIR /app/apps/web

EXPOSE 3000

CMD ["npm", "run", "start", "--", "-p", "3000"]
