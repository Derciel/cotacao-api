
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'systemsatx_trucks' })
export class Truck {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unique: true })
    licensePlate!: string;

    @Column()
    model!: string;

    @Column()
    year!: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
