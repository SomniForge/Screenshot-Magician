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

### AdSense Configuration

To enable the HomeView ad rail with Google AdSense:

1. Copy `.env.example` to `.env.local`
2. Set `VITE_ADSENSE_CLIENT_ID` to your AdSense publisher ID, for example `ca-pub-xxxxxxxxxxxxxxxx`
3. Set `VITE_ADSENSE_HOME_RAIL_SLOT` to the ad slot ID for your HomeView unit

The existing in-app ad toggle still controls whether the slot is shown.

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

- All GTA World color swatches
- Multiple layer support
- Image filter overlays
---

Made with ❤️ by SomniForge
