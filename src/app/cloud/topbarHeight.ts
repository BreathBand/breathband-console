export function trackTopbarHeight(header: HTMLElement | null): (() => void) | undefined {
  const app = header?.parentElement;
  if (!header || !app) return undefined;
  const observer = new ResizeObserver(() => {
    app.style.setProperty("--topbar-measured", `${header.offsetHeight}px`);
  });
  observer.observe(header);
  return () => observer.disconnect();
}
