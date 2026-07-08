export type ReviewStatus = "draft" | "approved" | "rejected" | "paused";
export type PublicationStatus = "pending" | "published";
export type PrivacyLevel = "exact" | "approximate" | "private";

export type LocationPoint = {
  latitude: number;
  longitude: number;
};

export type Chapter = {
  id: string;
  kind: "trip" | "day" | string;
  title: string;
  summary: string;
  startAt: string;
  endAt: string;
  source: string;
};

export type ReviewMedia = {
  kind: string;
  sourcePath: string;
  exists: boolean;
  blocked: boolean;
};

export type NormalizedMessage = {
  id: string;
  localId: number;
  sentAt: string;
  sortSeq: string;
  senderRole: "self" | "partner" | "system";
  senderDisplayName: string;
  renderType: string;
  content: string;
  quote: {
    sourceServerId: string;
    title: string;
    content: string;
  } | null;
  voiceDurationMs: number | null;
  media: ReviewMedia[];
};

export type ReviewCandidate = {
  id: string;
  sourceType: "photo" | "chat" | "mixed";
  sourceRef: string;
  chapterId: string;
  title: string;
  summary: string;
  category: string;
  startAt: string;
  endAt: string;
  score: number;
  classification: "event" | "unclassified";
  status: ReviewStatus;
  messageIds: string[];
  selectedMessageIds: string[];
  mediaPaths: string[];
  selectedMediaPaths: string[];
  coverPath: string | null;
  placeName: string;
  privacyLevel: PrivacyLevel;
  precisionM: number;
  location: LocationPoint | null;
  rawLocation: LocationPoint | null;
  keywords?: string[];
  meaningfulMessageCount?: number;
  createdFrom: string;
  reviewNotes?: string;
  replaces?: string[];
  revision?: number;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  lastEditedBy?: string | null;
  lastEditedAt?: string | null;
  publicationStatus?: PublicationStatus;
  publishedEntryId?: string | null;
  publishedAt?: string | null;
};

export type PhotoAsset = {
  id: string;
  sourcePath: string;
  fileName: string;
  sha256: string;
  perceptualHash: string;
  exactDuplicateOf: string | null;
  nearDuplicateOf: string | null;
  capturedAt: string;
  width: number;
  height: number;
  bytes: number;
  mime: string;
  rawLocation: LocationPoint | null;
};

export type CandidateSummary = Omit<
  ReviewCandidate,
  "messageIds" | "selectedMessageIds" | "mediaPaths" | "selectedMediaPaths"
> & {
  messageCount: number;
  selectedMessageCount: number;
  mediaCount: number;
  selectedMediaCount: number;
};

export type ReviewOverview = {
  stats: Record<string, unknown>;
  chapters: Chapter[];
  candidates: CandidateSummary[];
};

export type CandidateDetail = {
  candidate: ReviewCandidate;
  messages: NormalizedMessage[];
  photos: PhotoAsset[];
};

export type CandidatePatch = Partial<
  Pick<
    ReviewCandidate,
    | "chapterId"
    | "title"
    | "summary"
    | "category"
    | "startAt"
    | "endAt"
    | "status"
    | "selectedMessageIds"
    | "selectedMediaPaths"
    | "coverPath"
    | "placeName"
    | "privacyLevel"
    | "reviewNotes"
  >
> & {
  revision?: number;
};
