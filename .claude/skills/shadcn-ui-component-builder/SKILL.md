---
name: shadcn-ui-component-builder
description: Build React UI components using existing shadcn/ui primitives from `@/ui` and project-specific custom components in `@/components`. Use React v19 component syntax, craft custom hooks for interactive behavior, and style with Tailwind CSS v4 using CSS variables from `@/styles/globals.css`.
---

This skill is for generating new UI components and interactive hooks within the Stashly codebase.

Use this skill when the user asks to build or extend UI components in this project, especially when the implementation should:

- use `@/ui` for core shadcn/ui primitives
- use `@/components` for existing custom components and composable pieces
- follow React v19 syntax (client components only, no RSC)
- create reusable custom hooks for interactions and state
- style components with Tailwind CSS v4 and CSS variables defined in `@/styles/globals.css`

## When to use this skill

- building a new screen, panel, widget, or interaction
- creating a new custom component composable from existing shadcn/ui elements
- adding hooks for animation, toggles, modals, menus, drag/drop, filtering, or other UI behavior
- making styling consistent with the repo's Tailwind + CSS variable design system

## Implementation expectations

- keep generated components in `app/components/` or feature-specific subfolders under `app/components/`
- prefer imports from `@/ui` for base controls like `Button`, `Input`, `Card`, `Dialog`, `Tabs`, etc.
- extend and compose existing custom components from `@/components` when available
- define hooks in `app/hooks/` when interaction logic is reusable or stateful
- use `useId`, `useState`, `useMemo`, `useCallback`, and other React hooks as needed
- avoid server-only and RSC patterns; generate browser-compatible client components
- style with Tailwind classes plus CSS variables from `app/styles/globals.css` rather than inline styles

## Example guidance

- For a new action panel, use a shadcn `Card` with `CardHeader`, `CardContent`, and `CardFooter`
- Use a custom hook like `useDropdownState` to encapsulate open/close logic and keyboard navigation
- Use CSS variables for brand colors, spacing, and typography from `@/styles/globals.css`
- When behavior is interactive, prefer a custom hook in `app/hooks/` rather than embedding complex logic directly in the component

## Output shape

The skill should generate:

- one or more well-structured React component files in `app/components/`
- optional hook files in `app/hooks/`
- clear Tailwind-based styling using the repo's CSS variables
- concise import paths with `@/...` aliases
- accessible markup, keyboard-friendly interactions, and maintainable component structure
