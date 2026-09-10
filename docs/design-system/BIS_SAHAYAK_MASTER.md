# BIS Sahayak Design System

## Product Direction

A calm, evidence-led standards operations console. The interface should feel precise and trustworthy, with enough warmth to make regulatory work approachable. Use a dense dashboard rhythm for tools and data, then give the assistant workflow the most breathing room.

## Visual Language

- Style: data-dense enterprise dashboard with editorial warmth
- Light mode: paper `#F7F4EE`, ink-blue `#173B57`, copper action accent `#D77D58`, powder blue support `#7BA9C2`
- Dark mode: blue-black `#0B1117`, raised slate `#16232D`, oat text `#F2F0EA`, soft blue control `#9CC7DD`, warm copper `#E49A78`
- Avoid: purple AI gradients, decorative blobs, excessive glass blur, emoji icons, low-contrast gray text
- Radius: 8px controls, 12px cards, 16px hero surfaces; circular controls only when the shape communicates the action
- Shadows: quiet, wide, and low-opacity; dark mode uses deeper shadows rather than brighter borders

## Typography

- Body: Inter, 15px base, 1.75 line height
- Headings: Inter semibold/bold, tight display tracking only on hero headings
- Labels: 11-12px with restrained uppercase tracking
- Keep paragraph lines below 75 characters on desktop and 60 on mobile

## Interaction Rules

- Primary controls are at least 44px tall and have visible focus rings.
- Every icon-only control has an accessible label and a tooltip/title where useful.
- Hover transitions use 150-300ms and transform/opacity only.
- Destructive actions require confirmation and report failure inline.
- Honor `prefers-reduced-motion` globally.
- Use semantic color plus text or icon for status; never rely on color alone.

## Layout Rules

- Desktop: fixed navigation rail plus a fluid main workspace with a max-width content column.
- Mobile: navigation becomes a drawer with a sticky top bar and no horizontal overflow.
- One primary action per screen; secondary actions stay visually quiet.
- Keep assistant composer controls compact, direct, and visually attached to the content they operate on.

## Theme Tokens

The canonical implementation lives in `frontend/src/app/globals.css`. Components should prefer `var(--color-*)` tokens over raw hex values so light and dark modes stay paired.
