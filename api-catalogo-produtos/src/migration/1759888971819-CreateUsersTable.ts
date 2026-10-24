import { Table, TableForeignKey, type MigrationInterface, type QueryRunner } from "typeorm";

export class CreateUsersTable1759888971819 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: "users",
            columns: [
                {
                    name: "id",
                    type: "int",
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: "increment"
                },
                {
                    name: "name",
                    type: "varchar",
                },
                {
                    name: "email",
                    type: "varchar",
                    isUnique: true,
                },
                {
                    name: "situationId", 
                    type: "int",
                    isNullable: true
                },
                {
                    name: "createdAt",
                    type: "timestamp",
                    default: "now()"
                },
                {
                    name: "updatedAt",
                    type: "timestamp",
                    default: "now()"
                }
            ]
        }));

        // Criando a chave estrangeira separadamente
        await queryRunner.createForeignKey(
            "users", 
            new TableForeignKey({
                columnNames: ["situationId"],
                referencedTableName: "situations",
                referencedColumnNames: ["id"],
                onDelete: "SET NULL", 
                onUpdate: "CASCADE"
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("users");
        const foreignKey = table?.foreignKeys.find(
            (fk) => fk.columnNames.indexOf("situationId") !== -1
        );
        if (foreignKey) {
            await queryRunner.dropForeignKey("users", foreignKey);
        }
        await queryRunner.dropTable("users");
    }
}