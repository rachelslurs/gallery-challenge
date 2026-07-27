export interface Clip {
  id: string;
  accountId: string;
  workspaceId: string;
  workspaceImage: string;
  workspaceName: string;
  source: string;
  ext: string;
  type: "video" | "photo" | "livePhoto" | "animated" | "audio" | "nonMedia";
  size: number; // Will be set by server but required for canUpload check
  status:
    | "created"
    | "uploaded"
    | "transcoding"
    | "transcoded"
    | "failed"
    | "nonTranscodable";
  bookmarked: boolean;
  createdAt: string;
  recordedAt: string;
  updatedAt: string;
  title?: string;
  description?: string;
  importedName?: string;
  duration?: number;
  height: number;
  width: number;
  rotation: number;
  visible?: boolean;
  ownerName: string;
  owner: {
    ownerName: string;
    ownerAvatar: string;
  };
  avatar: string | null;
  assets: {
    image: string;
    video?: string;
    previewVideo?: string;
    seekVideo?: string;
    pdf?: string;
    original?: string;
  };
  mime?: string;
  altResolutions: {
    ext: string; // 'MP4'
    height: number; // 720
    width: number; // 1280
    id: string;
  }[];
  hasOpenDiscussions?: boolean;
  openDiscussionCount?: number;
  openCommentCount?: number;
  assetId: string;
  version: number;
  assetVersionCount?: number;
  isDefault: boolean;
  resolution?: number;
  boardCount?: number;
  tagCount?: number;
}

export interface ClipsListResponse {
  data: {
    total: number;
    clips: Clip[];
  };
  pagination: {
    hasMore: boolean;
    cursor: null | string;
  };
}

const boardId = "c74bbbc8-602b-4c88-be71-9e21b36b0514";
const shortId = "bDkBvnzpB";

export const fetchAssets = ({
  cursor,
}: {
  cursor: string | null;
}): Promise<ClipsListResponse> =>
  fetch(`https://api.air.inc/shorturl/${shortId}/clips/search`, {
    method: "post",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      limit: 24,
      type: "all",
      withOpenDiscussionStatus: true,
      filters: {
        board: {
          is: boardId,
        },
      },
      boardId,
      sortField: {
        direction: "desc",
        name: "dateModified",
      },
      descendantBoardId: boardId,
      cursor,
    }),
  }).then((r) => r.json());
