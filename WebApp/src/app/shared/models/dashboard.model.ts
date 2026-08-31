export interface ActivityResponse {
  id: number;
  username: string;
  action: 'create' | 'edit' | 'delete' | string;
  resource: string;
  description: string;
  createdAtUtc: string;
}

export interface DashboardSummaryResponse {
  seriesCount: number;
  episodeCount: number;
  missingEpisodeFiles: number;
  activeChannelCount: number;
  eraCount: number;
  userCount: number;
  incompleteSeriesCount: number;
  latestActivity: ActivityResponse[];
}
