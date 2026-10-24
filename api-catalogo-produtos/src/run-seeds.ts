import { AppDataSource } from "./data-source.js";
import CreateSituationsSeeds from "./seeds/CreateSituationsSeeds.js";
import CreateProductCategoriesSeeds from "./seeds/CreateProductCategoriesSeeds.js";
import CreateProductSituationsSeeds from "./seeds/CreateProductSituationsSeeds.js";
import CreateProductsSeeds from "./seeds/CreateProductsSeeds.js";
import CreateUsersSeeds from "./seeds/CreateUsersSeeds.js"; 

const runSeeds = async () => {
    console.log("Conectando ao banco de dados...");
    await AppDataSource.initialize();
    console.log("Banco de dados conectado.");

    try {
        console.log("--- Iniciando a execução dos seeds ---");

        await new CreateSituationsSeeds().run(AppDataSource); 
        await new CreateUsersSeeds().run(AppDataSource);
        await new CreateProductCategoriesSeeds().run(AppDataSource);
        await new CreateProductSituationsSeeds().run(AppDataSource);
        await new CreateProductsSeeds().run(AppDataSource);

        console.log("--- Todos os seeds foram executados com sucesso ---");

    } catch (error) {
        console.log("ERRO AO EXECUTAR OS SEEDS:", error);
    } finally {
        await AppDataSource.destroy();
        console.log("Conexão com o banco de dados encerrada.");
    }
};

runSeeds();