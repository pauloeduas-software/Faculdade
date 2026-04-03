import express from 'express';
import type { Request, Response } from 'express';
import { AppDataSource } from '../data-source.js';
import { Products } from '../entity/Products.js';
import { PaginationService } from '../services/PaginationService.js';
import * as yup from 'yup';
import { Not } from 'typeorm';
import { default as slugify } from 'slugify';
import { verifyToken } from '../middlewares/AuthMiddleware.js';

const router = express.Router();

// LISTAR (Com Relações)
router.get("/products", verifyToken, async (req: Request, res: Response) => {
    try {
        const repository = AppDataSource.getRepository(Products);
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        
        // Passamos as duas tabelas relacionadas
        const result = await PaginationService.paginate(
            repository, 
            page, 
            limit, 
            { id: "ASC" },
            ["productCategory", "productSituation"] 
        );
        return res.status(200).json({ result });
    } catch (error) { return res.status(500).json({ mensagem: "Erro interno ao listar." }); }
});

// VISUALIZAR
router.get("/products/:id", verifyToken, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const repository = AppDataSource.getRepository(Products);
        const product = await repository.findOne({
            where: { id: parseInt(id) },
            relations: ["productCategory", "productSituation"]
        });
        if (!product) return res.status(404).json({ mensagem: "Produto não encontrado." });
        return res.status(200).json({ data: product });
    } catch (error) { return res.status(500).json({ mensagem: "Erro interno ao visualizar." }); }
});

// ATUALIZAR
router.put("/products/:id", verifyToken, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const data = req.body;
        const schema = yup.object().shape({
            name: yup.string().trim().required().min(4), description: yup.string().trim().nullable(),
            price: yup.number().min(0).nullable(), productCategoryId: yup.number().required(), productSituationId: yup.number().required()
        });
        await schema.validate(data, { abortEarly: false });

        const repository = AppDataSource.getRepository(Products);
        const product = await repository.findOneBy({ id: parseInt(id) });
        if (!product) return res.status(404).json({ mensagem: "Produto não encontrado." });

        if (data.name !== product.name) {
            const exists = await repository.findOne({ where: { name: data.name } });
            if (exists) return res.status(400).json({ mensagem: "Erro: Nome já existe." });
            data.slug = (slugify as any)(data.name, { lower: true });
        }

        repository.merge(product, data);
        await repository.save(product);
        return res.status(200).json({ mensagem: "Produto atualizado com sucesso.", product });
    } catch (error) {
        if (error instanceof yup.ValidationError) return res.status(400).json({ mensagem: "Erro validação", erros: error.inner });
        return res.status(500).json({ mensagem: "Erro interno." });
    }
});

// REMOVER
router.delete("/products/:id", verifyToken, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const repository = AppDataSource.getRepository(Products);
        const product = await repository.findOneBy({ id: parseInt(id) });
        if (!product) return res.status(404).json({ mensagem: "Produto não encontrado." });
        await repository.remove(product);
        return res.status(200).json({ mensagem: "Produto removido com sucesso." });
    } catch (error) { return res.status(500).json({ mensagem: "Erro interno." }); }
});

// CADASTRAR
router.post("/products", verifyToken, async (req: Request, res: Response) => {
    try {
        const data = req.body;
        const schema = yup.object().shape({
            name: yup.string().trim().required().min(4), description: yup.string().trim().nullable(),
            price: yup.number().min(0).nullable(), productCategoryId: yup.number().required(), productSituationId: yup.number().required()
        });
        await schema.validate(data, { abortEarly: false });

        const repository = AppDataSource.getRepository(Products);
        const exists = await repository.findOneBy({ name: data.name });
        if (exists) return res.status(400).json({ mensagem: "Erro: Nome já existe." });

        const slugGerado = (slugify as any)(data.name, { lower: true });
        const newProduct = repository.create({ 
            name: data.name, slug: slugGerado, description: data.description, price: data.price, 
            productCategoryId: data.productCategoryId, productSituationId: data.productSituationId 
        });
        
        await repository.save(newProduct);
        return res.status(201).json({ mensagem: "Produto cadastrado com sucesso", product: newProduct });
    } catch (error) {
        if (error instanceof yup.ValidationError) return res.status(400).json({ mensagem: "Erro validação", erros: error.inner });
        return res.status(500).json({ mensagem: "Erro interno." });
    }
});

export default router;