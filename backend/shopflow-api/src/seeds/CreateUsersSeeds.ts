import { DataSource } from "typeorm";
import { Users } from "../entity/Users.js";
import { Situations } from "../entity/Situations.js";
import bcrypt from 'bcryptjs';

export default class CreateUsersSeeds {
    public async run(dataSource: DataSource): Promise<void> {
        console.log("Iniciando o seed para a tabela 'users'...");

        const usersRepository = dataSource.getRepository(Users);
        const situationsRepository = dataSource.getRepository(Situations);

        // Verifica se já existem dados para não duplicar
        const existingCount = await usersRepository.count();
        if (existingCount > 0) {
            console.log("A tabela 'users' já possui dados. Nenhuma alteração foi realizada.");
            return;
        }

        const situations = await situationsRepository.find();

        if (situations.length === 0) {
            console.error("ERRO: Nenhuma situação encontrada. Rode o seed de situações primeiro.");
            return;
        }

        // Tenta pegar a situação "Ativo", senão pega a primeira que vier
        const situacaoAtivo = situations.find(s => s.nameSituation === "Ativo") || situations[0];

        // Hash de senhas para teste 
        const passwordAdmin = await bcrypt.hash("admin123", 8);
        const passwordUser = await bcrypt.hash("user123", 8);

        const users = [
            {
                name: "Administrador do Sistema",
                email: "admin@loja.com.br",
                password: passwordAdmin,
                situation: situacaoAtivo
            },
            {
                name: "Gerente de Vendas",
                email: "gerente@loja.com.br",
                password: passwordAdmin, 
                situation: situacaoAtivo
            },
            {
                name: "Cliente Exemplo Silva",
                email: "cliente@gmail.com",
                password: passwordUser,
                situation: situacaoAtivo
            }
        ];

        await usersRepository.save(users);

        console.log("Seed concluído: 3 usuários inseridos com sucesso.");
    }
}