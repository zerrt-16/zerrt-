# Deployment Checklist

Use this checklist after deploying to Ubuntu ECS or after rebuilding the web/API images.

## 1. Environment

For current public IP testing:

```env
NEXT_PUBLIC_API_BASE_URL=http://8.163.38.177:4000
CORS_ORIGIN=http://8.163.38.177:3000
```

If the web image was already built before changing `NEXT_PUBLIC_API_BASE_URL`, rebuild the web image because Next.js bundles public env values at build time.

```bash
docker compose build --no-cache web
docker compose up -d web
```

## 2. Container Status

```bash
docker compose ps
docker compose logs --tail=100 api
docker compose logs --tail=100 web
docker compose logs --tail=100 api-migrate
```

Expected:

- `postgres` is running or healthy.
- `api-migrate` exited successfully.
- `api` is running or healthy.
- `web` is running or healthy.

## 3. Backend Health Check

From the ECS host:

```bash
curl http://localhost:4000/api/health
```

Expected: the response should show PostgreSQL connected.

## 4. Project APIs

Project list:

```bash
curl http://localhost:4000/api/projects
```

Create project:

```bash
curl -X POST http://localhost:4000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"title":"测试项目","description":"测试说明"}'
```

Expected:

- Response contains `id`, `title`, `description`, `createdAt`, `updatedAt`.
- The request body uses `title`, not `name`.

## 5. Browser Validation

1. Open `http://8.163.38.177:3000`.
2. Open DevTools Network tab.
3. Create a project from the homepage.
4. Confirm the request URL is:

```text
http://8.163.38.177:4000/api/projects
```

5. Confirm these incorrect URLs do not appear:

```text
http://8.163.38.177:3000/http://8.163.38.177:4000/api/projects
http://8.163.38.177:4000/projects
http://8.163.38.177:4000/api/api/projects
```

6. If the request fails, check browser Console. The frontend logs failed API requests as:

```text
[api-request-error]
```

The log includes:

- `url`
- `method`
- `status`
- `responseBody`
- fetch error cause when available

## 6. Image Workflow Smoke Test

1. Open a project workspace.
2. Confirm `GET /api/image-models` returns `apimart-gpt-image-2` and `mock-image-provider`.
3. Upload one png/jpg/jpeg/webp image under 10MB.
4. Enter a prompt.
5. Select `GPT-Image-2`.
6. Click `生成图片`.
7. Confirm `GET /api/tasks/{taskId}` eventually returns `status = success`.
8. Confirm the new version image URL starts with `/uploads/projects/.../outputs/...`.
9. Refresh the page and confirm the version remains visible.

## 7. Persistence Checks

Restart API only:

```bash
docker compose restart api
```

Expected:

- Existing projects remain in PostgreSQL.
- Uploaded/generated images remain visible because `api_uploads` is a Docker volume.

## 8. Rebuild Commands

Full rebuild:

```bash
docker compose up -d --build
```

Only rebuild frontend:

```bash
docker compose build --no-cache web
docker compose up -d web
```

Only rebuild backend:

```bash
docker compose build api
docker compose up -d api
```

## 9. Future Nginx / Domain Mode

When using a domain and reverse proxy:

```env
NEXT_PUBLIC_API_BASE_URL=/api
CORS_ORIGIN=https://your-domain.com
```

The reverse proxy should route:

- `/` to `web:3000`
- `/api` to `api:4000`
- `/uploads` to `api:4000`

Keep `API_SERVER_BASE_URL=http://api:4000` for server-side Next.js data fetching inside Docker.
