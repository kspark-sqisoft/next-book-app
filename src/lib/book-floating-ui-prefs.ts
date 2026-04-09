const WIDGET_FLOATING_VISIBLE_KEY = "book-ui-floating-widget-visible";
const MEDIA_FLOATING_VISIBLE_KEY = "book-ui-floating-media-visible";

function readVisible(key: string, defaultOpen: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === "0") return false;
    if (v === "1") return true;
    return defaultOpen;
  } catch {
    return defaultOpen;
  }
}

function writeVisible(key: string, visible: boolean): void {
  try {
    localStorage.setItem(key, visible ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function readFloatingWidgetPaletteVisible(): boolean {
  return readVisible(WIDGET_FLOATING_VISIBLE_KEY, true);
}

export function writeFloatingWidgetPaletteVisible(visible: boolean): void {
  writeVisible(WIDGET_FLOATING_VISIBLE_KEY, visible);
}

export function readFloatingMediaLibraryVisible(): boolean {
  return readVisible(MEDIA_FLOATING_VISIBLE_KEY, true);
}

export function writeFloatingMediaLibraryVisible(visible: boolean): void {
  writeVisible(MEDIA_FLOATING_VISIBLE_KEY, visible);
}
