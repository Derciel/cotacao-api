
export interface Route {
    id: number;
    name: string;
    coordinates: { latitude: number; longitude: number }[];
    expectedPath?: { latitude: number; longitude: number }[] | null;
    deviationThreshold: number; // in meters
    truckId: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface RouteCreationDto {
    name: string;
    coordinates: { latitude: number; longitude: number }[];
    expectedPath?: { latitude: number; longitude: number }[] | null;
    deviationThreshold?: number;
    truckId: number;
}

export interface RouteUpdateDto extends Partial<RouteCreationDto> {}
