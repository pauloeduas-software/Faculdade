import { DataSource } from "typeorm";
import { ProductSituations } from "../entity/ProductSituations.js";

export default class CreateProductSituationsSeeds {
    public async run(dataSource: DataSource): Promise<void> {
        console.log("Iniciando o seed para a tabela 'product_situations'...");
        
        const repository = dataSource.getRepository(ProductSituations);
        const existingCount = await repository.count();
    
        if (existingCount > 0) {
            console.log("A tabela 'product_situations' já possui dados. Nenhuma alteração foi realizada.");
            return;
        }

        const situations = [
            { name: "Disponível" },      
            { name: "Esgotado" },        
            { name: "Pré-venda" },       
            { name: "Sob Encomenda" },   
            { name: "Descontinuado" }    
        ];

        await repository.save(situations);

        console.log("Seed concluído: situações de produto cadastradas.");
    }
}