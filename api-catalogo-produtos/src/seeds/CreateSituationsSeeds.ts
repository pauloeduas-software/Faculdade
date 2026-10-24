import { DataSource } from "typeorm";
import { Situations } from "../entity/Situations.js";

export default class CreateSituationsSeeds {

    public async run(dataSource: DataSource): Promise<void> {
        console.log("Iniciando o seed para a tabela 'situations'...");
        
        const situationsRepository = dataSource.getRepository(Situations);
        const existingCount = await situationsRepository.count();
    
        if (existingCount > 0) {
            console.log("A tabela 'situations' já possui dados. Nenhuma alteração foi realizada.");
            return;
        }

        const situations = [
            { nameSituation: "Ativo" },      
            { nameSituation: "Inativo" },    
            { nameSituation: "Pendente" },   
            { nameSituation: "Bloqueado" }   
        ];

        await situationsRepository.save(situations);

        console.log("Seed concluído: situações de usuário cadastradas.");
    }
}