export interface MenuResponse {
    id: number;
    name: string;
    caption: string;
    icon: string;
    url: string;
    parentId?: number;
    isVisible: boolean;
    sortOrder: number;
    children: MenuResponse[];
}
