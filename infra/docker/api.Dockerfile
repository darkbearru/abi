FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ai-core/package.json packages/ai-core/package.json
COPY packages/storage/package.json packages/storage/package.json
COPY packages/prompts/package.json packages/prompts/package.json
COPY packages/validation/package.json packages/validation/package.json
COPY packages/book-parser/package.json packages/book-parser/package.json

RUN npm ci

FROM deps AS build

COPY . .

RUN npm run build -w @abi/shared \
  && npm run build -w @abi/ai-core \
  && npm run build -w @abi/storage \
  && npm run build -w @abi/prompts \
  && npm run build -w @abi/validation \
  && npm run build -w @abi/book-parser \
  && npm run build -w @abi/api

FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/packages ./packages

CMD ["node", "apps/api/dist/src/main.js"]
