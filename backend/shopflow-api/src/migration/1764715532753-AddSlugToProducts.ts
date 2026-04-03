import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddSlugToProducts1764715532753 implements MigrationInterface { 
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Adiciona SLUG
        await queryRunner.addColumn("products", new TableColumn({
            name: "slug",
            type: "varchar",
            isNullable: true 
        }));

        // 2. Adiciona DESCRIPTION (Usei 'text' para suportar textos longos)
        await queryRunner.addColumn("products", new TableColumn({
            name: "description",
            type: "text", // No diagrama está LONGTEXT, no Postgres/TypeORM usamos text
            isNullable: true
        }));

        // 3. Adiciona PRICE (Decimal com precisão, ex: 10,2)
        await queryRunner.addColumn("products", new TableColumn({
            name: "price",
            type: "decimal",
            precision: 10,
            scale: 2,
            isNullable: true
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("products", "price");
        await queryRunner.dropColumn("products", "description");
        await queryRunner.dropColumn("products", "slug");
    }
}