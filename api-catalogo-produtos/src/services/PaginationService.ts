import type { FindOptionsOrder, ObjectLiteral, Repository } from "typeorm";

interface PaginationResult<T> {
    error: boolean;
    data: T[];
    currentPage: number;
    lastPage: number;
    totalRecords: number;
}

export class PaginationService {
    static async paginate<T extends ObjectLiteral>(
        repository: Repository<T>,
        page: number = 1,
        limit: number = 10,
        order: FindOptionsOrder<T> = {},
        relations: string[] = [] 
    ): Promise<PaginationResult<T>> {
        
        const totalRecords = await repository.count();
        const lastPage = Math.ceil(totalRecords / limit);
        const offset = (page - 1) * limit;

        const data = await repository.find({
            take: limit,
            skip: offset,
            order,
            relations: relations 
        });

        return {
            error: false,
            data,
            currentPage: page,
            lastPage: lastPage === 0 ? 1 : lastPage,
            totalRecords
        };
    }
}