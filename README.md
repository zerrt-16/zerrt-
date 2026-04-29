# AI Creator Agent Monorepo

Full-stack monorepo starter for an AI creator agent website.

- Frontend: Next.js + TypeScript + Tailwind CSS + shadcn/ui
- Backend: NestJS + TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Monorepo tooling: npm workspaces + Turbo

## Project Structure

```text
.
|- apps
|  |- api
|  \- web
|- packages
|  \- shared
|- docker-compose.yml
|- package.json
|- turbo.json
\- tsconfig.base.json
```

## Local Setup

1. Install dependencies

```powershell
npm.cmd install
```

2. Prepare environment variables

```powershell
Copy-Item .env.example .env
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
```

To enable the real text agent through APIMart, open `apps/api/.env` and set:

```env
AI_TEXT_PROVIDER=apimart
APIMART_API_KEY=your_apimart_api_key
APIMART_BASE_URL=https://api.apimart.ai/v1
APIMART_MODEL=gpt-5.5
```

APIMart is the default text provider. The legacy OpenAI variables are still available only when `AI_TEXT_PROVIDER=openai`, but do not mix APIMart and OpenAI keys for the same provider. If the selected provider request fails, the backend falls back to a safe local planner so generation tasks can still finish successfully.

3. Start the database

```powershell
npm.cmd run db:up
```

4. Run Prisma migration

```powershell
npm.cmd run db:generate
npm.cmd run db:migrate
```

5. Start frontend and backend dev servers

```powershell
npm.cmd run dev
```

## Default URLs

- Web: http://localhost:3000
- API: http://localhost:4000/api
- Health: http://localhost:4000/api/health

## Common Scripts

- `npm.cmd run dev`: start frontend and backend together
- `npm.cmd run dev:web`: start frontend only
- `npm.cmd run dev:api`: start backend only
- `npm.cmd run build`: build all apps
- `npm.cmd run db:up`: start PostgreSQL
- `npm.cmd run db:down`: stop PostgreSQL
- `npm.cmd run db:generate`: generate Prisma Client
- `npm.cmd run db:migrate`: run local migration
- `npm.cmd run db:studio`: open Prisma Studio

## Integration Notes

- Browser requests use same-origin `/api`
- Next.js server-side requests use `API_SERVER_BASE_URL`
- Next.js rewrites proxy `/api/:path*` to `${API_SERVER_BASE_URL}/api/:path*`
- Next.js rewrites proxy `/uploads/:path*` to `${API_SERVER_BASE_URL}/uploads/:path*`
- The API enables CORS for `http://localhost:3000` by default, but browser traffic normally stays on the web origin

## Environment Modes

Local development:

```env
NEXT_PUBLIC_API_BASE_URL=/api
API_SERVER_BASE_URL=http://localhost:4000
CORS_ORIGIN=http://localhost:3000
```

Current ECS public IP testing:

```env
NEXT_PUBLIC_API_BASE_URL=/api
API_SERVER_BASE_URL=http://api:4000
CORS_ORIGIN=http://8.163.38.177:3000
```

Future domain with Nginx reverse proxy:

```env
NEXT_PUBLIC_API_BASE_URL=/api
API_SERVER_BASE_URL=http://api:4000
CORS_ORIGIN=https://your-domain.com
```

Browser requests should stay same-origin, for example `/api/projects`. Next.js rewrites proxy those requests to the NestJS API inside Docker, for example `http://api:4000/api/projects`. After this proxy mode is enabled, the browser should not request `http://8.163.38.177:4000/api/...` directly. In ECS security groups, you can later close public port `4000` and keep only `3000` for IP testing, or `80/443` after adding Nginx.

## Task 2 Local Verification

1. Make sure PostgreSQL is running and the API env points to the correct database.
2. Apply the latest Prisma migration.

```powershell
npm.cmd run prisma:migrate -w @ai-agent/api -- --name project-message-version-loop
```

3. Start the backend and frontend.

```powershell
npm.cmd run dev:api
npm.cmd run dev:web
```

4. Verify the API.

- `GET http://localhost:4000/api/projects`
- `POST http://localhost:4000/api/projects`
- `GET http://localhost:4000/api/projects/{id}`
- `POST http://localhost:4000/api/projects/{id}/messages`
- `GET http://localhost:4000/api/projects/{id}/messages`
- `GET http://localhost:4000/api/projects/{id}/versions`

5. Verify the UI.

- Open `http://localhost:3000`
- Create a new project from the project list page
- Open the new workspace page
- Send a text message and confirm it appears in the conversation area

## Task 3 Local Verification

1. Apply the latest Prisma migration if you have not already.

```powershell
npm.cmd run prisma:migrate -w @ai-agent/api -- --name upload-asset-foundation
```

2. Start the backend and frontend.

```powershell
npm.cmd run dev:api
npm.cmd run dev:web
```

3. Open a project workspace at `http://localhost:3000/projects/{projectId}`.
4. Click `Upload reference image` and choose a png, jpg, jpeg, or webp file under 10MB.
5. Confirm the pending thumbnail preview appears.
6. Send a message with or without text and confirm:

- the message appears in the conversation area
- the uploaded image preview appears inside the message
- refreshing the page still shows the message image

7. Verify the upload endpoint directly if needed:

- `POST http://localhost:4000/api/upload` with multipart fields `projectId` and `file`

## Task 4 Local Verification

1. Apply the latest Prisma migration if you have not already.

```powershell
npm.cmd run prisma:migrate -w @ai-agent/api -- --name generation-task-mock-pipeline
```

2. Start the backend and frontend.

```powershell
npm.cmd run dev:api
npm.cmd run dev:web
```

3. Open a project workspace at `http://localhost:3000/projects/{projectId}`.
4. Upload a reference image if you want to test the `image_to_image` branch.
5. Enter a prompt and click `Generate`.
6. Confirm the task status flows through `pending` or `running` to `success`.
7. Confirm a new image version appears in the versions panel.
8. Refresh the page and confirm:

- the generated version is still listed
- the related prompt message is still visible
- image attachments and generated outputs still render

9. Verify the new APIs directly if needed:

- `POST http://localhost:4000/api/generate`
- `GET http://localhost:4000/api/tasks/{taskId}`
- `GET http://localhost:4000/api/projects/{projectId}/versions`

## Task 5 Local Verification

1. Configure APIMart in `apps/api/.env`.

```env
AI_TEXT_PROVIDER=apimart
APIMART_API_KEY=your_apimart_api_key
APIMART_BASE_URL=https://api.apimart.ai/v1
APIMART_MODEL=gpt-5.5
```

2. Start the backend and frontend.

```powershell
npm.cmd run dev:api
npm.cmd run dev:web
```

3. Open a project workspace at `http://localhost:3000/projects/{projectId}`.
4. Upload a reference image if you want the GPT agent to plan an `image_to_image` task.
5. Click `Generate`.
6. Confirm the task finishes successfully.
7. Verify the task payload and version history:

- `GET http://localhost:4000/api/tasks/{taskId}` should include a populated `structuredPayloadJson`
- `modelName` should include `apimart/gpt-5.5`
- `promptText` should be a rewritten image prompt, not just the raw user input
- `negativePromptText` should be present
- `GET http://localhost:4000/api/projects/{projectId}/versions` should return a version whose `changeSummary` matches the APIMart-generated `editSummary`

8. To verify fallback behavior, remove `APIMART_API_KEY`, restart the API, and run the same flow again. The task should still succeed with fallback prompt planning and `modelName` should show `fallback-agent/mock-image-provider`.

## Task 6 Local Verification

1. Configure APIMart text and image providers in `apps/api/.env`.

```env
AI_TEXT_PROVIDER=apimart
AI_IMAGE_PROVIDER=apimart
APIMART_API_KEY=your_apimart_api_key
APIMART_BASE_URL=https://api.apimart.ai/v1
APIMART_MODEL=gpt-5.5
APIMART_IMAGE_BASE_URL=https://api.apimart.ai/v1
APIMART_IMAGE_MODEL=gpt-image-2
APIMART_IMAGE_MODELS=gpt-image-2,nano-banana-pro
APIMART_IMAGE_SIZE=1:1
```

2. Start the backend and frontend.

```powershell
npm.cmd run dev:api
npm.cmd run dev:web
```

3. Verify text-to-image.

- Open `http://localhost:3000/projects/{projectId}`
- Enter a creative instruction without uploading a reference image
- Click `生成图片`
- Poll `GET http://localhost:4000/api/tasks/{taskId}` until `status` is `success`
- Confirm `modelName` includes `apimart-image/gpt-image-2`
- Confirm `generatedVersion.outputAsset.fileUrl` points to a local `/uploads/projects/{projectId}/outputs/...` file
- Confirm `GET http://localhost:4000/api/projects/{projectId}/versions` returns the new version

4. Verify image-to-image.

- Upload one reference image
- Enter a creative instruction
- Click `生成图片`
- Confirm the task finishes successfully and creates a new output asset/version

5. Provider behavior notes.

- Text-to-image calls `POST https://api.apimart.ai/v1/images/generations` with `model`, `prompt`, `n: 1`, and `size: "1:1"`.
- Image-to-image currently uses the same endpoint and sends one local reference image as a base64 data URL in the `image_urls` array.
- APIMart GPT-Image-2 returns `data[0].task_id` after creation, so the backend polls `GET {APIMART_IMAGE_BASE_URL}/tasks/{taskId}` for up to 90 seconds.
- When the APIMart task reaches `completed`, the backend reads the final URL from `data.result.images[0].url[0]`, downloads it, and saves it under `apps/api/uploads/projects/{projectId}/outputs/`.
- If APIMart rejects the image-to-image `image_urls` field or the task fails, the task will become `failed` and the frontend will show the provider error. Set `AI_IMAGE_PROVIDER=mock` to temporarily return to the previous mock image provider.

## Task 6.2 Model Registry Verification

The backend exposes an image model registry without requiring a Prisma migration.

Registered models:

- `apimart-gpt-image-2`: APIMart GPT-Image-2, supports text-to-image and image-to-image
- `nano-banana-pro`: APIMart Nano Banana Pro, supports text-to-image and image-to-image
- `mock-image-provider`: local mock provider for development testing

1. Start the backend and verify the registry API.

```powershell
npm.cmd run dev:api
Invoke-RestMethod http://localhost:4000/api/image-models
```

2. Open a project workspace and confirm the right-side control panel shows:

- `生图模型`
- `图片比例`
- the selected model description
- supported capabilities, cost level, and speed level

3. Verify text-to-image with explicit model selection.

- Select `GPT-Image-2`
- Choose a supported ratio such as `1:1`
- Enter a prompt without uploading a reference image
- Click `生成图片`
- Confirm `GET http://localhost:4000/api/tasks/{taskId}` returns `status = success`
- Confirm `modelName` includes `apimart-image/gpt-image-2`

4. Verify image-to-image with explicit model selection.

- Upload one reference image
- Select `GPT-Image-2`
- Enter an edit prompt
- Click `生成图片`
- Confirm a new version appears and persists after refresh

5. Verify mock provider selection.

- Select `Mock Image Provider`
- Click `生成图片`
- Confirm the task succeeds without calling the real APIMart image model
- Confirm `modelName` includes `mock-image-provider`

6. Verify Nano Banana Pro selection.

- Select `Nano Banana Pro`
- Enter a prompt, or upload one reference image for image-to-image
- Click `生成图片`
- Confirm `GET http://localhost:4000/api/tasks/{taskId}` returns `status = success`
- Confirm `modelName` includes `apimart-image/nano-banana-pro`

7. API request shape for model selection:

```json
{
  "projectId": "project_id",
  "messageText": "生成一张电商产品主图",
  "sourceAssetId": null,
  "baseVersionId": null,
  "modelId": "nano-banana-pro",
  "size": "1:1",
  "quality": "standard"
}
```

If `modelId` is omitted, the backend keeps the previous compatibility behavior and chooses the default image model from `AI_IMAGE_PROVIDER` and `APIMART_IMAGE_MODEL`. The backend still accepts the previous `imageModelId` field for compatibility.

## Ubuntu ECS Production Deployment

This project is a full-stack monorepo:

- `apps/web`: Next.js + React + TypeScript + Tailwind CSS
- `apps/api`: NestJS + TypeScript + Prisma
- `packages/shared`: shared TypeScript package placeholder
- Database: PostgreSQL
- Storage: local upload/output files under `apps/api/uploads`
- AI providers: APIMart text and image APIs, configured only through environment variables

### Production Notes

- Do not run `npm run dev` in production.
- The API container starts with `node dist/main.js`.
- The web container starts with `next start`.
- Prisma migrations run through the one-shot `api-migrate` service before the API starts.
- Uploaded reference images and generated outputs are stored in the Docker volume `api_uploads`.
- PostgreSQL data is stored in the Docker volume `postgres_data`.

### Issues Found During Deployment Review

- The original `docker-compose.yml` only started PostgreSQL and did not run the web/API apps.
- There was no production Dockerfile for the monorepo.
- The upload directory was local to the API working directory and needed a persistent Docker volume.
- Production environment variables for public API URL, CORS, APIMart keys, and provider selection needed one root template.
- Prisma migration deployment needed an explicit production path instead of `prisma migrate dev`.

### Files Added Or Updated

- `Dockerfile`: multi-target Dockerfile for `api` and `web`
- `.dockerignore`: excludes local build artifacts, logs, env files, and uploads from image builds
- `docker-compose.yml`: production-style stack with `postgres`, `api-migrate`, `api`, and `web`
- `.env.example`: ECS-oriented environment template

### 1. Prepare The Server

On Ubuntu 22.04 ECS, install Docker Compose plugin if it is not already available:

```bash
docker --version
docker compose version
```

Open ECS security group ports for initial IP testing:

- `3000`: web
- `4000`: API
- `22`: SSH

Do not open PostgreSQL `5432` publicly unless you have a specific operations reason. Prefer keeping database access internal to Docker or restricted to your own IP.

### 2. Upload Code And Configure Environment

On the server:

```bash
cp .env.example .env
nano .env
```

For public IP testing, keep browser API requests same-origin and replace the web origin with your ECS public IP:

```env
NEXT_PUBLIC_API_BASE_URL=/api
API_SERVER_BASE_URL=http://api:4000
CORS_ORIGIN=http://YOUR_ECS_PUBLIC_IP:3000
```

Set strong database credentials:

```env
POSTGRES_DB=ai_creator_agent
POSTGRES_USER=ai_creator_agent
POSTGRES_PASSWORD=replace_with_a_strong_password
```

Set APIMart credentials without committing them:

```env
AI_TEXT_PROVIDER=apimart
AI_IMAGE_PROVIDER=apimart
APIMART_API_KEY=your_real_apimart_key
APIMART_MODEL=gpt-5.5
APIMART_IMAGE_MODEL=gpt-image-2
APIMART_IMAGE_MODELS=gpt-image-2,nano-banana-pro
```

### 3. Build And Start

```bash
docker compose build
docker compose up -d
```

The `api-migrate` service runs `prisma migrate deploy` automatically. Check containers:

```bash
docker compose ps
docker compose logs -f api
docker compose logs -f web
```

Open:

- Web: `http://YOUR_ECS_PUBLIC_IP:3000`
- API health through Next proxy: `http://YOUR_ECS_PUBLIC_IP:3000/api/health`
- Image model registry through Next proxy: `http://YOUR_ECS_PUBLIC_IP:3000/api/image-models`
- Optional backend direct check on the ECS host: `curl http://localhost:4000/api/health`

### 4. Update And Redeploy

After pulling new code:

```bash
docker compose build
docker compose up -d
```

If only environment variables changed:

```bash
docker compose up -d --force-recreate api web
```

If `API_SERVER_BASE_URL` changed, rebuild the web image because Next.js rewrites are read from the web build/runtime config:

```bash
docker compose build web
docker compose up -d web
```

### 5. Database Deployment And Backup

PostgreSQL runs as the `postgres` service and stores data in the `postgres_data` Docker volume.

Create a backup directory:

```bash
mkdir -p backups
```

Backup:

```bash
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > backups/ai_creator_agent_$(date +%Y%m%d_%H%M%S).sql
```

Restore to an empty database:

```bash
cat backups/your_backup.sql | docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Backup uploaded/generated files:

```bash
docker run --rm -v ai-creator-agent-monorepo-next-js-typescript_api_uploads:/data -v "$PWD/backups":/backup alpine tar czf /backup/api_uploads_$(date +%Y%m%d_%H%M%S).tar.gz -C /data .
```

Volume names can differ if your Compose project name differs. Check them with:

```bash
docker volume ls
```

### 6. Production Validation Checklist

- `docker compose ps` shows `postgres`, `api`, and `web` as running or healthy
- `api-migrate` exits successfully
- `GET /api/health` reports PostgreSQL connected
- `GET /api/image-models` returns `apimart-gpt-image-2` and `mock-image-provider`
- Create a project from the web UI
- Upload a reference image
- Generate an image with `GPT-Image-2`
- Confirm generated files remain after `docker compose restart api`

### 7. Future Domain And HTTPS

For a domain and HTTPS, put Nginx or another reverse proxy in front of the containers:

- Proxy `/` to `web:3000`
- Proxy `/api` and `/uploads` to `api:4000`
- Set `NEXT_PUBLIC_API_BASE_URL=/api`
- Set `API_SERVER_BASE_URL=http://api:4000`
- Set `CORS_ORIGIN=https://your-domain.com`
- Rebuild the web image after changing rewrite-related environment variables
