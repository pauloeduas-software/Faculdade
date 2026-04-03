import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Users } from "./Users.js"; 

@Entity("situations")
export class Situations { 
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({unique:true})
    nameSituation!: string; 

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
    
    @OneToMany(() => Users, (user) => user.situation)
    users!: Users[]; 
}