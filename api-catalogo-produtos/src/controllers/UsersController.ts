import express from 'express';
import type { Request, Response } from 'express';
import { AppDataSource } from '../data-source.js';
import { Users } from '../entity/Users.js';
import { PaginationService } from '../services/PaginationService.js';
import * as yup from 'yup';
import { Not } from 'typeorm';
import bcrypt from 'bcryptjs';
import { verifyToken } from '../middlewares/AuthMiddleware.js';

const router = express.Router();

// LISTAR (Agora traz a "situation")
router.get("/users", verifyToken, async (req: Request, res: Response) => {
    try {
        const usersRepository = AppDataSource.getRepository(Users);
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        
        // Passamos ["situation"] para o serviço
        const result = await PaginationService.paginate(
            usersRepository, 
            page, 
            limit, 
            { id: "DESC" },
            ["situation"] 
        );
        return res.status(200).json({ result });
    } catch (error) {
        console.error("Erro ao listar usuários:", error);
        return res.status(500).json({ mensagem: "Erro interno ao listar." });
    }
});

// VISUALIZAR
router.get("/users/:id", verifyToken, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const usersRepository = AppDataSource.getRepository(Users);
        const user = await usersRepository.findOne({
            where: { id: parseInt(id) },
            relations: ["situation"] 
        });

        if (!user) return res.status(404).json({ mensagem: "Usuário não encontrado." });
        return res.status(200).json({ data: user });
    } catch (error) { return res.status(500).json({ mensagem: "Erro interno ao visualizar." }); }
});

// ATUALIZAR
router.put("/users/:id", verifyToken, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const data = req.body;
        const schema = yup.object().shape({
            name: yup.string().trim().required("Nome obrigatório.").min(4),
            email: yup.string().trim().required("Email obrigatório.").email(),
            password: yup.string().trim().min(6),
            situationId: yup.number().required("Situação obrigatória.")
        });
        await schema.validate(data, { abortEarly: false });

        const usersRepository = AppDataSource.getRepository(Users);
        const user = await usersRepository.findOneBy({ id: parseInt(id) });
        if (!user) return res.status(404).json({ mensagem: "Usuário não encontrado." });

        if (data.email !== user.email) {
            const exists = await usersRepository.findOne({ where: { email: data.email } });
            if (exists) return res.status(400).json({ mensagem: "E-mail em uso." });
        }

        if (data.password) data.password = await bcrypt.hash(data.password, 8);
        else delete data.password;

        usersRepository.merge(user, data);
        await usersRepository.save(user);
        return res.status(200).json({ mensagem: "Usuário atualizado com sucesso.", user });
    } catch (error) {
        if (error instanceof yup.ValidationError) return res.status(400).json({ mensagem: "Erro validação", erros: error.inner });
        return res.status(500).json({ mensagem: "Erro interno." });
    }
});

// ALTERAR SENHA
router.put("/user-password/:id", verifyToken, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { password } = req.body;
        const schema = yup.object().shape({ password: yup.string().trim().required().min(6) });
        await schema.validate({ password }, { abortEarly: false });

        const usersRepository = AppDataSource.getRepository(Users);
        const user = await usersRepository.findOneBy({ id: parseInt(id) });
        if (!user) return res.status(404).json({ mensagem: "Usuário não encontrado." });

        const passwordHash = await bcrypt.hash(password, 8);
        await usersRepository.update(id, { password: passwordHash });
        return res.status(200).json({ mensagem: "Senha alterada com sucesso." });
    } catch (error) {
        if (error instanceof yup.ValidationError) return res.status(400).json({ mensagem: "Erro validação", erros: error.inner });
        return res.status(500).json({ mensagem: "Erro interno." });
    }
});

// REMOVER
router.delete("/users/:id", verifyToken, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const usersRepository = AppDataSource.getRepository(Users);
        const user = await usersRepository.findOneBy({ id: parseInt(id) });
        if (!user) return res.status(404).json({ mensagem: "Usuário não encontrado." });
        await usersRepository.remove(user);
        return res.status(200).json({ mensagem: "Usuário removido com sucesso." });
    } catch (error) { return res.status(500).json({ mensagem: "Erro interno." }); }
});

// CADASTRAR
router.post("/users", async (req: Request, res: Response) => {
    try {
        const data = req.body;
        const schema = yup.object().shape({
            name: yup.string().trim().required().min(4),
            email: yup.string().trim().required().email(),
            password: yup.string().trim().required().min(6),
            situationId: yup.number().required()
        });
        await schema.validate(data, { abortEarly: false });

        const usersRepository = AppDataSource.getRepository(Users);
        const exists = await usersRepository.findOneBy({ email: data.email });
        if (exists) return res.status(400).json({ mensagem: "E-mail já cadastrado." });

        const passwordHash = await bcrypt.hash(data.password, 8);
        const newUser = usersRepository.create({ 
            name: data.name, email: data.email, password: passwordHash, situationId: data.situationId 
        });
        await usersRepository.save(newUser);
        return res.status(201).json({ mensagem: "Usuário cadastrado com sucesso", user: newUser });
    } catch (error) {
        if (error instanceof yup.ValidationError) return res.status(400).json({ mensagem: "Erro validação", erros: error.inner });
        return res.status(500).json({ mensagem: "Erro interno." });
    }
});

export default router;