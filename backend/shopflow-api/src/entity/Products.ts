import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, type Relation } from "typeorm";
import { ProductCategories } from "./ProductCategories.js";
import { ProductSituations } from "./ProductSituations.js";

@Entity("products")
export class Products {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    name!: string;

    @Column({ nullable: true })
    slug!: string;

    @Column({ type: 'text', nullable: true })
    description!: string;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    price!: number;

    @Column()
    productSituationId!: number;

    @Column()
    productCategoryId!: number;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @ManyToOne(() => ProductCategories, (category) => category.products)
    @JoinColumn({ name: "productCategoryId" })
    productCategory!: Relation<ProductCategories>;

    @ManyToOne(() => ProductSituations, (situation) => situation.products)
    @JoinColumn({ name: "productSituationId" })
    productSituation!: Relation<ProductSituations>;
}