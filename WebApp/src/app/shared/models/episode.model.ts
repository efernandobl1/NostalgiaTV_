export interface UpdateEpisodeRequest {
    title?: string;
    episodeNumber: number;
    episodeTypeId: number;
}

export interface EpisodeResponse {
    id: number;
    title: string;
    filePath?: string;
    season: number;
    episodeNumber: number;
    episodeTypeId: number;
    episodeTypeName: string;
    seriesId: number;
}
