require("source-map-support").install();
import { PrismaClient } from "@prisma/client";
import {ServiceNetwork} from "koa-framework/ServiceNetwork";
import {AuthenticationService, Algorithm} from "koa-framework/services/AuthenticationService";
import {SessionService, MemoryStore} from "koa-framework/services/SessionService";
import { UserStorageAdapter } from "./UserStorageAdapter";
import koa from "koa";
import bodyParser from "koa-bodyparser";
import Router from "@koa/router";
import MainController from "./controllers/MainController";
import { UserService } from "./services/UserService";
import { TodoListService } from "./services/TodoListService";

const SERVER_PORT = 8000;

async function main() {
    const prisma = new PrismaClient();
    await prisma.$connect();
    
    let app = new koa();
    let main_router = new Router();

    let services = new ServiceNetwork();
    services.add_service(SessionService, new SessionService({key: "sesskey", expires: 1000 * 60 * 60 * 24}, new MemoryStore()));
    services.add_service(AuthenticationService, new AuthenticationService(services, new UserStorageAdapter(prisma), {
        algorithm: Algorithm.PBKDF2,
		rounds: 50000,
		salt_length: 16,
		digest: "sha512",
		encodings: ["base64", "hex"],
		preferred_encoding: "base64",
		keylen: 64
	}));
	
	services.add_service(UserService, new UserService(services, prisma));
	services.add_service(TodoListService, new TodoListService(services, prisma));

    app.use(async (ctx, next) => {
		console.log(`${ctx.method}\t${ctx.url}`);
		await next();
	});

	app.use(bodyParser());
	app.use(async (ctx, next) => {
		await next();
	})
    
    for (let middleware of services.create_middleware()) {
		app.use(middleware);
    }

	let main_controller = new MainController(services);
	
	main_router.use(main_controller.get_routes());
	
	app.use(main_router.routes());

	app.listen(SERVER_PORT, () => {
		console.log(`Now listening on ${SERVER_PORT}`);
	})
}

main();