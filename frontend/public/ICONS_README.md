# PWA Icons

For a complete PWA experience, you need to provide icon images in the following sizes:

## Required Icons

1. **icon-192.png** (192x192 pixels)
2. **icon-512.png** (512x512 pixels)

## Creating Icons

You can use the provided `icon.svg` as a template to create PNG icons:

### Using Online Tools
1. Go to https://realfavicongenerator.net/
2. Upload your logo or use the icon.svg
3. Generate all required sizes
4. Download and place in the `public` folder

### Using ImageMagick (if available)
```bash
convert icon.svg -resize 192x192 icon-192.png
convert icon.svg -resize 512x512 icon-512.png
```

### Using Inkscape
```bash
inkscape icon.svg --export-png=icon-192.png -w 192 -h 192
inkscape icon.svg --export-png=icon-512.png -w 512 -h 512
```

## Temporary Fallback

Until proper icons are added, the app will still work but may not have the best install experience on mobile devices.
