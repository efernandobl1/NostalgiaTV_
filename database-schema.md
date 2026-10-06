# NostalgiaTV database schema

This diagram reflects the EF Core model and migrations on `develop` before the normalization change. It does not assert that a running VPS database has the same schema or data.

## Current model

```mermaid
erDiagram
    Roles {
        int Id PK
        string Name
        string Description
    }
    Users {
        int Id PK
        string Username
        string PasswordHash
        int RolId FK
    }
    RefreshTokens {
        int Id PK
        int UserId FK
        string Token
        string IpAddress
        datetime CreatedAt
        datetime ExpiresAt
        datetime RevokedAt
        string ReplacedByToken
    }
    Menus {
        int Id PK
        int ParentId FK
        string Name
        string Caption
        string Icon
        string Url
        bool IsVisible
        int SortOrder
    }
    MenuRol {
        int MenusId PK, FK
        int RolesId PK, FK
    }
    ActivityLogs {
        long Id PK
        int UserId
        string Username
        string Action
        string Resource
        string Description
        datetime CreatedAtUtc
    }
    Series {
        int Id PK
        string Name
        string Description
        string History
        date StartDate
        date EndDate
        string LogoPath
        float Rating
        int Seasons
        string FolderPath
    }
    Categories {
        int Id PK
        string Name
    }
    SeriesCategories {
        int CategoriesId PK, FK
        int SeriesId PK, FK
    }
    EpisodeTypes {
        int Id PK
        string Name
    }
    Episodes {
        int Id PK
        int SeriesId FK
        int EpisodeTypeId FK
        int Season
        int EpisodeNumber
        string Title
        string FilePath
    }
    Channels {
        int Id PK
        string Name
        string LogoPath
        string History
        datetime StartDate
        datetime EndDate
    }
    ChannelSeries {
        int ChannelsId PK, FK
        int SeriesId PK, FK
    }
    ChannelEras {
        int Id PK
        int ChannelId FK
        string Name
        string Description
        datetime StartDate
        datetime EndDate
        string FolderPath
        string SeriesSeasonsJson
    }
    ChannelEraSeries {
        int ChannelErasId PK, FK
        int SeriesId PK, FK
    }
    ChannelBumpers {
        int Id PK
        int ChannelEraId FK
        string Title
        string FilePath
        int Order
    }
    ChannelScheduleEntries {
        int Id PK
        int ChannelId FK
        int EpisodeId FK
        int BumperId FK
        datetime StartTime
        datetime EndTime
    }
    ChannelStates {
        int Id PK
        int ChannelId FK
        int CurrentEpisodeId FK
        float CurrentSecond
        datetime LastUpdated
    }

    Roles ||--o{ Users : assigns
    Users ||--o{ RefreshTokens : owns
    Roles ||--o{ MenuRol : grants
    Menus ||--o{ MenuRol : appears_in
    Menus o|--o{ Menus : parent_of
    Series ||--o{ SeriesCategories : classified_by
    Categories ||--o{ SeriesCategories : classifies
    Series ||--o{ Episodes : contains
    EpisodeTypes ||--o{ Episodes : types
    Channels ||--o{ ChannelSeries : carries
    Series ||--o{ ChannelSeries : airs_on
    Channels ||--o{ ChannelEras : has
    ChannelEras ||--o{ ChannelEraSeries : assigns
    Series ||--o{ ChannelEraSeries : appears_in
    ChannelEras ||--o{ ChannelBumpers : contains
    Channels ||--o{ ChannelScheduleEntries : schedules
    Episodes o|--o{ ChannelScheduleEntries : scheduled_as
    ChannelBumpers o|--o{ ChannelScheduleEntries : scheduled_as
    Channels ||--o| ChannelStates : has
    Episodes ||--o{ ChannelStates : currently_playing
```

`ActivityLogs.UserId` is not an EF foreign key. Its `Username` is a historical audit snapshot, so it should not be removed merely because `Users.Username` exists.

## Normalized era-season selection

Only this fragment changes; every other relationship above remains intact.

```mermaid
erDiagram
    ChannelEras {
        int Id PK
        int ChannelId FK
        string Name
        datetime StartDate
        datetime EndDate
    }
    Series {
        int Id PK
        string Name
    }
    ChannelEraSeries {
        int ChannelErasId PK, FK
        int SeriesId PK, FK
        bool HasSeasonFilter
    }
    ChannelEraSelectedSeasons {
        int ChannelErasId PK, FK
        int SeriesId PK, FK
        int SeasonNumber PK
    }

    ChannelEras ||--o{ ChannelEraSeries : assigns
    Series ||--o{ ChannelEraSeries : assigned_to
    ChannelEraSeries ||--o{ ChannelEraSelectedSeasons : selects
```

`HasSeasonFilter = false` means all seasons. `HasSeasonFilter = true` with no season rows means no seasons. With season rows, only those seasons are allowed. The composite key prevents duplicate season selections, and the composite foreign key prevents selections for an unassigned series.

The JSON-to-row change removes the confirmed multivalued attribute from `ChannelEras`. Existing independent many-to-many facts already use junction tables. A blanket 5NF claim would require verified business join dependencies, not just an EF model.

## Proposed platform model (not implemented)

The following is a future-state design. It does not describe the current database or a pending migration.

### Catalog, public metadata, and comments

```mermaid
erDiagram
    Users {
        int Id PK
        string Username
    }
    Series {
        int Id PK
        string Name
        string Description
        string History
        date StartDate
        date EndDate
        string LogoPath
        float Rating
        int Seasons
    }
    Categories {
        int Id PK
        string Name
    }
    SeriesCategories {
        int SeriesId PK, FK
        int CategoryId PK, FK
    }
    Episodes {
        int Id PK
        int SeriesId FK
        int Season
        int EpisodeNumber
        string Title
        string FilePath
    }
    MetadataProviders {
        int Id PK
        string Code UK
        string Name
    }
    SeriesExternalIds {
        int Id PK
        int SeriesId FK
        int ProviderId FK
        string ExternalId
    }
    MetadataImportRuns {
        long Id PK
        int SeriesExternalId FK
        string LanguageCode
        string Status
        datetime StartedAtUtc
        datetime FinishedAtUtc
    }
    SeriesComments {
        long Id PK
        int SeriesId FK
        int UserId FK
        long ParentCommentId FK
        string Body
        string Status
        datetime CreatedAtUtc
        datetime EditedAtUtc
    }

    Series ||--o{ Episodes : contains
    Series ||--o{ SeriesCategories : classified_by
    Categories ||--o{ SeriesCategories : classifies
    MetadataProviders ||--o{ SeriesExternalIds : identifies
    Series ||--o{ SeriesExternalIds : mapped_to
    SeriesExternalIds ||--o{ MetadataImportRuns : imported_through
    Users ||--o{ SeriesComments : writes
    Series ||--o{ SeriesComments : receives
    SeriesComments o|--o{ SeriesComments : replies_to
```

`Series` remains the local canonical record. `SeriesExternalIds` has a unique `(ProviderId, ExternalId)` pair, so imports match existing series rather than creating duplicates. An import run records provenance and status; API credentials stay outside the database. Imported fields should be reviewed before replacing local edits. Replies must reference a comment on the same series; public comments require moderation and rate limiting.

### Retro channels and broadcast playback

```mermaid
erDiagram
    Channels {
        int Id PK
        string Name
    }
    ChannelEras {
        int Id PK
        int ChannelId FK
        string Name
        date HistoricalStartDate
        date HistoricalEndDate
    }
    ChannelEraSelections {
        int ChannelId PK, FK
        int ChannelEraId FK
        datetime SelectedAtUtc
    }
    Series {
        int Id PK
        string Name
    }
    ChannelEraSeries {
        int ChannelErasId PK, FK
        int SeriesId PK, FK
        bool HasSeasonFilter
    }
    ChannelEraSelectedSeasons {
        int ChannelErasId PK, FK
        int SeriesId PK, FK
        int SeasonNumber PK
    }
    Episodes {
        int Id PK
        int SeriesId FK
        int Season
        int EpisodeNumber
        string FilePath
    }
    EpisodeBreakPoints {
        int Id PK
        int EpisodeId FK
        int OffsetSeconds
        string Label
    }
    Interludes {
        int Id PK
        string Kind
        string Title
        string FilePath
        int DurationSeconds
        int OriginalYearFrom
        int OriginalYearTo
        string RegionCode
        bool ApprovedForBroadcast
    }
    ChannelEraInterludes {
        int ChannelEraId PK, FK
        int InterludeId PK, FK
        string Role PK
        int Weight
        int MinimumGapSeconds
    }
    ChannelEraBreakRules {
        int ChannelEraId PK, FK
        int MinimumAds
        int MaximumAds
        int MaximumBreakSeconds
    }
    ScheduledPrograms {
        long Id PK
        int ChannelEraId FK
        int EpisodeId FK
        datetime GeneratedAtUtc
    }
    ScheduledAdBreaks {
        long Id PK
        long ScheduledProgramId FK
        int EpisodeBreakPointId FK
        int Ordinal
    }
    ScheduledPlaybackSegments {
        long Id PK
        long ScheduledProgramId FK
        long ScheduledAdBreakId FK
        int InterludeId FK
        int Sequence
        datetime StartsAtUtc
        datetime EndsAtUtc
        float MediaStartSecond
        float MediaEndSecond
    }

    Channels ||--o{ ChannelEras : has
    Channels ||--o| ChannelEraSelections : selects_active_era
    ChannelEras ||--o| ChannelEraSelections : selected_by
    ChannelEras ||--o{ ChannelEraSeries : assigns
    Series ||--o{ ChannelEraSeries : appears_in
    ChannelEraSeries ||--o{ ChannelEraSelectedSeasons : selects
    Series ||--o{ Episodes : contains
    Episodes ||--o{ EpisodeBreakPoints : permits_break_at
    ChannelEras ||--o{ ChannelEraInterludes : permits
    Interludes ||--o{ ChannelEraInterludes : assigned_to
    ChannelEras ||--o| ChannelEraBreakRules : configures
    ChannelEras ||--o{ ScheduledPrograms : generates
    Episodes ||--o{ ScheduledPrograms : airs
    ScheduledPrograms ||--o{ ScheduledAdBreaks : interrupts
    EpisodeBreakPoints ||--o{ ScheduledAdBreaks : used_at
    ScheduledPrograms ||--|{ ScheduledPlaybackSegments : plays_as
    ScheduledAdBreaks o|--o{ ScheduledPlaybackSegments : contains
    Interludes o|--o{ ScheduledPlaybackSegments : provides_clip
```

An era is the channel's historical editorial identity (for example, a City or Check It period), including its series, selected seasons, and matching clips. `HistoricalStartDate` and `HistoricalEndDate` describe the original period; they do not activate it. `ChannelEraSelections` explicitly chooses one active era per channel, and its composite `(ChannelId, ChannelEraId)` foreign key must ensure the selected era belongs to that channel.

`EpisodeBreakPoints` records safe offsets within an episode. A generated airing is one `ScheduledProgram` with ordered `ScheduledPlaybackSegments`; each episode segment stores its source-media start and end offsets. `ScheduledAdBreaks` groups the clips inserted at a chosen break point. `ChannelEraInterludes.Role` is `BreakOpener`, `Advertisement`, or `BreakCloser`; the same clip may be eligible in multiple eras and roles. `ChannelEraBreakRules` controls the ad count and maximum break length. Only approved clips eligible for the selected era may be scheduled.

Example: episode 0–600 s → opening bumper → one or more ads → closing bumper → same episode 600 s–end. The generated UTC segment times form one continuous, non-overlapping channel timeline shared by all viewers; playback resumes at each episode segment's `MediaStartSecond`. A scheduled break must belong to the same program and refer to a break point of that program's episode. Its ordered clips must contain exactly one opener, at least the configured minimum number of ads, and exactly one closer. Each segment is either an episode range (no interlude or ad-break ID) or an interlude in an ad break (both IDs present and no episode offsets). Enforce row-local ranges with checks and cross-row sequence/eligibility in generation plus validation before publishing a schedule.

The current broadcast position is derivable from the active segment and UTC time, so no persistent playback-state table is proposed without a separate requirement. Migration must preserve existing schedules and explicitly select eras; the current `ChannelSeries` fallback and `ChannelBumpers` need mapping before retirement. This model remains proposed only: the current API does not yet split episodes or generate ad breaks.
