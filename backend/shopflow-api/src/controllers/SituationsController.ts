import express from 'express';
import type { Request, Response } from 'express';
import { AppDataSource } from '../data-source.js';
import { Situations } from '../entity/Situations.js';
import { PaginationService } from '../services/PaginationService.js';
import * as yup from 'yup';
import { Not } from 'typeorm';
import { verifyToken } from '../middlewares/AuthMiddleware.js';

const router = express.Router();

router.get("/situations", verifyToken, async (req: Request, res: Response) => {
    try {
        const repo = AppDataSource.getRepository(Situations);
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const result = await PaginationService.paginate(repo, page, limit, { id: "DESC" });
        return res.status(200).json({ result });
    } catch (error) { return res.status(500).json({ mensagem: "Erro interno." }); }
});

router.get("/situations/:id", verifyToken, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const repo = AppDataSource.getRepository(Situations);
        const result = await repo.findOneBy({ id: parseInt(id) });
        if (!result) return res.status(404).json({ mensagem: "Não encontrado." });
        return res.status(200).json({ data: result });
    } catch (error) { return res.status(500).json({ mensagem: "Erro interno." }); }
});

router.put("/situations/:id", verifyToken, async (req: Request, res: Response) => {
    try {
        const { id } = req.params; const data = req.body;
        const schema = yup.object().shape({ nameSituation: yup.string().trim().required().min(4) });
        await schema.validate(data, { abortEarly: false });
        const repo = AppDataSource.getRepository(Situations);
        const situation = await repo.findOneBy({ id: parseInt(id) });
        if (!situation) return res.status(404).json({ mensagem: "Não encontrada." });
        if (data.nameSituation !== situation.nameSituation) {
            const exists = await repo.findOne({ where: { nameSituation: data.nameSituation } });
            if (exists) return res.status(400).json({ mensagem: "Erro: Nome já existe." });
        }
        repo.merge(situation, data); await repo.save(situation);
        return res.status(200).json({ mensagem: "Atualizado.", situation });
    } catch (error) {
        if (error instanceof yup.ValidationError) return res.status(400).json({ mensagem: "Erro validação", erros: error.inner });
        return res.status(500).json({ mensagem: "Erro interno." });
    }
});

router.delete("/situations/:id", verifyToken, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const repo = AppDataSource.getRepository(Situations);
        const result = await repo.findOneBy({ id: parseInt(id) });
        if (!result) return res.status(404).json({ mensagem: "Não encontrado." });
        await repo.remove(result);
        return res.status(200).json({ mensagem: "Removido." });
    } catch (error) { return res.status(500).json({ mensagem: "Erro interno." }); }
});

router.post("/situations", verifyToken, async (req: Request, res: Response) => {
    try {
        const data = req.body;
        const schema = yup.object().shape({ nameSituation: yup.string().trim().required().min(4) });
        await schema.validate(data, { abortEarly: false });
        const repo = AppDataSource.getRepository(Situations);
        const exists = await repo.findOneBy({ nameSituation: data.nameSituation });
        if (exists) return res.status(400).json({ mensagem: "Erro: Já existe." });
        const novo = repo.create({ nameSituation: data.nameSituation });
        await repo.save(novo);
        return res.status(201).json({ mensagem: "Criado.", situation: novo });
    } catch (error) {
        if (error instanceof yup.ValidationError) return res.status(400).json({ mensagem: "Erro validação", erros: error.inner });
        return res.status(500).json({ mensagem: "Erro interno." });
    }
});

export default router;