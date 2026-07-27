export interface Board {
  id: string;
  parentId: string | null;
  creatorId: string;
  workspaceId: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  hasCurrentUser: boolean;
  thumbnails?: string[];
  ancestors?: Pick<Board, "id" | "title">[];
  pos: number;
}

export interface BoardsListResponse {
  data: Board[];
  pagination: {
    hasMore: boolean;
    cursor: string | null;
  };
  total: number;
}

const parentBoardId = "c74bbbc8-602b-4c88-be71-9e21b36b0514";
export const shortId = "bDkBvnzpB";

/** Public URL for a board on the reference deployment. */
export const boardUrl = (boardId: string): string =>
  `https://app.air.inc/a/${shortId}/b/${boardId}`;

export const fetchBoards = (): Promise<BoardsListResponse> =>
  fetch(`https://api.air.inc/shorturl/${shortId}/boards/${parentBoardId}`, {
    method: "post",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      ancestorCutoff: parentBoardId,
      numThumbnails: 1,
      view: parentBoardId,
      includeAncestors: true,
      libraryBoards: "ALL",
      limit: 30,
      cursor: null,
      sortBy: "custom",
      sortField: {
        direction: "desc",
        name: "dateModified",
      },
    }),
  }).then((response) => {
    // A non-2xx with a JSON body would otherwise resolve as success, and the
    // gallery would report the end of the list instead of a failure.
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json() as Promise<BoardsListResponse>;
  });
