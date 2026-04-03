import "reflect-metadata";
import { DataSource } from "typeorm";
import dotenv from 'dotenv';
import { Situations } from "./entity/Situations.js";
import { Users } from "./entity/Users.js";
import { ProductCategories } from "./entity/ProductCategories.js";
import { ProductSituations } from "./entity/ProductSituations.js";
import { Products } from "./entity/Products.js";



dotenv.config();

export const AppDataSource = new DataSource({
    type: "postgres",
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    synchronize: false,
    logging: true,
    entities: [Situations, Users, ProductCategories, ProductSituations, Products],
    migrations: ["dist/migration/*.js"],
    subscribers: [],
});