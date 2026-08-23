# Change "units:" label to "Available units" on catalogue cards

## What
On the `/explore` catalogue page, each product card currently shows a small mono-text line like `units: 3` under the card. Update that label so it reads `Available units: 3` instead.

## Where
`src/pages/Explore.tsx` — the `ProductCard` component, line ~341:

```tsx
<p className="text-[10px] text-muted-foreground mt-1 font-mono">units: {product.availableCount}</p>
```

Change `units:` → `Available units:`. No other logic, styling, or files change.

## Acceptance
- Every product card on `/explore` shows `Available units: <count>` under the price/button.
- Unavailable products still show `Available units: 0`.
- No type errors.
