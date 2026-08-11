import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Truck } from './truck.entity.js';

@Entity({ name: 'systemsatx_routes' })
export class Route {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    name!: string;

    @Column({ type: 'json' })
    coordinates!: { latitude: number; longitude: number }[]; // Array of lat/lng points

    @Column({ type: 'json', nullable: true })
    expectedPath?: { latitude: number; longitude: number }[]; // Optional expected path for comparison

    @Column({ default: 100 }) // Default deviation threshold in meters
    deviationThreshold!: number;

    @ManyToOne(() => Truck)
    @JoinColumn({ name: 'truck_id' })
    truck!: Truck;

    @Column({ name: 'truck_id' })
    truckId!: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}