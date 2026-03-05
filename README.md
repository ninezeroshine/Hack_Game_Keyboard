# Hack Swipe - Typing Defense Game

A hacker-themed typing defense game where you defend your firewall by typing fast!

## 🎮 Game Features

- **Multiple Game Modes**: Sprint Mode (2:30), Endless Mode, Training Mode, Rhythm Mode
- **Dynamic Difficulty**: From Recruit (2 keys) to Grandmaster (24+ keys)
- **Audio Integration**: Upload your own music for rhythm-based gameplay
- **Visual Effects**: Glitch effects, particles, and hacker-themed UI
- **Progressive Difficulty**: Adaptive spawn system that increases challenge
- **Keyboard Support**: English (QWERTY) and Russian (ЙЦУКЕН) layouts

## 🚀 Deployment to Vercel

### Quick Deploy
1. Push this code to your GitHub repository
2. Go to [Vercel](https://vercel.com)
3. Import your GitHub repository
4. Deploy!

### Manual Deploy
```bash
# Install dependencies
npm install

# Build the project
npm run build

# Deploy to Vercel
vercel --prod
```

## 🛠️ Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📁 Project Structure

```
├── src/                    # Source code
│   ├── audio/             # Audio management and beat detection
│   ├── config/            # Game configuration and constants
│   ├── core/              # Core game engine components
│   ├── entities/          # Game entities (viruses, cores)
│   ├── rendering/         # Rendering and visual effects
│   ├── systems/           # Game systems (input, health, scoring)
│   ├── ui/                # User interface components
│   └── utils/             # Utility functions
├── styles/                # CSS stylesheets
├── dist/                  # Built files (auto-generated)
├── index.html             # Main HTML file
├── package.json           # Project configuration
└── vercel.json           # Vercel deployment configuration
```

## 🎯 Game Mechanics

- **Typing Defense**: Type the words/keys that appear on screen to destroy viruses
- **Combo System**: Chain successful hits for higher scores
- **Health System**: System integrity decreases when viruses reach the core
- **Rhythm Mode**: Sync gameplay with your favorite music
- **Progressive Difficulty**: More complex patterns as you advance

## 🎨 Customization

- Keyboard layouts (English/Russian)
- Difficulty levels
- Audio settings
- Visual effects (glitch, contrast)
- Font sizes

## 📱 Performance

- Built with Vite for optimal performance
- Canvas-based rendering for smooth gameplay
- Optimized asset loading
- Progressive difficulty scaling

---

Ready to defend your system? Start typing! 💻🔥