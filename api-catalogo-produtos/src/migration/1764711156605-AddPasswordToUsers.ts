import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddPasswordToUsers1764711156605 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Adiciona a coluna 'password'
        await queryRunner.addColumn("users", new TableColumn({
            name: "password",
            type: "varchar",
            isNullable: true 
        }));

        // 2. Adiciona a coluna 'recoverPassword'
        await queryRunner.addColumn("users", new TableColumn({
            name: "recoverPassword",
            type: "varchar",
            isNullable: true
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove as colunas na ordem inversa caso precise desfazer a migration
        await queryRunner.dropColumn("users", "recoverPassword");
        await queryRunner.dropColumn("users", "password");
    }

}