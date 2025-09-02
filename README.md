# Open Runner

This is a starter project for creating 3D applications with Babylon.js and TypeScript, named "Open Runner". It includes:

- Babylon.js (latest version)
- TypeScript
- Webpack for bundling
- Development server with live reload
- GitHub Actions for automatic deployment to GitHub Pages

## Getting Started

1. Clone this repository
2. Install dependencies: `npm install`
3. Start the development server: `npm start`
4. Build for production: `npm run build`

## Development

- Run `npm start` to start the development server
- Run `npm run build` to create a production build
- Run `npm run serve` to serve the production build locally

## Deployment

This project is configured to automatically deploy to GitHub Pages on every push to the main branch.

To enable GitHub Pages deployment:

1. Go to your repository settings
2. Navigate to "Pages" section
3. Select "GitHub Actions" as the source

The deployment workflow is defined in `.github/workflows/deploy.yml`.