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

export interface SeriesStorage {
  id: number;
  name: string;
  episodeCount: number;
  missingEpisodeCount: number;
  sizeBytes: number | null;
}

export interface StorageResponse {
  measuredAtUtc: string;
  libraryBytes: number | null;
  totalBytes: number | null;
  usedBytes: number | null;
  availableBytes: number | null;
  series: SeriesStorage[];
}
