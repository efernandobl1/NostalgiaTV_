export interface RolRequest {
    name: string;
    description: string;
    menuIds: number[];
}

export interface RolResponse {
    id: number;
    name: string;
    description: string;
    menuIds: number[];
}
