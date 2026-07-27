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
const shortId = "bDkBvnzpB";

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
  }).then((r) => r.json());
