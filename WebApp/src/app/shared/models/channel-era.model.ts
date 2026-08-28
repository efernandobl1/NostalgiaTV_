export interface ChannelEraRequest {
    name: string;
    description?: string;
    startDate: string;
    endDate?: string;
}

export interface ChannelBumperResponse {
    id: number;
    channelEraId: number;
    title: string;
    filePath?: string;
    order: number;
}

export interface ChannelEraResponse {
    id: number;
    channelId: number;
    channelName: string;
    name: string;
    description?: string;
    startDate: string;
    endDate?: string;
    folderPath?: string;
    seriesIds: number[];
    bumpers: ChannelBumperResponse[];
}

export interface AssignSeriesToEraRequest {
    seriesIds: number[];
}

export interface ChannelBumperRequest {
    title: string;
    file?: File;
    order: number;
}

export interface ScheduleEntry {
    id: number;
    channelId: number;
    episodeId?: number;
    episodeTitle: string;
    seriesName: string;
    seriesLogoPath?: string;
    filePath: string;
    startTime: string;
    endTime: string;
    season: number;
    episodeNumber: number;
    bumperId?: number;
    bumperTitle?: string;
}
