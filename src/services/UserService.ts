import { PrismaClient, User } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime";
import { PassiveService, ServiceNetwork } from "koa-framework/ServiceNetwork";
import { AuthenticationService, InvalidAuthenticationString, WrongCredentialsError } from "koa-framework/services/AuthenticationService";
import * as koa from "koa";

export enum UserRegistrationError {
    DUPLICATE_USERNAME
};

export enum UserLoginError {
    WRONG_USERNAME,
    WRONG_PASSWORD,
    INVALID_AUTHENTICATION_STRING
};

export class UserService extends PassiveService {
    client: PrismaClient;
    authentication_service: AuthenticationService<User>;
    constructor(services: ServiceNetwork, client: PrismaClient) {
        super();
        this.client = client;
        //TODO: This is where koa-framework fails but i dont know how to fix this
        this.authentication_service = services.get_by_type(AuthenticationService) as AuthenticationService<User>;
    }

    async register_user(username: string, password: string): Promise<UserRegistrationError | User> {
        let authentication_string = await this.authentication_service.create_authentication_string(password);
        try {
            let user = await this.client.user.create({
                data: {
                    username: username,
                    authentication_string: authentication_string
                }
            });
            return user;
        } catch (e) {
            if (e instanceof PrismaClientKnownRequestError && e.code == "P2002") {
                return UserRegistrationError.DUPLICATE_USERNAME;
            }
            throw e;
        }
    }
    
    async login(ctx: koa.Context, username: string, password: string): Promise<User | UserLoginError> {
        let user = await this.client.user.findUnique({
            where: {
                username: username
            }
        });

        if (user == null) {
            return UserLoginError.WRONG_USERNAME;
        }

        try {
            await this.authentication_service.authenticate(ctx, user.id, user.authentication_string, password);
        } catch (e) {
            if (e instanceof WrongCredentialsError) {
                return UserLoginError.WRONG_PASSWORD;
            } else if (e instanceof InvalidAuthenticationString) {
                return UserLoginError.INVALID_AUTHENTICATION_STRING;
            } else {
                throw e;
            }
        }
        
        return user;
    }
}