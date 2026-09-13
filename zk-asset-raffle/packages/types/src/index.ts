export type ApiStatus = "success" | "error";

export type ApiResponse = {
  status: ApiStatus;
  message?: string;
};

export type PrizeInput = {
  name: string;
  count: number;
};

export type PrizeWithWid = PrizeInput & {
  wid: number;
};

export type CreateActivityRequest = {
  name: string;
  total_items: number;
  prizes: PrizeInput[];
  creator_address?: string | null;
};

export type CreateActivityResponse = ApiResponse & {
  activity_id?: string;
  key?: string;
  prizes?: PrizeWithWid[];
  merkle_root?: string;
  creator_address?: string | null;
  message?: string;
};

export type ActivityStatusResponse = ApiResponse & {
  activity_id?: string;
  activity_status?: string;
};

export type ActivityListItem = {
  activity_id: string;
  name: string;
  total_items: number;
  status: string;
  prizes: PrizeWithWid[];
  creator_address?: string | null;
  created_at?: string | null;
};

export type ActivityListResponse = ApiResponse & {
  activities?: ActivityListItem[];
};

export type ActivityItem = {
  sid: string;
  r_i?: string | null;
  win_i?: number | null;
  leaf: string;
  proof: Array<{ position: "left" | "right"; data: string }> | null;
  encrypted_data: string;
};

export type ActivityItemsResponse = ApiResponse & {
  items?: ActivityItem[];
};

export type ActivityItemResponse = ApiResponse & {
  sid?: string;
  r_i?: string | null;
  win_i?: number | null;
  leaf?: string;
  proof?: Array<{ position: "left" | "right"; data: string }> | null;
};

export type RevealResponse = ApiResponse & {
  activity_id?: string;
  key?: string;
};
