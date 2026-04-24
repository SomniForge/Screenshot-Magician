# Screenshot Magician

Screenshot Magician is a web editor for turning GTA World screenshots and chat logs into polished, forum-ready images. It combines a canvas-based screenshot editor, automatic GTA World chat coloring, censoring tools, project autosave, image layers, finishing effects, direct image hosting, public testimonials, and lightweight live usage stats.

The main editor lives at `/ssmag`. The home page at `/` presents the product, live stats, reviews, and a review submission form.

## What It Does

### Screenshot Editing

- Drag and drop a base screenshot onto the canvas.
- Set custom canvas width and height.
- Move, pan, scale, and nudge the base image.
- Fit oversized canvases into the available viewport without changing export dimensions.
- Export the finished composition as a high-quality PNG.

### Chat Layers

- Paste a chat log or import a text file.
- Parse chat with `Ctrl+Enter`.
- Automatically strip timestamp prefixes such as `[12:34:56]`.
- Automatically color common GTA World chat patterns, including speech, roleplay actions, cellphone, radio, low chat, whispers, advertisements, PMs, info/alert markers, money markers, and more.
- Create, duplicate, hide, lock, and remove multiple chat layers.
- Move, scale, and nudge chat layers independently.
- Adjust chat line width.
- Toggle black bars behind chat text.
- Apply manual color overrides to selected text.

### Censoring

- Select text in the chat editor and apply:
  - black bar censoring
  - blur censoring
  - invisible text censoring
- Review active censored regions in the editor.
- Jump back to a censored selection for quick edits.
- Clear individual censor regions.

### Image Layers

- Add extra image overlays on top of the base screenshot.
- Move, scale, reorder, duplicate, hide, lock, and delete image overlays.
- Control overlay opacity.
- Choose whether each overlay is affected by global image effects.
- Use erase/restore masking tools on overlays.

### Effects And Polish

- Add stacked image effects such as grain, vignette, scanlines, and scene-style finishing layers.
- Adjust supported effect opacity and amount values.
- Randomize seeded effects where supported.
- Use smart guides for alignment and spacing while dragging layers.
- Use the navigator/minimap to keep track of the working canvas.

### Projects And Persistence

- Save projects locally in the browser with IndexedDB.
- Autosave existing projects after edits.
- Restore the current editing session after refresh.
- Manage saved projects from the Projects dialog.
- Import and export portable `.ssmag` project files.
- Get unsaved-change protection before navigating away or opening another project.
- Use undo/redo history for editor changes.

### Themes And Settings

- Switch between built-in editor themes.
- Create, save, delete, import, and export custom editor themes.
- Configure smart guide behavior.
- Configure optional image hosting.
- Toggle ad display preferences.
- View the tutorial and keyboard shortcuts from inside the editor.

### Sharing And Hosting

- Export a PNG directly from the editor.
- Upload the current screenshot to ImgBB with a user-provided API key.
- Copy direct image links for forum sharing.
- Generate share prompts/snippets after export or upload.

### Home Page, Stats, And Reviews

- Home page product overview and call to action.
- Public testimonials with username, rating, quote, and submission date.
- In-page review submission form.
- Live stats cards for unique users, active users, visits, exports, unique exporters, and average exports per user.
- Optional AdSense rail configuration.

## Tech Stack

- Vue 3
- Vuetify 3
- TypeScript
- Pinia
- Vue Router
- Vite
- Vitest
- Canvas API
- IndexedDB
- Express backend for stats and testimonials
- Docker support for backend deployment

## Repository Layout

```text
Screenshot-Magician/
  frontend/                 Vue/Vuetify application
    src/components/         Editor, footer, ad components
    src/composables/        Analytics, stats, image hosting, testimonials
    src/features/magician/  Editor logic, types, effects, themes, storage
    src/views/              Home, editor route, privacy, terms
  backend/                  Express stats/testimonials API
    src/server.ts           API routes
    src/statsStore.ts       File-backed stats/testimonials store
  deploy/                   Docker Compose stack for the backend
```

## Local Development

Install frontend dependencies:

```bash
cd frontend
npm ci
```

Start the frontend dev server:

```bash
npm run dev
```

By default, the app is served by Vite and the editor is available at:

```text
http://localhost:5173/ssmag
```

### Running The Backend Locally

The backend is only needed for live stats and testimonials. The editor itself can run without it.

```bash
cd backend
npm ci
copy .env.example .env
npm run dev
```

The local backend listens on:

```text
http://localhost:3000/api
```

In `frontend/.env`, point the frontend at the backend:

```env
VITE_STATS_API_BASE_URL=http://localhost:3000/api
```

## Environment Variables

### Frontend

Create `frontend/.env` for local development, or configure these in your hosting provider:

```env
VITE_STATS_API_BASE_URL=http://localhost:3000/api
VITE_ADSENSE_CLIENT_ID=ca-pub-xxxxxxxxxxxxxxxx
VITE_ADSENSE_HOME_RAIL_SLOT=1234567890
```

Only `VITE_STATS_API_BASE_URL` is required for stats and testimonials. In production this project currently uses:

```env
VITE_STATS_API_BASE_URL=https://stats.ssmag.xyz/api
```

The AdSense variables are optional. If they are not set, the ad slot remains disabled or shows a reserved placeholder depending on environment.

### Backend

Create `backend/.env` from `backend/.env.example`:

```env
PORT=3000
CORS_ORIGIN=https://your-frontend-domain.com
TESTIMONIAL_MODERATION_TOKEN=replace-with-a-long-random-secret
```

Use a comma-separated `CORS_ORIGIN` value if more than one frontend origin should be allowed.
Set `TESTIMONIAL_MODERATION_TOKEN` to enable moderation-only endpoints for approving or rejecting submitted testimonials.

## Useful Commands

Run these from `frontend/`:

```bash
npm run dev              # Start Vite dev server
npm run build            # Type-check and build production assets
npm run build-only       # Build without type-check wrapper
npm run type-check       # Run vue-tsc
npm run test:unit        # Run Vitest in watch mode
npm run test:unit:run    # Run Vitest once
npm run lint             # Run ESLint with fixes
npm run format           # Format frontend source
```

Run these from `backend/`:

```bash
npm run dev      # Start backend with nodemon/ts-node
npm run build    # Compile TypeScript
npm start        # Run compiled backend from dist/
```

## Testing

The frontend uses Vitest with a jsdom environment.

```bash
cd frontend
npm run test:unit:run
```

The current suite covers the chat-layer composable, including parsing, timestamp stripping, overlay creation, HTML escaping, manual color overrides, censor rendering, and censored-region summaries.

## How To Use The Editor

1. Open `/ssmag`.
2. Drop a screenshot onto the canvas or use the image upload button.
3. Paste a GTA World chat log into the chat editor.
4. Press `Ctrl+Enter` or click Parse to create a chat layer.
5. Move and scale the screenshot and chat layers until the composition matches the scene.
6. Select sensitive text in the chat editor and apply black bar, blur, or invisible censoring.
7. Add image overlays when you need props, logos, decals, or other visual layers.
8. Open Effects to add finishing texture or scene effects.
9. Save the project locally if you may return to it later.
10. Export the final PNG, or upload it to ImgBB from the editor settings/workflow.

## Keyboard Shortcuts

- `Ctrl+Enter`: parse/update the active chat layer
- `Ctrl+S`: save the current project
- `Ctrl+Z`: undo
- `Ctrl+Y`: redo
- `Ctrl+Shift+Z`: redo
- `?`: open keyboard shortcuts
- Arrow keys: nudge the active image/chat layer
- `Shift` + arrow keys: large nudge
- `+` / `-`: zoom the active image/chat layer
- `Delete`: clear selected censor or color formatting where supported

## Project Files

Saved projects are stored locally in the current browser using IndexedDB. They include the base image, canvas dimensions, chat layers, image overlays, effects, theme-related editor state, and other editor settings.

Use `.ssmag` export/import from the Projects dialog to move a project between browsers or machines.

## Backend API

The backend exposes:

- `GET /api`: health/welcome response
- `GET /api/stats/summary`: live stats summary
- `POST /api/stats/session/start`: register a session start
- `POST /api/stats/activity`: record activity heartbeat
- `POST /api/stats/export`: record image export
- `GET /api/testimonials`: list public testimonials
- `POST /api/testimonials`: submit a testimonial
- `GET /api/testimonials/moderation`: list all testimonials for moderation, requires `x-admin-token`
- `POST /api/testimonials/:testimonialId/moderate`: approve or reject a testimonial, requires `x-admin-token`

Stats are persisted to `data/stats.json`. Testimonials are persisted to `data/testimonials.json`.
New submissions are stored as pending and are not shown publicly until approved.
The built-in moderation screen lives at `/admin/testimonials` and uses the same token-based authentication in the browser.

## Docker Backend Deploy

The stats/testimonials backend can run separately from the static frontend.

Build and test locally:

```bash
cd backend
copy .env.example .env
npm ci
npm run build
docker build -t screenshot-magician-stats .
docker run --rm -p 3000:3000 --env-file .env screenshot-magician-stats
```

For a VPS or Portainer deployment:

1. Push or copy this repository to the server.
2. Set `backend/.env` with the desired `PORT` and `CORS_ORIGIN`.
3. Deploy `deploy/docker-compose.stats-backend.yml`.
4. Point a reverse proxy such as `stats.yourdomain.com` to the container on port `3000`.
5. Set the frontend production environment:

```env
VITE_STATS_API_BASE_URL=https://stats.yourdomain.com/api
```

The compose stack mounts `/app/data`, so stats and testimonials survive container restarts.

### Example Nginx Reverse Proxy

```nginx
server {
    server_name stats.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Privacy Notes

- Editor projects are saved locally in the user's browser unless exported or uploaded by the user.
- ImgBB upload uses the user's own API key, stored locally in that browser.
- The backend stores usage stats and testimonials for the public home page.
- See `/privacy` and `/terms` in the app for user-facing policy pages.

## Contributing

Bug reports and improvements are welcome. For bug reports, include:

1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. Browser/device details
5. Screenshots or exported `.ssmag` project files when helpful

## License

[MIT License](LICENSE)

Made by SomniForge.
