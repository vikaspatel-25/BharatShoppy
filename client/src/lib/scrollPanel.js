/**
 * Scrolls to the top so a notice shown after a save or an error is visible.
 * The panels scroll inside <main>, not the window, so window.scrollTo alone does nothing there.
 */
export function scrollToTop() {
  if (typeof window === "undefined") return;
  window.scrollTo({ top: 0, behavior: "smooth" });
  document.querySelectorAll("main").forEach((el) => {
    if (el.scrollHeight > el.clientHeight) el.scrollTo({ top: 0, behavior: "smooth" });
  });
}
