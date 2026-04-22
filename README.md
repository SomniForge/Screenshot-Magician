# Screenshot Magician

A powerful web-based tool for creating, editing, and managing screenshots with advanced chat overlay capabilities. Perfect for anyone who needs to make roleplay screenshots.

## 🌟 Features

### Image Handling
- 📸 Drag & drop image upload
- 🔄 Dynamic image scaling and positioning
- 🎯 Precise image manipulation with zoom and pan controls

### Chat Management
- 📝 Import chat logs from text files
- 🎨 Automatic chat color parsing
- 🔠 Custom font rendering with Arial Black
- ⚡ Quick chat parsing with Ctrl+Enter shortcut

### Censoring Tools
- ⬛ Multiple censoring options:
  - Black bar censoring
  - Blur effect
  - Invisible text
- 🎯 Easy text selection and censoring
- 🔄 Cycle between censoring types

### Layout Controls
- 📏 Customizable canvas dimensions
- 🎨 Black bar toggle for chat messages
- 🎯 Independent chat overlay positioning
- 🔍 Zoom controls for both image and chat

### Export
- 💾 High-quality PNG export
- 🎯 Pixel-perfect rendering
- 🎨 Preserved styling and effects

## 🚀 Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

## Docker Backend Deploy

The live tracker backend can run separately from the frontend as its own container.

1. Build and test locally:
   ```bash
   cd backend
   copy .env.example .env
   npm ci
   npm run build
   docker build -t screenshot-magician-stats .
   docker run --rm -p 3000:3000 --env-file .env screenshot-magician-stats
   ```

2. Set the frontend to call the backend:
   In `frontend/.env`, set `VITE_STATS_API_BASE_URL=https://stats.yourdomain.com/api`

3. Deploy on your VPS with Portainer:
   Use `deploy/docker-compose.stats-backend.yml` as a stack, or copy its contents into a Portainer stack.

4. Reverse proxy it:
   Point `stats.yourdomain.com` to the container on port `3000`, or expose it as `/api` behind your existing frontend domain.

5. Persist the stats:
   The compose stack mounts `/app/data`, so `stats.json` survives container restarts.

### Recommended VPS flow

1. Push this repository to GitHub.
2. On the VPS, clone the repo somewhere Portainer can access.
3. In `backend/.env`, set:
   ```env
   PORT=3000
   CORS_ORIGIN=https://your-frontend-domain.com
   ```
4. In the frontend deploy environment, set:
   ```env
   VITE_STATS_API_BASE_URL=https://stats.yourdomain.com/api
   ```
5. In Portainer, create a stack from `deploy/docker-compose.stats-backend.yml`.

### Example Nginx reverse proxy

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

## 🛠️ Usage

1. **Upload an Image**
   - Drag and drop an image onto the canvas
   - Or use the camera icon to select an image file

2. **Add Chat**
   - Paste chat text into the right panel
   - Click "Parse" or press Ctrl+Enter to process
   - Chat will appear overlaid on the image

3. **Customize**
   - Use the toolbar to toggle features
   - Drag to position image and chat
   - Use mouse wheel to zoom

4. **Censor Content**
   - Select text in the chat panel
   - Click the eye icon to cycle censoring options
   - Choose between black bar, blur, or invisible

5. **Export**
   - Click the save icon to export your creation
   - Exports as high-quality PNG

## 🎨 Customization

- Adjust canvas dimensions using the width/height inputs
- Toggle black bars behind chat text
- Set your character name for chat parsing
- Control image and chat positioning independently

## 🔧 Technical Details

Built with:
- Vue 3
- Vuetify
- TypeScript
- Canvas API

## 📝 License

[MIT License](LICENSE)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🐛 Bug Reports

If you find a bug, please open an issue with:
1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. Screenshots if applicable

## ✨ Future Plans

=======
- All GTA World color swatches
- Multiple layer support
- Image filter overlays
---

Made with ❤️ by SomniForge
