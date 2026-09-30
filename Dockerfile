FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
RUN corepack enable
RUN addgroup -S securesight && adduser -S securesight -G securesight
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/dist ./dist
RUN chown -R securesight:securesight /app
USER securesight
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/index.js"]
