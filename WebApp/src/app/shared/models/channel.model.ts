export interface ChannelRequest {
    name: string;
    logo?: string;
    history?: string;
    startDate: string;
    endDate?: string;
}

export interface ChannelBumperDto {
    id: number;
    channelEraId: number;
    title: string;
    filePath?: string;
    order: number;
}

export interface ChannelEraDto {
    id: number;
    channelId: number;
    channelName: string;
    name: string;
    description?: string;
    startDate: string;
    endDate?: string;
    folderPath?: string;
    seriesIds: number[];
    bumpers: ChannelBumperDto[];
}

export interface ChannelResponse {
    id: number;
    name: string;
    logoPath: string;
    history?: string;
    startDate: string;
    endDate?: string;
    seriesIds: number[];
    eras: ChannelEraDto[];
}

export interface AssignSeriesRequest {
    seriesIds: number[];
}
