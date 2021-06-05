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
    public handleBaseOptionOrAlias(option: string, newParam: string) {
        this.currentOptions[option] = newParam
        writeFileSync(this.optionsPath, JSON.stringify(this.currentOptions, null, "\t"), { encoding: 'utf8' });
    }
    public handleOption(option: string, content: string, files?: MessageAttachment[]): void {
        this.currentOptions[option] = { content, files };
        writeFileSync(this.optionsPath, JSON.stringify(this.currentOptions, null, "\t"), { encoding: 'utf8' });
    }
    public getOption(option: string, canReturnAlias?: boolean) {
        // turn aliases to main so they'll still receive I have just sent a reply for that
        option = Object.keys(this.currentOptions).find(i => i.toLowerCase() === option) || option;
        if (!canReturnAlias && typeof this.currentOptions[option] === "string") option = this.currentOptions[option];
        return [option, this.currentOptions[option]] as [string, MessageOptions];
    }

    public getList() {
        const autoresponses = Object.assign({}, this.currentOptions);
        delete autoresponses.prefix;
        delete autoresponses.roleID;
        const cmds: {
            [key: string]: string[]
        } = {}
        Object.keys(autoresponses).forEach(key => {
            const param = typeof autoresponses[key] === "string" ? autoresponses[key] : key;
            cmds[param] ??= [];
            cmds[param].push(key)
        })
        return `Here's a list of available auto-response keywords:\n- ${Object.keys(cmds).sort().map(key => cmds[key].join(' | '))}`
    }
    public deleteCommand(command: string) {
        //delete aliases as well since otherwise they'd be pointing to nowhere.
        if (typeof this.currentOptions[command] !== "string") {
            // Delete aliases for the command
            this.rePointAliases(command)
        }
        delete this.currentOptions[command];
        writeFileSync(this.optionsPath, JSON.stringify(this.currentOptions, null, "\t"), { encoding: 'utf8' });
    }

    public rePointAliases(command: string, newCommandOrDelete?: string | undefined) {
        Object.keys(this.currentOptions).forEach(key => {
            if (this.currentOptions[key] === command) {
                if (newCommandOrDelete === undefined) {
                    delete this.currentOptions[key]
                } else {
                    this.currentOptions[key] = newCommandOrDelete
                }
            }
        })
    }
}
