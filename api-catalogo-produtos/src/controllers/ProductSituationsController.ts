import express from 'express';
import type { Request, Response } from 'express';
import { AppDataSource } from '../data-source.js';
import { ProductSituations } from '../entity/ProductSituations.js';
import { PaginationService } from '../services/PaginationService.js';
import * as yup from 'yup';
import { verifyToken } from '../middlewares/AuthMiddleware.js';

const router = express.Router();

// GET LISTAR (PROTEGIDA)
router.get("/product-situations", verifyToken, async (req: Request, res: Response) => {
    try {
        const repo = AppDataSource.getRepository(ProductSituations);
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const result = await PaginationService.paginate(repo, page, limit, { id: "ASC" });
        return res.status(200).json({ result });
    } catch (error) { return res.status(500).json({ mensagem: "Erro interno." }); }
});

router.get("/product-situations/:id", verifyToken, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const repo = AppDataSource.getRepository(ProductSituations);
        const result = await repo.findOneBy({ id: parseInt(id) });
        if (!result) return res.status(404).json({ mensagem: "Não encontrado." });
        return res.status(200).json({ data: result });
    } catch (error) { return res.status(500).json({ mensagem: "Erro interno." }); }
});

// ATUALIZAR (PROTEGIDA)
router.put("/product-situations/:id", verifyToken, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const data = req.body;

        const schema = yup.object().shape({
            name: yup.string().trim().required("Nome obrigatório.").min(4, "Mínimo 4 caracteres.")
        });
        await schema.validate(data, { abortEarly: false });

        const repo = AppDataSource.getRepository(ProductSituations);
        const situation = await repo.findOneBy({ id: parseInt(id) });

        if (!situation) return res.status(404).json({ mensagem: "Não encontrada." });

        // LÓGICA INTELIGENTE: Só checa se mudou o nome
        if (data.name !== situation.name) {
            const exists = await repo.findOne({ where: { name: data.name } });
            if (exists) return res.status(400).json({ mensagem: "Erro: Já existe." });
        }

        repo.merge(situation, data);
        await repo.save(situation);
        return res.status(200).json({ mensagem: "Atualizado.", situation });

    } catch (error) {
        if (error instanceof yup.ValidationError) return res.status(400).json({ mensagem: "Erro validação", erros: error.inner });
        return res.status(500).json({ mensagem: "Erro interno." });
    }
});

// REMOVER (PROTEGIDA)
router.delete("/product-situations/:id", verifyToken, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const repo = AppDataSource.getRepository(ProductSituations);
        const result = await repo.findOneBy({ id: parseInt(id) });
        if (!result) return res.status(404).json({ mensagem: "Não encontrado." });
        await repo.remove(result);
        return res.status(200).json({ mensagem: "Removido." });
    } catch (error) { return res.status(500).json({ mensagem: "Erro interno ao remover." }); }
});

// CADASTRAR (PROTEGIDA)
router.post("/product-situations", verifyToken, async (req: Request, res: Response) => {
    try {
        const data = req.body;
        const schema = yup.object().shape({ name: yup.string().trim().required().min(4) });
        await schema.validate(data, { abortEarly: false });

        const repo = AppDataSource.getRepository(ProductSituations);
        const exists = await repo.findOneBy({ name: data.name });
        if (exists) return res.status(400).json({ mensagem: "Erro: Já existe." });

        const novo = repo.create({ name: data.name });
        await repo.save(novo);
        return res.status(201).json({ mensagem: "Criado.", situation: novo });
    } catch (error) {
        if (error instanceof yup.ValidationError) return res.status(400).json({ mensagem: "Erro validação", erros: error.inner });
        return res.status(500).json({ mensagem: "Erro interno." });
    }
});

export default router;