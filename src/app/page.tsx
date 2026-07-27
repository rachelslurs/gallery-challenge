import { fetchBoards, type Board } from "./api/boards";
import Gallery from "@/components/Gallery";
import { COPY } from "@/lib/copy";

/**
 * Sub-boards are fetched on the server so the first paint already has them.
 * Assets stay on the client because they are cursor-paginated and reordered
 * locally.
 *
 * This route uses no dynamic APIs, so Next prerenders it at build time and the
 * board list would otherwise be frozen until the next deploy. Revalidating
 * keeps the document served as static HTML, which is worth roughly 590ms of
 * TTFB against awaiting Air's API on every request, while still picking up
 * board changes within the window.
 */
export const revalidate = 300;
export default async function Home() {
  let boards: Board[] = [];
  let title: string = COPY.galleryFallbackTitle;

  try {
    const response = await fetchBoards();
    boards = response?.data ?? [];
    // `includeAncestors` returns the parent board, which is the page's real title.
    title = boards[0]?.ancestors?.[0]?.title ?? title;
  } catch {
    // Render the shell regardless; the client half reports its own failures.
  }

  return <Gallery initialBoards={boards} boardTitle={title} />;
}
