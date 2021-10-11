import { Controller, Get, Post, Put, ValidatedContext } from "koa-framework/Decorator";
import { ServiceNetwork } from "koa-framework/ServiceNetwork";
import { UserLoginError, UserRegistrationError, UserService } from "../services/UserService";
import koa from "koa";
import { SessionService } from "koa-framework/services/SessionService";
import { IsBooleanString, IsNumberString, IsString } from "class-validator";
import { AuthenticationService } from "koa-framework/services/AuthenticationService";
import { User } from "@prisma/client";
import { TodoListService } from "../services/TodoListService";

class LoginRequest {
	@IsString()
	username: string;

	@IsString()
	password: string;

	constructor(username: string, password: string) {
		this.username = username;
		this.password = password;
	}
}

class RegisterRequest {
	@IsString()
	username: string;

	@IsString()
	password: string;

	constructor(username: string, password: string) {
		this.username = username;
		this.password = password;
	}
}

class CreateTodoListRequest {
    @IsString()
    title: string;
    constructor(title: string) {
        this.title = title;
    }
}

class GetTodoListParam {
    @IsNumberString({no_symbols: true})
    todo_list_id: string;
    constructor(todo_list_id: string) {
        this.todo_list_id = todo_list_id;
    }
}

class CreateTodoListItemBody {
    @IsString()
    description: string;
    constructor(description: string) {
        this.description = description;
    }
}

class SetTodoParam {
    @IsNumberString({no_symbols: true})
    todo_list_id: string;

    @IsNumberString({no_symbols: true})
    todo_id: string;

    constructor(todo_list_id: string, todo_id: string) {
        this.todo_list_id = todo_list_id;
        this.todo_id = todo_id;
    }
}


class SetTodoBody {
    @IsBooleanString()
    value: "true" | "false";

    constructor(value: "true" | "false") {
        this.value = value;
    }
}

export default class MainController extends Controller {
    user_service: UserService;
    session_service: SessionService;
    authentication_service: AuthenticationService<User>;
    todo_list_service: TodoListService;

    constructor(service_network: ServiceNetwork) {
        super();
        this.user_service = service_network.get_by_type(UserService);
        this.session_service = service_network.get_by_type(SessionService);
        this.authentication_service = service_network.get_by_type(AuthenticationService) as AuthenticationService<User>; 
        this.todo_list_service = service_network.get_by_type(TodoListService);
    }

    @Get("/register")
    async register_get(ctx: koa.Context) {
        let session = this.session_service.get_session(ctx);
        let last_error = session.get("last_error");
        session.delete("last_error");
        return `
<!DOCTYPE html>
<html>
    <head>
        <title>ding dong</title>
    </head>
    <body>
        <p>Register an account</p>
        ${last_error == null ? "" : `<p>error: ${last_error}</p>`}
        <form method="POST">
            <label for="username">Username: </label><input name="username" type="text"><br>
            <label for="password">password: </label><input name="password" type="password"><br>
            <input type="submit" value="Register">
        </form>
    </body>
</html>`
    }
    
    @Post("/register", [null, null, RegisterRequest])
    async register_post(ctx: ValidatedContext<null, null, RegisterRequest>) {
        let res = await this.user_service.register_user(ctx.request.vbody.username, ctx.request.vbody.password);
        if (typeof(res) != "object") {
            let session = this.session_service.get_session(ctx);
            switch (res) {
                case UserRegistrationError.DUPLICATE_USERNAME:
                    session.set("last_error", "Username is taken")
                    break;
                default:
                    session.set("last_error", "Unknown error");
                    console.log(`Unknown error ${res} from register_user`);
                    break;
            }
            ctx.redirect("/register");
            return "redirecting to register page";
        }

        ctx.redirect("/login");
        return "redirecting to login page";
    }

    @Get("/login")
    async login_get(ctx: koa.Context) {
        let session = this.session_service.get_session(ctx);
        let last_error = session.get("last_error");
        session.delete("last_error");
        return `
<!DOCTYPE html>
<html>
    <head>
        <title>ding dong</title>
    </head>
    <body>
        <p>login to an account</p>
        ${last_error == null ? "" : `<p>error: ${last_error}</p>`}
        <form method="POST">
            <label for="username">Username: </label><input name="username" type="text"><br>
            <label for="password">password: </label><input name="password" type="password"><br>
            <input type="submit" value="Register">
        </form>
    </body>
</html>`;
    }

    @Post("/login", [null, null, LoginRequest])
    async login_post(ctx: ValidatedContext<null, null, LoginRequest>) {
        let res = await this.user_service.login(ctx, ctx.request.vbody.username, ctx.request.vbody.password);
    
        let session = this.session_service.get_session(ctx);
        if (typeof(res) != "object") {
            switch (res) {
                case UserLoginError.WRONG_USERNAME:
                case UserLoginError.WRONG_PASSWORD:
                    session.set("last_error", "Wrong username or password");
                    break;
                case UserLoginError.INVALID_AUTHENTICATION_STRING:
                    session.set("last_error", "Please reset your password");
                    break;
                default:
                    session.set("last_error", "Unknown error occured");
                    console.log(`Unknown error ${res} from login`);
                    break;
            }
            ctx.redirect("/login");
            return "redirecting to login page";
        }

        ctx.redirect("/todo-list");
        return "redirecting to login page";
    }

    @Get("/todo-list")
    async todo_lists(ctx: koa.Context) {
        let user = await this.authentication_service.get_user(ctx);
        if (user == null) {
            let session = this.session_service.get_session(ctx);
            session.set("last_error", "you need to be logged in to access this resource");
            ctx.redirect("/login");
            return "redirecting to login";
        }
        let todo_lists = await this.todo_list_service.get_todo_lists_for_user(user.id);
        return `<!DOCTYPE html>
<html>
    <head>
        <title>Todo lists</title>
    </head>
    <body>
        <ul>
            ${todo_lists.map((todo_list) => {
                return `<li><a href="/todo-list/${todo_list.id}">${todo_list.title}</a></li>`
            }).join("\n")}
        </ul>
        <p>Create new todo list</p>
        <form method="POST">
            <input name="title" type="text"><br>
            <input type="submit" value="Create">
        </form>
    </body>
</html>`;
    }

    @Post("/todo-list", [null, null, CreateTodoListRequest])
    async todo_list_put(ctx: ValidatedContext<null, null, CreateTodoListRequest>) {
        let user = await this.authentication_service.get_user(ctx);
        if (user == null) {
            let session = this.session_service.get_session(ctx);
            session.set("last_error", "you need to be logged in to access this resource");
            ctx.redirect("/login");
            return "redirecting to login";
        }
        let res = await this.todo_list_service.create_todo_list(user.id, ctx.request.vbody.title);
        ctx.redirect(`/todo-list/${encodeURIComponent(res.id)}`);
        return "redirected to created todo list";
    }

    @Get("/todo-list/:todo_list_id", [GetTodoListParam, null, null])
    async todo_list(ctx: ValidatedContext<GetTodoListParam, null, null>) {
        let user = await this.authentication_service.get_user(ctx);
        if (user == null) {
            let session = this.session_service.get_session(ctx);
            session.set("last_error", "you need to be logged in to access this resource");
            ctx.redirect("/login");
            return "redirecting to login";
        }
        
        let todo_list_id = Number(ctx.request.vparam.todo_list_id);

        let todo_list = await this.todo_list_service.get_user_todo_list(todo_list_id, user.id);
        
        if (todo_list == null) {
            ctx.status = 404;
            return "the request resource does not exist";
        }

        //TODO: here we have a some nice XSS vulnerabilities, but this is a minimal example
        //In reality you would use EJS which would have built protection for this
        //SO DONT DO THIS
        return `<!DOCTYPE html>
<html>
    <head>
        <title>Todo list - ${todo_list.title}</title>
    </head>
    <body>
        <a href="/todo-list/">Back to todo lists</a>
        <h1>${todo_list.title}</h1>
        <ul>
            ${todo_list.todos.map((todo) => {
                return `<li><input class="todo-list-item" type="checkbox" data-id="${todo.id}"${todo.done ? " checked" : ""}>${todo.description}</li>`
            }).join("\n")}
        </ul>
        <p>add todo item</p>
        <form method="POST">
            <input name="description" type="text"><br>
            <input type="submit" value="create todo item">
        </form>
        <script>
            let items = document.querySelectorAll(".todo-list-item");
            for (let i = 0; i < items.length; i++) {
                items[i].addEventListener("click", (ev) => {
                    let raw_id = ev.target.getAttribute("data-id");
                    let id = Number(raw_id);
                    if (!Number.isInteger(id)) {
                        console.log("Invalid id!");
                        ev.preventDefault();
                    }
                    fetch("/todo-list/${encodeURIComponent(todo_list.id.toString())}/" + id.toString(), {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded"
                        },
                        body: "value=" + encodeURIComponent(String(ev.target.checked))
                    });
                })
            }        
        </script>
    </body>
</html>`;
    }

    @Post("/todo-list/:todo_list_id", [GetTodoListParam, null, CreateTodoListItemBody]) 
    async todo_list_item_add(ctx: ValidatedContext<GetTodoListParam, null, CreateTodoListItemBody>) {
        let user = await this.authentication_service.get_user(ctx);
        if (user == null) {
            let session = this.session_service.get_session(ctx);
            session.set("last_error", "you need to be logged in to access this resource");
            ctx.redirect("/login");
            return "redirecting to login";
        }

        let todo_list_id = Number(ctx.request.vparam.todo_list_id);
        let todo_list = await this.todo_list_service.get_user_todo_list(todo_list_id, user.id);
         
        if (todo_list == null) {
            ctx.status = 404;
            return "the request resource does not exist";
        }

        await this.todo_list_service.create_todo_list_item(todo_list_id, ctx.request.vbody.description);
        ctx.redirect(`/todo-list/${encodeURIComponent(todo_list_id.toString())}`);
        return "redirecting to todo list";
    }

    @Post("/todo-list/:todo_list_id/:todo_id", [SetTodoParam, null, SetTodoBody])
    async todo_list_item_set(ctx: ValidatedContext<SetTodoParam, null, SetTodoBody>) {
        let user = await this.authentication_service.get_user(ctx);
        if (user == null) {
            let session = this.session_service.get_session(ctx);
            session.set("last_error", "you need to be logged in to access this resource");
            ctx.redirect("/login");
            return "redirecting to login";
        }

        let todo_list_id = Number(ctx.request.vparam.todo_list_id);

        let todo_list = await this.todo_list_service.get_user_todo_list(todo_list_id, user.id);

        if (todo_list == null) {
            ctx.status = 404;
            return "the request resource does not exist";
        }

        let todo_id = Number(ctx.request.vparam.todo_id);

        let res = await this.todo_list_service.set_todo_value(todo_list_id, todo_id, ctx.request.vbody.value == "true");

        if (!res) {
            ctx.status = 404;
            return "the request resource does not exist";
        }

        return "ok";
    }
}