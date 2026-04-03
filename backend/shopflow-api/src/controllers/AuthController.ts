import express from 'express';
import type { Request, Response } from 'express';
import { AuthService } from '../services/AuthService.js';
import * as yup from 'yup';
import nodemailer from 'nodemailer'; 
import { verifyToken } from '../middlewares/AuthMiddleware.js';

const router = express.Router();

// 1. ROTA DE LOGIN
router.post("/login", async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: "E-mail e senha são obrigatórios" });

        const authService = new AuthService();
        const result = await authService.login(email, password);

        return res.status(200).json({ message: "Login realizado com sucesso!", user: result });
    } catch (error: any) {
        if (error.message === "E-mail ou senha inválidos") return res.status(401).json({ message: error.message });
        return res.status(500).json({ message: "Erro interno ao realizar login" });
    }
});

// 2. ROTA: VALIDAR TOKEN (NOVA)
router.get("/validate-token", verifyToken, async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const authService = new AuthService();
    
    return res.status(200).json({
        message: "Token válido!",
        userId: userId
    });
});

// 3. ROTA: SOLICITAR RECUPERAÇÃO (Envia E-mail)
router.post("/recover-password", async (req: Request, res: Response) => {
    try {
        const { email } = req.body; 
        const schema = yup.object().shape({
            email: yup.string().trim().required("O campo e-mail é obrigatório").email("E-mail inválido!"),
        });
        await schema.validate({ email }, { abortEarly: false });

        const authService = new AuthService();
        const resetBaseUrl = process.env.FRONTEND_URL_RESET;
        if (!resetBaseUrl) throw new Error("FRONTEND_URL_RESET não configurado no .env");

        const user = await authService.recoverPassword(email);

        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: Number(process.env.EMAIL_PORT),
            secure: false,
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        });

        const resetLink = `${resetBaseUrl}?email=${email}&key=${user.recoverPassword}`;

        const messageContent = {
            from: process.env.EMAIL_FROM,
            to: email, 
            subject: "Recuperação de Senha",
            html: `Prezado(a) ${user.name} <br><br>
                   Clique no link abaixo para criar uma nova senha:<br>
                   <a href="${resetLink}">${resetLink}</a>`
        };

        await transporter.sendMail(messageContent);

        return res.status(200).json({ message: "Link de recuperação enviado com sucesso!", linkParaTeste: resetLink });

    } catch (error: any) {
        if (error.message === "Usuário não encontrado.") return res.status(200).json({ message: "Link de recuperação enviado com sucesso!" }); 
        if (error instanceof yup.ValidationError) return res.status(400).json({ message: "Erro validação", erros: error.inner });
        return res.status(500).json({ message: "Erro no servidor de e-mail." });
    }
});

// 4. ROTA: VALIDAR CHAVE (Etapa 1 da troca)
router.post("/validate-recover-password", async (req: Request, res: Response) => {
    try {
        const { email, recoverPassword } = req.body;
        const schema = yup.object().shape({
            email: yup.string().trim().required().email(),
            recoverPassword: yup.string().trim().required()
        });
        await schema.validate({ email, recoverPassword }, { abortEarly: false });

        const authService = new AuthService();
        await authService.validateRecoveryToken(email, recoverPassword);

        return res.status(200).json({ message: "Chave válida!" });
    } catch (error: any) {
        if (error instanceof yup.ValidationError) return res.status(400).json({ message: "Erro validação", erros: error.inner });
        if (error.message === "Token inválido ou expirado.") return res.status(400).json({ message: "Chave inválida ou expirada." });
        return res.status(500).json({ message: "Erro interno." });
    }
});

// 5. ROTA: ATUALIZAR SENHA (Etapa 2 da troca - Final)
router.post("/update-password", async (req: Request, res: Response) => {
    try {
        const { email, recoverPassword, password } = req.body;
        const schema = yup.object().shape({
            email: yup.string().trim().required().email(),
            recoverPassword: yup.string().trim().required(),
            password: yup.string().trim().required("Nova senha obrigatória").min(6, "Mínimo 6 caracteres")
        });
        await schema.validate({ email, recoverPassword, password }, { abortEarly: false });

        const authService = new AuthService();
        await authService.updatePassword(email, recoverPassword, password);

        return res.status(200).json({ message: "Senha atualizada com sucesso." });
    } catch (error: any) {
        if (error instanceof yup.ValidationError) return res.status(400).json({ message: "Erro validação", erros: error.inner });
        if (error.message === "Token inválido ou expirado.") return res.status(400).json({ message: "Chave inválida ou expirada." });
        return res.status(500).json({ message: "Erro interno." });
    }
});

export default router;