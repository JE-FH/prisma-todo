import { PrismaClient, User } from "@prisma/client";
import ServiceNetwork from "koa-framework/ServiceNetwork";
import {UserStorage} from "koa-framework/services/AuthenticationService";

export class UserStorageAdapter implements UserStorage<User> {
    client: PrismaClient;
    constructor(client: PrismaClient) {
        this.client = client;
    }

    get_by_id(id: number): Promise<User | null> {
        return this.client.user.findUnique({
            where: {
                id: id
            }
        });
    }
}