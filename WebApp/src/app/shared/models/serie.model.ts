export interface SeriesRequest {
    name: string;
    description?: string;
    history?: string;
    startDate: string;
    endDate?: string;
    rating?: number;
}

export interface SeriesResponse {
    id: number;
    name: string;
    description?: string;
    history?: string;
    startDate: string;
    endDate?: string;
    logoPath?: string;
    rating?: number;
    seasons?: number;
    folderPath?: string;
    categoryIds: number[];
    categoryNames?: string[];
    channelName?: string;
    episodeCount?: number;
}

export interface SeriesUploadResult {
    fileName: string;
    success: boolean;
    filePath?: string;
    error?: string;
}
