import { Client } from 'discord.js';
import log from './Logger';
import Commands from './Commands';

export default class Bot {
    readonly client: Client;

    readonly commands: Commands;

    constructor() {
        this.client = new Client();
        this.client.login(process.env.TOKEN);
        this.commands = new Commands();
    }

    public start(): void {
        this.client.on('ready', this.ClientReady.bind(this));
        this.client.on('message', this.commands.handleMessage);
        this.commands.init();
    }

    public stop(): void {
        this.commands.stop();
        this.client.destroy();
    }

    private ClientReady() {
        log.info('Logged in as ' + this.client.user.tag);
    }
}
