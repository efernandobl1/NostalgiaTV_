export interface UserRequest {
    username: string;
    password: string;
    rolId: number;
}

export interface UserResponse {
    id: number;
    username: string;
    rol: { id: number; name: string; description: string };
}
