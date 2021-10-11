import { PrismaClient, TodoList, User } from "@prisma/client";
import { PassiveService, ServiceNetwork } from "koa-framework/ServiceNetwork";

export class TodoListService extends PassiveService {
    client: PrismaClient;
    constructor(services: ServiceNetwork, client: PrismaClient) {
        super();
        this.client = client;
    }

    async get_todo_lists_for_user(user_id: number): Promise<TodoList[]> {
        return await this.client.todoList.findMany({
            where: {
                owner_id: user_id
            }
        });
    }

    async get_user_todo_list(todo_list_id: number, user_id: number) {
        let rv = await this.client.todoList.findUnique({
            where: {
                id: todo_list_id
            },
            include: {
               todos: true 
            }
        });

        if (rv == null) {
            return null;
        }

        if (rv.owner_id != user_id) {
            return null;
        }

        return rv;
    }

    async create_todo_list(owner_id: number, title: string): Promise<TodoList> {
        return await this.client.todoList.create({
            data: {
                owner_id: owner_id,
                title: title
            }
        });
    }

    async create_todo_list_item(todo_list_id: number, description: string) {
        //TODO: should probably return whether or not the parent id is valid
        //Instead of an uncatched exception
        return await this.client.todo.create({
            data: {
                description: description,
                done: false,
                parent_id: todo_list_id
            }
        });
    }

    async set_todo_value(todo_list_id: number, todo_id: number, new_value: boolean): Promise<boolean> {
        let res = await this.client.todo.updateMany({
            data: {
                done: new_value
            },
            where: {
                id: todo_id,
                parent_id: todo_list_id
            }
        });
        return res.count == 1;
    }
}