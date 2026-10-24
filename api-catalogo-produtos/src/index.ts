import "reflect-metadata";
import express from 'express';
import dotenv from "dotenv";
import { AppDataSource } from './data-source.js';
import cors from 'cors';

import AuthController from './controllers/AuthController.js';
import UsersController from './controllers/UsersController.js'; 
import SituationsController from './controllers/SituationsController.js';
import ProductCategoriesController from './controllers/ProductCategoriesController.js';
import ProductSituationsController from './controllers/ProductSituationsController.js';
import ProductsController from './controllers/ProductsController.js';

dotenv.config();

AppDataSource.initialize()
    .then(() => {
        console.log("Conexão com o banco de dados inicializada com sucesso!");
        
        const app = express();

        app.use(express.json());

        app.use(cors());

        app.use(AuthController);
        app.use(UsersController); 
        app.use(SituationsController);
        app.use(ProductCategoriesController); 
        app.use(ProductSituationsController); 
        app.use(ProductsController);          

        const PORT = process.env.PORT || 8080;
        app.listen(PORT, () => {
          console.log(`Servidor iniciado na porta ${PORT}: http://localhost:${PORT}`);
        });

    })
    .catch((error) => {
        console.error("Erro durante a inicialização da conexão com o banco de dados:", error);
    });