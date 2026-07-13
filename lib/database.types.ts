export const ENTRY_CATEGORIES = [
  "moment",
  "diary",
  "trip",
  "first",
  "milestone",
  "anniversary",
  "food",
  "watch",
] as const;

export type EntryCategory = (typeof ENTRY_CATEGORIES)[number];
export type MediaType = "image" | "video" | "audio";

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  color: string | null;
  theme: string | null;
  created_at: string;
};

export type Media = {
  id: string;
  entry_id: string;
  r2_key: string;
  thumbnail_r2_key: string | null;
  mime: string | null;
  type: MediaType;
  caption: string | null;
  sort_order: number;
  captured_at: string | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  sha256: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  display_url?: string;
};

export type Entry = {
  id: string;
  author_id: string;
  updated_by?: string | null;
  chapter_id?: string | null;
  category: EntryCategory;
  title: string | null;
  body: string | null;
  happened_at: string;
  happened_precision: string;
  place_id: string | null;
  mood: string | null;
  weather: string | null;
  rating: number | null;
  source: string;
  source_ref: string | null;
  is_highlight: boolean;
  created_at: string;
  updated_at: string;
  media?: Media[];
  profiles?: Pick<Profile, "display_name" | "avatar_url" | "color"> | null;
  updated_by_profile?: Pick<Profile, "display_name" | "avatar_url" | "color"> | null;
};

export type Relationship = {
  id: number;
  title: string | null;
  together_since: string | null;
  first_met_on: string | null;
  partner_a: string | null;
  partner_b: string | null;
  updated_at: string;
};

export type PresenceState = {
  user_id: string;
  current_path: string;
  page_title: string | null;
  last_seen_at: string;
  updated_at: string;
  profile?: Pick<Profile, "display_name" | "avatar_url" | "color"> | null;
};

export type FootprintEventType =
  | "message"
  | "reaction"
  | "summon"
  | "co_presence"
  | "visit";

export type FootprintScope = "site" | "page" | "entry" | "wishlist" | "place";

export type FootprintEvent = {
  id: string;
  author_id: string;
  event_type: FootprintEventType;
  scope: FootprintScope;
  page_path: string;
  page_title: string | null;
  target_type: string | null;
  target_id: string | null;
  body: string | null;
  reaction: string | null;
  created_at: string;
  profile?: Pick<Profile, "display_name" | "avatar_url" | "color"> | null;
};

export type CompanionMessage = {
  id: string;
  author_id: string;
  body: string;
  page_path: string | null;
  page_title: string | null;
  created_at: string;
  profile?: Pick<Profile, "display_name" | "avatar_url" | "color"> | null;
};

export type EntryFollowUp = {
  id: string;
  entry_id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  profile?: Pick<Profile, "display_name" | "avatar_url" | "color"> | null;
  replies?: EntryFollowUp[];
};

export type ActivityNotificationType =
  | "entry_created"
  | "entry_updated"
  | "follow_up_created"
  | "follow_up_replied";

export type ActivityNotification = {
  id: string;
  recipient_id: string;
  actor_id: string;
  type: ActivityNotificationType;
  entry_id: string | null;
  follow_up_id: string | null;
  title: string;
  body: string | null;
  href: string;
  read_at: string | null;
  created_at: string;
  actor?: Pick<Profile, "display_name" | "avatar_url" | "color"> | null;
};

export type ActivityEventKind =
  | "companion_message"
  | "page_message"
  | "reaction"
  | "summon"
  | "co_presence"
  | "visit"
  | "follow_up_created"
  | "follow_up_replied"
  | "entry_created"
  | "entry_updated";

export type ActivityStreamFilter =
  | "all"
  | "message"
  | "interaction"
  | "follow_up"
  | "entry";

export type ActivityStreamItem = {
  id: string;
  kind: ActivityEventKind;
  source_type: string;
  source_id: string;
  actor_id: string;
  entry_id: string | null;
  page_path: string | null;
  page_title: string | null;
  entry_title: string | null;
  body: string | null;
  reaction: string | null;
  created_at: string;
  profile?: Pick<Profile, "display_name" | "avatar_url" | "color"> | null;
};

export type PendingEntryAttentionItem = {
  id: string;
  type: ActivityNotificationType;
  actor_id: string;
  title: string;
  body: string | null;
  href: string;
  created_at: string;
  actor?: Pick<Profile, "display_name" | "avatar_url" | "color"> | null;
};

export type PendingEntryAttention = {
  entry_id: string;
  entry_title: string;
  href: string;
  latest_at: string;
  items: PendingEntryAttentionItem[];
};
