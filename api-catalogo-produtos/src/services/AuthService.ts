import { AppDataSource } from "../data-source.js";
import { Users } from "../entity/Users.js";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

interface LoginResponse {
    id: number;
    name: string;
    email: string;
    token: string;
}

export class AuthService {

    async login(email: string, password: string): Promise<LoginResponse> {
        const usersRepository = AppDataSource.getRepository(Users);
        const user = await usersRepository.findOneBy({ email });

        if (!user) throw new Error("E-mail ou senha inválidos");

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) throw new Error("E-mail ou senha inválidos");

        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error("Erro: JWT_SECRET não configurado no .env");

        const token = jwt.sign({ id: user.id }, secret, { expiresIn: '7d' });

        return {
            id: user.id,
            name: user.name,
            email: user.email,
            token: token
        };
    }

    // Retorna o Usuário completo para podermos usar o Nome no e-mail
    async recoverPassword(email: string): Promise<Users> {
        const usersRepository = AppDataSource.getRepository(Users);
        const user = await usersRepository.findOneBy({ email });

        if (!user) {
            throw new Error("Usuário não encontrado.");
        }

        const recoveryToken = crypto.randomBytes(20).toString('hex');

        user.recoverPassword = recoveryToken;
        await usersRepository.save(user);

        return user; 
    }

    // Apenas valida se o token existe 
    async validateRecoveryToken(email: string, recoverToken: string): Promise<void> {
        const usersRepository = AppDataSource.getRepository(Users);
        const user = await usersRepository.findOneBy({ 
            email: email, 
            recoverPassword: recoverToken 
        });

        if (!user) {
            throw new Error("Token inválido ou expirado.");
        }
    }

    // Troca a senha efetivamente (Etapa 2 da recuperação)
    async updatePassword(email: string, recoverToken: string, newPassword: string): Promise<void> {
        const usersRepository = AppDataSource.getRepository(Users);
        const user = await usersRepository.findOneBy({ 
            email: email, 
            recoverPassword: recoverToken 
        });

        if (!user) {
            throw new Error("Token inválido ou expirado.");
        }

        const passwordHash = await bcrypt.hash(newPassword, 8);

        await usersRepository.update(user.id, {
            password: passwordHash,
            recoverPassword: null as any 
        });
    }
}