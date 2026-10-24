import { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
    user?: {
        id: number;
    }
}

interface TokenPayload {
    id: number;
    iat: number;
    exp: number;
}

export function verifyToken(req: AuthRequest, res: Response, next: NextFunction) {
    
    const authHeader = req.headers.authorization;

    // 1. Verifica se o header existe
    if (!authHeader) {
        return res.status(401).json({ 
            message: "Acesso negado! Token não fornecido." 
        });
    }

    // 2. Separa "Bearer <token>"
    const parts = authHeader.split(" ");

    if (parts.length !== 2) {
        return res.status(401).json({ message: "Erro no formato do token." });
    }

    const [scheme, token] = parts;

    // Verifica se a primeira parte é "Bearer"
    if (!/^Bearer$/i.test(scheme)) {
        return res.status(401).json({ message: "Token mal formatado." });
    }

    try {
        const secret = process.env.JWT_SECRET;

        if (!secret) {
            throw new Error("Erro de configuração: JWT_SECRET não encontrado.");
        }

        // 3. Verifica a validade do token
        const decoded = jwt.verify(token, secret) as TokenPayload;

        // 4. Salva o ID do usuário na requisição
        req.user = {
            id: decoded.id
        };

        // 5. Deixa passar
        next();

    } catch (error) {
        return res.status(401).json({ 
            message: "Token inválido ou expirado." 
        });
    }
}