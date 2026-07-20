# Maintenance Manager accessibility contract

This batch keeps the existing Vorta visual system while making the Maintenance Manager portal more predictable for keyboard, assistive-technology and high-contrast users.

## Keyboard navigation

Equipment route tabs use a roving focus model:

- `Tab` enters the active Equipment section.
- `Arrow Left` and `Arrow Right` move focus through adjacent sections without changing the route.
- `Home` moves focus to Overview.
- `End` moves focus to the final Equipment action.
- `Enter` or `Space` activates the focused section using the existing route.

Only the active Equipment tab participates in the normal tab order. Each tab exposes `aria-selected`, while the current route also retains `aria-current="page"`.

## Visible state

The Maintenance portal applies a consistent focus-visible outline to interactive controls. Active sidebar items, selected Equipment tabs and pressed Shift Cover cards have a structural outline or inset marker so state does not rely on colour alone.

## User preferences

- Reduced-motion users receive near-instant transitions and single-iteration animations.
- Forced-colour mode receives explicit outlines for current, selected and pressed controls.

## Regression controls

- `scripts/accessibility-navigation-contracts.mjs` prevents the keyboard, focus and active-state contracts from being removed.
- `tests/browser/maintenance-manager-accessibility.spec.ts` exercises the rendered keyboard route and Shift Cover selection workflow at the laptop breakpoint.
- The implementation remains React-owned and does not add document-wide event interception, `MutationObserver`, or DOM rewriting.
