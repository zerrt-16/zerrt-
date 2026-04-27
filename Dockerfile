FROM node:22-alpine AS deps

WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci

FROM deps AS source

COPY . .

FROM source AS api-build

ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_creator_agent?schema=public"

RUN npm run prisma:generate -w @ai-agent/api
RUN npm run build -w @ai-agent/api

FROM node:22-alpine AS api

WORKDIR /app/apps/api

ENV NODE_ENV=production
ENV PORT=4000

RUN apk add --no-cache openssl

COPY --from=api-build /app/package.json /app/package.json
COPY --from=api-build /app/package-lock.json /app/package-lock.json
COPY --from=api-build /app/node_modules /app/node_modules
COPY --from=api-build /app/apps/api/package.json /app/apps/api/package.json
COPY --from=api-build /app/apps/api/dist /app/apps/api/dist
COPY --from=api-build /app/apps/api/prisma /app/apps/api/prisma
COPY --from=api-build /app/apps/api/src/generation/mock-assets /app/apps/api/src/generation/mock-assets

RUN mkdir -p /app/apps/api/uploads

EXPOSE 4000

CMD ["node", "dist/main.js"]

FROM source AS web-build

ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
ARG API_SERVER_BASE_URL=http://api:4000

ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV API_SERVER_BASE_URL=${API_SERVER_BASE_URL}

RUN npm run build -w @ai-agent/web

FROM node:22-alpine AS web

WORKDIR /app/apps/web

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=web-build /app/package.json /app/package.json
COPY --from=web-build /app/package-lock.json /app/package-lock.json
COPY --from=web-build /app/node_modules /app/node_modules
COPY --from=web-build /app/apps/web /app/apps/web

EXPOSE 3000

CMD ["npm", "run", "start", "-w", "@ai-agent/web"]
