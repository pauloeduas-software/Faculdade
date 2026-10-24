import { Table, TableForeignKey, type MigrationInterface, type QueryRunner } from "typeorm";

export class CreateProductTables1759981547860 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Criar a tabela product_categories
        await queryRunner.createTable(new Table({
            name: "product_categories",
            columns: [
                { name: "id", type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
                { name: "name", type: "varchar" },
                { name: "createdAt", type: "timestamp", default: "now()" },
                { name: "updatedAt", type: "timestamp", default: "now()" }
            ]
        }));

        // 2. Criar a tabela product_situations
        await queryRunner.createTable(new Table({
            name: "product_situations",
            columns: [
                { name: "id", type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
                { name: "name", type: "varchar" },
                { name: "createdAt", type: "timestamp", default: "now()" },
                { name: "updatedAt", type: "timestamp", default: "now()" }
            ]
        }));

        // 3. Criar a tabela products
        await queryRunner.createTable(new Table({
            name: "products",
            columns: [
                { name: "id", type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
                { name: "name", type: "varchar" },
                { name: "productCategoryId", type: "int" },
                { name: "productSituationId", type: "int" },
                { name: "createdAt", type: "timestamp", default: "now()" },
                { name: "updatedAt", type: "timestamp", default: "now()" }
            ]
        }));

        // 4. Criar as chaves estrangeiras para a tabela products
        await queryRunner.createForeignKey("products", new TableForeignKey({
            columnNames: ["productCategoryId"],
            referencedColumnNames: ["id"],
            referencedTableName: "product_categories",
            onDelete: "RESTRICT",
            onUpdate: "CASCADE"
        }));

        await queryRunner.createForeignKey("products", new TableForeignKey({
            columnNames: ["productSituationId"],
            referencedColumnNames: ["id"],
            referencedTableName: "product_situations",
            onDelete: "RESTRICT",
            onUpdate: "CASCADE"
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("products");
        
        const foreignKeyCategory = table!.foreignKeys.find(fk => fk.columnNames.indexOf("productCategoryId") !== -1);
        if (foreignKeyCategory) {
            await queryRunner.dropForeignKey("products", foreignKeyCategory);
        }

        const foreignKeySituation = table!.foreignKeys.find(fk => fk.columnNames.indexOf("productSituationId") !== -1);
        if (foreignKeySituation) {
            await queryRunner.dropForeignKey("products", foreignKeySituation);
        }

        await queryRunner.dropTable("products");
        await queryRunner.dropTable("product_situations");
        await queryRunner.dropTable("product_categories");
    }
}