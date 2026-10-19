/** TypeScript mirror of the API v2 DTOs (ApplicationCore/DTOs, camelCase JSON). */

export interface Paged<T> { items: T[]; totalCount: number; page: number; pageSize: number }
export interface IdName { id: number; name: string }

// ── Account ──
export interface MenuNode { id: number; name: string; caption: string; icon: string; url: string; sortOrder: number; children: MenuNode[] }
export interface Me { id: number; username: string; role: string; canUseDashboard: boolean; hasPassword: boolean; externalLogins: string[]; menus: MenuNode[] }
export interface ServerInfo { product: string; apiVersion: number; deviceAuthorizationVersion: number; registrationEnabled: boolean; googleEnabled: boolean }
export interface PublicSettings { timeZoneId: string; season: 'AllYear' | 'Halloween' | 'Christmas'; seasonalThemesEnabled: boolean; seasonalEffectsEnabled: boolean; registrationEnabled: boolean }

// ── Schedule and channels ──
export interface NowPlaying { segmentId: number; kind: string; episodeId: number | null; seriesId: number | null; seriesName: string | null; title: string; seasonNumber: number | null; episodeNumber: number | null; startsAtUtc: string; endsAtUtc: string; progress: number; episodePart: string | null }
export interface GuideSlot { programId: number; episodeId: number; seriesId: number; seriesName: string; title: string; seasonNumber: number; episodeNumber: number; episodeType: string; isSpecial: boolean; isNow: boolean; startsAtUtc: string; endsAtUtc: string; episodePart: string | null }
export interface GuideRow { channelId: number; channelName: string; logoPath: string | null; slots: GuideSlot[] }
export interface ScheduleSegment { id: number; kind: string; interludeId: number | null; title: string; startsAtUtc: string; endsAtUtc: string; mediaStartSecond: number | null; mediaEndSecond: number | null; inAdBreak: boolean }
export interface ScheduleProgram { id: number; episodeId: number; seriesId: number; seriesName: string; title: string; seasonNumber: number; episodeNumber: number; episodeType: string; startsAtUtc: string; endsAtUtc: string; segments: ScheduleSegment[]; episodePart: string | null }
export interface ChannelState { channelId: number; segmentId: number; kind: string; episodeId: number | null; seriesId: number | null; seriesName: string | null; seriesLogoPath: string | null; title: string; seasonNumber: number | null; episodeNumber: number | null; filePath: string; mediaStartSecond: number; currentSecond: number; secondsUntilNext: number; nextTitle: string | null; startsAtUtc: string; endsAtUtc: string; episodePart: string | null }
export interface PublicChannelCard { id: number; shareId: string; name: string; logoPath: string | null; eraName: string | null; onAir: boolean; categories: string[]; now: NowPlaying | null; next: GuideSlot | null }
export interface PublicEraSeries { seriesId: number; name: string; logoPath: string | null; seasons: number[] }
export interface PublicEra { id: number; name: string; description: string | null; historicalStartDate: string; historicalEndDate: string | null; isActive: boolean; series: PublicEraSeries[] }
export interface PublicChannelDetail { id: number; shareId: string; name: string; history: string | null; logoPath: string | null; startDate: string; endDate: string | null; activeEraId: number | null; eras: PublicEra[]; upcoming: GuideSlot[]; commentCount: number }

// ── Catalog ──
export interface OnAirChannel { channelId: number; channelName: string }
export interface PublicSeriesCard { id: number; name: string; logoPath: string | null; startYear: number; endYear: number | null; rating: number | null; categories: string[]; onAir: OnAirChannel[]; seasonCount: number; episodeCount: number }
export interface PublicSeriesDetail { id: number; name: string; description: string | null; history: string | null; logoPath: string | null; startDate: string; endDate: string | null; rating: number | null; categories: string[]; seasons: number[]; onAir: OnAirChannel[]; commentCount: number }
export interface PublicEpisode { id: number; seasonNumber: number; episodeNumber: number; episodeType: string; title: string; filePath: string; episodePart: string | null }
export interface CategoryFacet { id: number; name: string; seriesCount: number }

// ── Community ──
export interface PublicComment { id: number; parentCommentId: number | null; author: string; body: string; createdAtUtc: string; editedAtUtc: string | null }
export interface CommentPosted { id: number; status: string }
export interface MyComment { id: number; targetType: 'channel' | 'series'; targetId: number; targetName: string; body: string; status: string; createdAtUtc: string; editedAtUtc: string | null }

// ── Viewer ──
export interface ViewerDevice { id: string; name: string; lastSeenUtc: string; expiresAtUtc: string; current: boolean }
export interface ProgressItem { seriesId: number; seriesName: string; episodeId: number; episodeTitle: string; seasonNumber: number; episodeNumber: number; currentSecond: number; completed: boolean; updatedAtUtc: string; episodePart: string | null }
export interface ViewerSession { profileId: string; accountLinked: boolean; username: string | null; devices: ViewerDevice[]; progress: ProgressItem[] }
export interface DeviceAuthorizationInfo { name: string; expiresAtUtc: string }
export interface DeviceAuthorizationStart { deviceCode: string; userCode: string; expiresAtUtc: string; intervalSeconds: number }

// ── Admin ──
export interface ActivityItem { id: number; createdAtUtc: string; userId: number | null; user: string; action: string; resource: string; description: string }
export interface BreakRule { minimumAds: number; maximumAds: number; maximumBreakSeconds: number }
export interface EraItem { id: number; channelId: number; name: string; description: string | null; historicalStartDate: string; historicalEndDate: string | null; isActive: boolean; seriesCount: number; interludeCount: number; breakRule: BreakRule | null }
export interface ChannelListItem { id: number; shareId: string; name: string; logoPath: string | null; startDate: string; endDate: string | null; activeEraId: number | null; activeEraName: string | null; eraCount: number; seriesCount: number; now: NowPlaying | null }
export interface ChannelDetail { id: number; shareId: string; name: string; history: string | null; logoPath: string | null; startDate: string; endDate: string | null; activeEraId: number | null; eras: EraItem[] }
export interface EraSeriesItem { seriesId: number; name: string; availableSeasons: number[]; seasons: number[]; episodeCount: number }
export interface EraInterludeItem { interludeId: number; title: string; kind: string; bumperType: string | null; season: string; durationSeconds: number; approvedForBroadcast: boolean; weight: number; minimumGapSeconds: number; seriesId: number | null; seriesName: string | null }
export interface DashboardSummary { seriesCount: number; episodeCount: number; missingEpisodeFiles: number; channelCount: number; liveChannelCount: number; eraCount: number; userCount: number; activeDevices: number; pendingComments: number; queuedMediaJobs: number; failedMediaJobs: number; channels: ChannelListItem[]; latestActivity: ActivityItem[] }
export interface SeasonSummary { seasonNumber: number; episodeCount: number; missingCount: number }
export interface ExternalIdItem { providerId: number; providerCode: string; providerName: string; externalId: string }
export interface SeriesListItem { id: number; name: string; logoPath: string | null; startDate: string; endDate: string | null; rating: number | null; categories: IdName[]; seasons: number[]; episodeCount: number; missingEpisodeCount: number; onAirChannelCount: number }
export interface SeriesDetail { id: number; name: string; description: string | null; history: string | null; logoPath: string | null; folderPath: string | null; rating: number | null; startDate: string; endDate: string | null; categories: IdName[]; seasons: SeasonSummary[]; externalIds: ExternalIdItem[] }
export interface EpisodeItem { id: number; seriesId: number; seasonNumber: number; episodeNumber: number; episodeTypeId: number; episodeType: string; title: string; filePath: string | null; isAvailable: boolean; fileSizeBytes: number | null; breakPointCount: number; episodePart: string | null }
export interface BreakPointItem { id: number; episodeId: number; offsetSeconds: number; label: string | null }
export interface EpisodeUploadResult { fileName: string; success: boolean; message: string | null; episodeId: number | null }
export interface ScanResult { imported: number; markedMissing: number; pending: number }
export interface MetadataImportResult { runId: number; status: string; updatedEpisodes: number; message: string | null }
export interface InterludeItem { id: number; title: string; kind: string; bumperType: string | null; season: string; filePath: string; durationSeconds: number; approvedForBroadcast: boolean; redistributionAllowed: boolean; license: string | null; sourceUrl: string | null; regionCode: string | null; originalYearFrom: number | null; originalYearTo: number | null; eraCount: number }
export interface ViewerKpis { profiles: number; linkedProfiles: number; activeDevices: number; watchingNow: number; episodesCompleted7d: number; pendingAuthorizations: number }
export interface ViewerProfileItem { id: string; username: string | null; createdAtUtc: string; deviceCount: number; episodesStarted: number; episodesCompleted: number; lastSeenUtc: string | null }
export interface ViewerProfileDetail { id: string; username: string | null; createdAtUtc: string; devices: ViewerDevice[]; progress: ProgressItem[] }
export interface PendingAuthorizationItem { name: string; expiresAtUtc: string; approved: boolean; username: string | null }
export interface ModerationItem { id: number; targetType: string; targetId: number; targetName: string; parentCommentId: number | null; userId: number; author: string; body: string; status: string; createdAtUtc: string }
export interface ModerationPage { items: ModerationItem[]; totalCount: number; page: number; pageSize: number; counts: Record<string, number> }
export interface MediaWorkerItem { id: string; enabled: boolean; heartbeatUtc: string | null; online: boolean }
export interface ResourcePolicy { dayCores: number; nightCores: number; nightEnabled: boolean; nightStartMinute: number; nightEndMinute: number; timeZoneId: string; availableCores: number; currentCores: number; nightNow: boolean }
export interface MediaJobItem { id: number; worker: string; seriesId: number; seriesName: string; status: string; progress: number; sourcePath: string; outputPath: string | null; sourceSize: number; message: string | null; createdAtUtc: string; updatedAtUtc: string }
export interface MediaStatus { workers: MediaWorkerItem[]; resources: ResourcePolicy; counts: Record<string, number>; jobs: MediaJobItem[]; totalJobs: number; page: number; pageSize: number }
export interface SeriesStorage { seriesId: number; name: string; episodeCount: number; missingEpisodeCount: number; sizeBytes: number | null }
export interface StorageReport { measuredAtUtc: string; libraryBytes: number | null; totalBytes: number | null; availableBytes: number | null; series: SeriesStorage[] }
export interface UserListItem { id: number; username: string; roleId: number; role: string; externalLogins: string[]; failedLoginAttempts: number; lockedUntilUtc: string | null; activeSessions: number }
export interface RoleListItem { id: number; name: string; description: string; isViewerRole: boolean; isAdministrator: boolean; userCount: number; menuIds: number[] }
export interface MenuItem { id: number; parentId: number | null; name: string; caption: string; icon: string; url: string; sortOrder: number; isVisible: boolean }
export interface PlatformSettings { timeZoneId: string; viewerRoleId: number; publicRegistrationEnabled: boolean; noRepeatWindowHours: number; maxSpecialsPerDay: number; maxSpecialsPerSeriesPerDay: number; maxMoviesPerDay: number; maxMoviesPerSeriesPerDay: number; seasonalEffectsEnabled: boolean; seasonalEpisodesEnabled: boolean; seasonalInterludesEnabled: boolean; seasonalThemesEnabled: boolean }
export interface CatalogItem { id: number; name: string; usageCount: number }
export interface MetadataProviderItem { id: number; code: string; name: string; seriesCount: number }
