# Deployment Checklist

This checklist verifies the production request chain on Ubuntu ECS:

- Browser requests same-origin `/api/...` on the web service.
- Next.js rewrites `/api/:path*` to `http://api:4000/api/:path*` inside Docker.
- Next.js server rendering uses `API_SERVER_BASE_URL=http://api:4000`.
- NestJS keeps the real global route prefix `/api`.

## 1. Required Environment

For current public IP testing:

```env
WEB_PORT=3000
API_PORT=4000
NEXT_PUBLIC_API_BASE_URL=/api
API_SERVER_BASE_URL=http://api:4000
CORS_ORIGIN=http://8.163.38.177:3000
```

APIMart values must be configured in `.env` without committing real keys:

```env
APIMART_API_KEY=your_real_key
APIMART_BASE_URL=https://api.apimart.ai/v1
APIMART_MODEL=gpt-5.5
APIMART_IMAGE_BASE_URL=https://api.apimart.ai/v1
APIMART_IMAGE_MODEL=gpt-image-2
APIMART_IMAGE_SIZE=1:1
```

## 2. Rebuild After Pulling Code

```bash
git pull
docker compose down
docker compose up -d --build
```

If only the web image needs to be rebuilt:

```bash
docker compose build web
docker compose up -d web
```

## 3. Required Command Verification

Docker container status:

```bash
docker ps
docker compose ps
```

API container health check:

```bash
docker compose exec api wget -qO- http://localhost:4000/api/health
```

Web container can reach the API service through Docker DNS:

```bash
docker compose exec web wget -qO- http://api:4000/api/health
```

Web container can read the project list through Docker DNS:

```bash
docker compose exec web wget -qO- http://api:4000/api/projects
```

Web container validates the Next.js rewrite path:

```bash
docker compose exec web wget -qO- http://localhost:3000/api/health
```

ECS host validates the public same-origin Next API proxy:

```bash
curl http://localhost:3000/api/health
```

ECS host creates a project through the Next proxy:

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"title":"代理验收项目","description":"通过 Next rewrite 创建"}'
```

ECS host creates a project by directly calling the backend:

```bash
curl -X POST http://localhost:4000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"title":"后端直连项目","description":"直接后端创建"}'
```

Expected project response:

```json
{
  "id": "...",
  "title": "...",
  "description": "...",
  "createdAt": "...",
  "updatedAt": "..."
}
```

## 4. Browser Verification

1. Open `http://8.163.38.177:3000`.
2. Open DevTools Network.
3. Create a project from the homepage.
4. Confirm the browser request URL is:

```text
http://8.163.38.177:3000/api/projects
```

5. Confirm the request body is:

```json
{
  "title": "项目名称输入值",
  "description": "项目说明输入值"
}
```

6. Confirm these incorrect URLs never appear:

```text
http://8.163.38.177:3000/http://8.163.38.177:4000/api/projects
http://8.163.38.177:4000/projects
http://8.163.38.177:4000/api/api/projects
```

7. If a request fails, the UI should show only a short Chinese message such as:

```text
请求失败，状态码 404。
```

8. The browser Console may show `[api-request-error]` with:

- `url`
- `method`
- `status`
- `responseBody` truncated to 500 characters
- fetch error cause when available

## 5. Upload And Generation Smoke Test

1. Open a project workspace.
2. Confirm `GET /api/image-models` returns `apimart-gpt-image-2` and `mock-image-provider`.
3. Upload one png/jpg/jpeg/webp image under 10MB.
4. Enter a prompt.
5. Select `GPT-Image-2`.
6. Click `生成图片`.
7. Confirm `GET /api/tasks/{taskId}` eventually returns `status = success`.
8. Confirm the new version image URL starts with `/uploads/projects/.../outputs/...`.
9. Refresh the page and confirm the version remains visible.

## 6. Persistence Checks

Restart API only:

```bash
docker compose restart api
```

Expected:

- Existing projects remain in PostgreSQL because `postgres_data` is a Docker volume.
- Uploaded/generated images remain visible because `api_uploads` is a Docker volume.

## 7. Future Nginx / Domain Mode

When using a domain and HTTPS:

```env
NEXT_PUBLIC_API_BASE_URL=/api
API_SERVER_BASE_URL=http://api:4000
CORS_ORIGIN=https://your-domain.com
```

The reverse proxy should route:

- `/` to `web:3000`
- `/api` to `web:3000` if you keep Next rewrites as the proxy layer
- `/uploads` to `web:3000` if you keep Next rewrites as the proxy layer

After same-origin proxy mode is confirmed, the ECS security group can close public port `4000`. Keep only `3000` while testing by IP, or later expose only `80/443` through Nginx.
