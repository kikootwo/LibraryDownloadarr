# Contributing to PlexDownloadarr

Thank you for your interest in contributing to PlexDownloadarr! This document provides guidelines and instructions for contributing.

## Code of Conduct

Be respectful, inclusive, and constructive in all interactions with the community.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/PlexDownloadarr.git`
3. Create a feature branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Test your changes thoroughly
6. Commit your changes: `git commit -m "Add your feature"`
7. Push to your fork: `git push origin feature/your-feature-name`
8. Open a Pull Request

## Development Setup

### Prerequisites

- Node.js 20+
- Docker (optional, for testing)
- A Plex Media Server for testing

### Backend Development

```bash
cd backend
npm install
cp .env.example .env
# Configure your .env
npm run dev
```

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

## Code Style

### TypeScript

- Use TypeScript strict mode
- Define interfaces for all data structures
- Avoid using `any` type when possible
- Use meaningful variable and function names

### React

- Use functional components with hooks
- Keep components small and focused
- Use TypeScript for prop types
- Follow React best practices

### Styling

- Use Tailwind CSS utility classes
- Follow the existing design system
- Maintain responsive design
- Test on multiple screen sizes

## Commit Messages

Follow conventional commits format:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Test additions or modifications
- `chore:` Maintenance tasks

Example: `feat: add batch download functionality`

## Pull Request Process

1. Update documentation if needed
2. Add tests for new features
3. Ensure all tests pass
4. Update the README if needed
5. Request review from maintainers

## Feature Requests

Open an issue with:
- Clear description of the feature
- Use case and benefits
- Potential implementation approach

## Bug Reports

Open an issue with:
- Clear description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version, etc.)
- Screenshots if applicable

## Testing

Before submitting a PR:
1. Test the backend API endpoints
2. Test the frontend UI flows
3. Test authentication (both admin and Plex OAuth)
4. Test with different Plex library configurations
5. Check for console errors
6. Verify responsive design

## Documentation

- Update README for new features
- Add JSDoc comments for complex functions
- Update API documentation
- Include examples where helpful

## Questions?

Feel free to open an issue for questions or join discussions.

Thank you for contributing to PlexDownloadarr!
