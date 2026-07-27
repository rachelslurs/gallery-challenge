import { fetchBoards, type Board } from "./api/boards";
import Gallery from "@/components/Gallery";
import { COPY } from "@/lib/copy";

/**
 * Sub-boards are fetched on the server so the first paint already has them.
 * Assets stay on the client because they are cursor-paginated and reordered
 * locally. Next does not cache POST fetches, so this stays dynamic without a
 * route segment config.
 */
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
