import { MessageAttachment, MessageOptions } from 'discord.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'graceful-fs';

export const defaultOptions = {
    prefix: '.',
    roleID: ''
};

export default class Options {
    public currentOptions;

    private readonly folderPath: string = './files';

    private readonly optionsPath: string = './files/options.json';

    public init(): void {
        if (!existsSync(this.folderPath)) {
            mkdirSync(this.folderPath);
        }

        if (!existsSync(this.optionsPath)) {
            writeFileSync(this.optionsPath, JSON.stringify(defaultOptions, null, 4), { encoding: 'utf8' });
            this.currentOptions = defaultOptions;
        } else {
            this.currentOptions = JSON.parse(readFileSync(this.optionsPath));
        }
    }
    // Only for prefix and roleID
    public handleBaseOption(option: "prefix" | "roleID", newParam: string) {
        this.currentOptions[option] = newParam
        writeFileSync(this.optionsPath, JSON.stringify(this.currentOptions, null, "\t"), { encoding: 'utf8' });
    }
    public handleOption(option: string, content: string, files?: MessageAttachment[]): void {
        this.currentOptions[option] = { content, files };
        writeFileSync(this.optionsPath, JSON.stringify(this.currentOptions, null, "\t"), { encoding: 'utf8' });
    }
    public getOption(option: string): MessageOptions {
        return this.currentOptions[option] as MessageOptions;
    }

    public deleteCommand(command: string) {
        delete this.currentOptions[command];
        writeFileSync(this.optionsPath, JSON.stringify(this.currentOptions, null, "\t"), { encoding: 'utf8' });
    }
}
