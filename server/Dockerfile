# Inspection Hub API — production / live UAT image
FROM node:22-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runner
RUN apk add --no-cache openssl wget
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4100

COPY package*.json ./
COPY prisma ./prisma
# Prod deps + Prisma CLI (db push) + tsx (optional seed profile)
RUN npm ci --omit=dev \
  && npm install prisma@6.19.3 tsx@4.20.5 --no-save --omit=dev \
  && npx prisma generate

COPY --from=builder /app/dist ./dist
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN sed -i 's/\r$//' ./docker-entrypoint.sh \
  && chmod +x ./docker-entrypoint.sh \
  && mkdir -p /data

EXPOSE 4100
VOLUME ["/data"]
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
