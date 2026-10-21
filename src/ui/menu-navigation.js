/** Navigate only visible, enabled choices; desktop menus also contain hidden sheet controls. */
export function focusMenuItem(menu, key, activeElement) {
  const items = [...menu.querySelectorAll('button:not(:disabled)')]
    .filter(item => item.getClientRects().length &&
      getComputedStyle(item).visibility !== 'hidden');
  if (!items.length) return;
  const current = items.indexOf(activeElement);
  const last = items.length - 1;
  const next = key === 'Home' ? 0 : key === 'End' ? last :
    current < 0 ? (key === 'ArrowUp' ? last : 0) :
      (current + (key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
  items[next].focus();
}
