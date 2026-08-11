
export interface Truck {
    id: number;
    licensePlate: string;
    model: string;
    year: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface TruckCreationDto {
    licensePlate: string;
    model: string;
    year: number;
}

export interface TruckUpdateDto extends Partial<TruckCreationDto> {}
