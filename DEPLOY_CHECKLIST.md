# Deployment Checklist

This checklist verifies the stable production request chain and the ZERRT·Ai UI after deployment.

## 1. Required Environment

```env
WEB_PORT=3000
API_PORT=4000
NEXT_PUBLIC_API_BASE_URL=/api
API_SERVER_BASE_URL=http://api:4000
CORS_ORIGIN=http://8.163.38.177:3000
```

APIMart values must stay server-side only:

```env
APIMART_API_KEY=your_real_key
APIMART_BASE_URL=https://api.apimart.ai/v1
APIMART_MODEL=gpt-5.5
APIMART_IMAGE_BASE_URL=https://api.apimart.ai/v1
APIMART_IMAGE_MODEL=gpt-image-2
APIMART_NANO_BANANA_PRO_MODEL=gemini-3-pro-image-preview
APIMART_IMAGE_MODELS=gpt-image-2,nano-banana-pro,mock-image-provider
APIMART_IMAGE_SIZE=1:1
APIMART_IMAGE_TIMEOUT_SECONDS=300
```

## 2. Rebuild

```bash
git pull
docker compose down
docker compose up -d --build
```

If only the web image changed:

```bash
docker compose build --no-cache web
docker compose up -d web
```

## 3. Container And Environment Checks

```bash
docker ps
docker compose ps
docker compose exec web env | grep -E "NEXT_PUBLIC_API_BASE_URL|API_SERVER_BASE_URL"
```

Expected:

```text
NEXT_PUBLIC_API_BASE_URL=/api
API_SERVER_BASE_URL=http://api:4000
```

## 4. API Proxy Checks

API container health:

```bash
docker compose exec api wget -qO- http://localhost:4000/api/health
```

Web container can reach API through Docker DNS:

```bash
docker compose exec web wget -qO- http://api:4000/api/health
docker compose exec web wget -qO- http://api:4000/api/projects
```

Next rewrite health from the web container:

```bash
docker compose exec web wget -qO- http://localhost:3000/api/health
```

Host checks through the same-origin Next proxy:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/image-models
```

Expected image model IDs:

```text
gpt-image-2
nano-banana-pro
mock-image-provider
```

Create a project through the Next proxy:

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"title":"UI验收项目","description":"ZERRT·Ai 品牌 UI 验收"}'
```

Optional backend direct check:

```bash
curl -X POST http://localhost:4000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"title":"后端直连项目","description":"直接后端创建"}'
```

Test GPT Image 2 generation through the Next proxy. Replace the project ID first:

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"projectId":"替换为项目ID","prompt":"一张高级电商产品图","modelId":"gpt-image-2","aspectRatio":"1:1"}'
```

Test Nano Banana Pro generation through the Next proxy. Replace the project ID first:

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"projectId":"替换为项目ID","prompt":"一个女孩坐在草地上，看着远方的雪山，真实摄影质感","modelId":"nano-banana-pro","aspectRatio":"1:1"}'
```

Check project versions after generation. Replace the project ID first:

```bash
curl http://localhost:3000/api/projects/替换项目ID/versions
```

Test 2K AI high-resolution redraw. Replace the project and version IDs first:

```bash
curl -X POST http://localhost:3000/api/projects/替换项目ID/versions/替换版本ID/upscale \
  -H "Content-Type: application/json" \
  -d '{"projectId":"替换项目ID","versionId":"替换版本ID","targetResolution":"2K","modelId":"nano-banana-pro"}'
```

Test 4K AI high-resolution redraw. Replace the project and version IDs first:

```bash
curl -X POST http://localhost:3000/api/projects/替换项目ID/versions/替换版本ID/upscale \
  -H "Content-Type: application/json" \
  -d '{"projectId":"替换项目ID","versionId":"替换版本ID","targetResolution":"4K","modelId":"nano-banana-pro"}'
```

Check the API logs and confirm the Nano request was mapped to the provider model:

```bash
docker compose logs --tail=200 api
```

Expected log fields:

```text
modelId: nano-banana-pro
providerModel: gemini-3-pro-image-preview
```

## 5. Stale Public API Checks

The built frontend bundle must not contain the old public API host:

```bash
docker compose exec web sh -lc "grep -R '8.163.38.177:4000' -n /app/apps/web/.next/static /app/apps/web/.next/server || true"
```

Expected: no output.

The built frontend bundle must not contain the wrong backend path:

```bash
docker compose exec web sh -lc "grep -R '4000/projects' -n /app/apps/web/.next/static /app/apps/web/.next/server || true"
```

Expected: no output.

## 6. Browser Validation

1. Open `http://8.163.38.177:3000`.
2. Confirm the top header shows `ZERRT·Ai`.
3. Create a project from the homepage.
4. In Network, confirm the request URL is:

```text
http://8.163.38.177:3000/api/projects
```

5. Confirm these incorrect URLs never appear:

```text
http://8.163.38.177:4000/projects
http://8.163.38.177:3000/http://...
http://8.163.38.177:4000/api/api/projects
```

6. Open a project workspace.
7. Confirm the model selector shows:

- `GPT Image 2`
- `Nano Banana Pro`

8. Select `Nano Banana Pro`, click `开始生成`, and confirm the request body contains:

```json
{
  "modelId": "nano-banana-pro"
}
```

9. Click a generated image or `预览大图`; confirm the preview dialog opens.
10. Click `下载原图`; confirm the file downloads as `zerrt-ai-{projectId}-{versionId}.png` or the matching source extension.
11. Click `2K 高清重绘` or `4K 细节增强`; confirm a new task is created and the UI shows loading.
12. After success, confirm the new upscale version appears in the version list and can be previewed/downloaded.
13. If the provider is unavailable, the UI should show `图片分析失败，请稍后重试。` or `高清放大失败，请稍后重试。`.
14. If a request fails, the UI should only show a short Chinese message such as:

```text
请求失败，状态码 404。
```

The browser Console may show `[api-request-error]` with `url`, `method`, `status`, and `responseBody` truncated to 500 characters.

## 7. Persistence Checks

Restart API only:

```bash
docker compose restart api
```

Expected:

- Existing projects remain in PostgreSQL because `postgres_data` is a Docker volume.
- Uploaded/generated images remain visible because `api_uploads` is a Docker volume.

## 8. Future Domain / HTTPS Mode

```env
NEXT_PUBLIC_API_BASE_URL=/api
API_SERVER_BASE_URL=http://api:4000
CORS_ORIGIN=https://your-domain.com
```

Keep browser traffic same-origin through `/api`. After this works, public port `4000` can be closed in the ECS security group.
