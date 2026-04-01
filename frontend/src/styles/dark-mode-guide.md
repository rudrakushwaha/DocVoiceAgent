# Dark Mode Implementation Guide

## Overview
Your DocVoice-Agent now has a professional dark mode implementation following modern UI standards like ChatGPT, Notion, and GitHub.

## Color System

### Dark Mode Colors (as requested)
- **Background Primary**: `#0f172a` (deep slate)
- **Background Secondary**: `#1f2937` (card/container)
- **Background Tertiary**: `#374151` (hover states)
- **Text Primary**: `#f9fafb` (high contrast)
- **Text Secondary**: `#d1d5db` (medium contrast)
- **Text Muted**: `#9ca3af` (low contrast)
- **Border Color**: `#374151` (subtle borders)
- **Accent Color**: `#6366f1` (primary brand)
- **Accent Hover**: `#7c3aed` (hover state)
- **User Bubble**: `#2563eb` (blue, like ChatGPT)
- **AI Bubble**: `#1f2937` (neutral dark)

### Light Mode Colors
- **Background Primary**: `#f9fafb` (light gray)
- **Background Secondary**: `#ffffff` (white cards)
- **Background Tertiary**: `#f3f4f6` (light gray)
- **Text Primary**: `#111827` (dark text)
- **Text Secondary**: `#6b7280` (medium gray)
- **Text Muted**: `#9ca3af` (light gray)
- **Border Color**: `#e5e7eb` (light borders)
- **Accent Color**: `#6366f1` (consistent brand)
- **Accent Hover**: `#4f46e5` (darker blue)
- **User Bubble**: `#6366f1` (brand blue)
- **AI Bubble**: `#ffffff` (white)

## CSS Variables Structure

```css
:root {
  --bg-primary: #f9fafb;
  --bg-secondary: #ffffff;
  --bg-tertiary: #f3f4f6;
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --text-muted: #9ca3af;
  --border-color: #e5e7eb;
  --accent-color: #6366f1;
  --accent-hover: #4f46e5;
  --bubble-user: #6366f1;
  --bubble-ai: #ffffff;
}

body.dark {
  --bg-primary: #0f172a;
  --bg-secondary: #1f2937;
  --bg-tertiary: #374151;
  --text-primary: #f9fafb;
  --text-secondary: #d1d5db;
  --text-muted: #9ca3af;
  --border-color: #374151;
  --accent-color: #6366f1;
  --accent-hover: #7c3aed;
  --bubble-user: #2563eb;
  --bubble-ai: #1f2937;
}
```

## Component Styling

### Chat Bubbles
- **User messages**: Blue bubble (`#2563eb`) with white text
- **AI messages**: Dark gray bubble (`#1f2937`) with primary text
- Proper contrast ratios for accessibility
- Rounded corners for modern look

### Buttons
- Primary buttons use accent color with white text
- Secondary buttons use tertiary background
- Hover states with subtle animations
- Focus states for accessibility

### Input Fields
- Dark background with proper borders
- Focus states with accent color outline
- Proper text contrast

### Document Panel
- Clean card-based layout
- Proper hover states on document items
- Action buttons with theme-aware colors

## Usage Examples

### Using CSS Variables in Components
```jsx
// Instead of hardcoded colors
<div style={{ backgroundColor: '#ffffff', color: '#000000' }}>

// Use theme variables
<div style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
```

### Using Tailwind Classes
```jsx
// Dark mode classes
<div className="bg-white dark:bg-gray-900 text-black dark:text-white">

// Custom theme colors
<div className="bg-primary text-primary-foreground">
```

## Theme Switching

The theme is controlled by the `ThemeContext`:
- Automatically detects system preference
- Persists user choice in localStorage
- Adds `dark` class to body element

## Accessibility Features

- High contrast ratios (WCAG compliant)
- Focus indicators on interactive elements
- Smooth transitions (300ms)
- Proper color combinations

## Files Modified

1. **`src/styles/theme.css`** - Main theme system
2. **`src/components/dashboard/dashboard.css`** - Dashboard styles
3. **`src/components/dashboard/DocumentPanel.jsx`** - Document panel
4. **`src/components/dashboard/MessageInput.jsx`** - Message input
5. **`tailwind.config.js`** - Tailwind configuration

## Testing

To test dark mode:
1. Toggle theme using the ThemeContext
2. Check all components in both light and dark modes
3. Verify text contrast and readability
4. Test hover and focus states

## Professional UI Features

- **ChatGPT-style chat bubbles** with proper alignment
- **Notion-inspired card layouts** with subtle shadows
- **GitHub-like dark theme** consistency
- **Smooth transitions** for theme switching
- **Modern typography** and spacing
- **Responsive design** maintained

The implementation ensures your app looks professional and modern in both light and dark modes, with proper accessibility and user experience.
