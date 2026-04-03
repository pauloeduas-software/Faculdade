import { DataSource } from "typeorm";
import { Products } from "../entity/Products.js";
import { ProductCategories } from "../entity/ProductCategories.js";
import { ProductSituations } from "../entity/ProductSituations.js";
import slugify from "slugify"; 

export default class CreateProductsSeeds {
    public async run(dataSource: DataSource): Promise<void> {
        console.log("Iniciando o seed para a tabela 'products'...");

        const productsRepo = dataSource.getRepository(Products);
        
        if (await productsRepo.count() > 0) {
            console.log("A tabela 'products' já possui dados. Nenhuma alteração foi realizada.");
            return;
        }

        const categoriesRepo = dataSource.getRepository(ProductCategories);
        const situationsRepo = dataSource.getRepository(ProductSituations);

        const categories = await categoriesRepo.find();
        const situations = await situationsRepo.find();

        if (categories.length === 0 || situations.length === 0) {
            console.error("ERRO: Categorias ou Situações faltantes.");
            return;
        }

        // Helpers para encontrar IDs facilmente pelo nome
        const getCat = (name: string) => categories.find(c => c.name === name) || categories[0];
        const getSit = (name: string) => situations.find(s => s.name === name) || situations[0];
        
        // Helper para gerar slug
        const getSlug = (text: string) => (slugify as any)(text, { lower: true });

        const products = [
            { 
                name: "iPhone 15 Pro Max", 
                slug: getSlug("iPhone 15 Pro Max"),
                description: "Smartphone Apple com titânio aeroespacial, chip A17 Pro e câmera de 48MP.",
                price: 8500.00,
                productCategory: getCat("Eletrônicos"), 
                productSituation: getSit("Disponível")  
            },

            { 
                name: "Monitor Gamer 144Hz", 
                slug: getSlug("Monitor Gamer 144Hz"),
                description: "Monitor LED 24 polegadas, tempo de resposta 1ms, ideal para jogos competitivos.",
                price: 1200.50,
                productCategory: getCat("Eletrônicos"), 
                productSituation: getSit("Em Estoque") 
            },

            { 
                name: "Camiseta Tech Algodão", 
                slug: getSlug("Camiseta Tech Algodão"),
                description: "Camiseta básica preta, tecnologia anti-suor e não desbota.",
                price: 59.90,
                productCategory: getCat("Vestuário"),
                productSituation: getSit("Disponível")
            },

            { 
                name: "O Senhor dos Anéis - Box", 
                slug: getSlug("O Senhor dos Anéis - Box"),
                description: "Trilogia completa em capa dura com ilustrações exclusivas.",
                price: 189.90,
                productCategory: getCat("Livros"), 
                productSituation: getSit("Disponível")  
            },
            
            { 
                name: "Clean Code", 
                slug: getSlug("Clean Code"),
                description: "Habilidades práticas do Agile Software. O guia definitivo para programadores.",
                price: 95.00,
                productCategory: getCat("Livros"), 
                productSituation: getSit("Esgotado")  
            },

            { 
                name: "Air Fryer 4L", 
                slug: getSlug("Air Fryer 4L"),
                description: "Fritadeira elétrica sem óleo, painel digital e cesto antiaderente.",
                price: 349.90,
                productCategory: getCat("Casa e Cozinha"),
                productSituation: getSit("Disponível")
            }
        ];

        await productsRepo.save(products);

        console.log("Seed concluído: produtos realistas cadastrados.");
    }
}