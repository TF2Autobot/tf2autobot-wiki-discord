import { MessageAttachment, MessageOptions } from 'discord.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import path from 'path';

interface DefaultOptions {
    prefix: string;
    roleID: string;
}
interface Command {
    content?: string;
    files?: MessageAttachment[];
    isMeme?: boolean;
}
interface OptionsContent extends DefaultOptions {
    [keyword: string]: Command | string;
}

export const defaultOptions = {
    prefix: '.',
    roleID: ''
};

export default class Options {
    public currentOptions: OptionsContent;

    public currentOcr: {
        [keyword: string]: string;
    } = {};
    private readonly folderPath = path.join(__dirname, '..', '..', 'files');

    private readonly optionsPath = path.join(__dirname, '..', '..', 'files', 'options.json');

    private readonly ocrPath = path.join(__dirname, '..', '..', 'files', 'ocr.json');

    public init(): void {
        if (!existsSync(this.folderPath)) {
            mkdirSync(this.folderPath);
        }

        if (!existsSync(this.optionsPath)) {
            writeFileSync(this.optionsPath, JSON.stringify(defaultOptions, null, 4), { encoding: 'utf8' });
            this.currentOptions = defaultOptions;
        } else {
            this.currentOptions = JSON.parse(readFileSync(this.optionsPath, { encoding: 'utf8' }));
        }

        if (existsSync(this.ocrPath)) this.currentOcr = JSON.parse(readFileSync(this.ocrPath, { encoding: 'utf8' }));
    }
    // Only for prefix and roleID
    public handleBaseOptionOrAlias(option: string, newParam: string) {
        this.currentOptions[option] = newParam;
        this.saveOptionsFile();
    }
    public handleOption(option: string, content: string, files: MessageAttachment[], isMeme: boolean): void {
        this.currentOptions[option] = { content, files, isMeme };
        this.saveOptionsFile();
    }
    public handleOptionParam(option: string, param: keyof Command, value: any) {
        this.currentOptions[option][param] = value;
        this.saveOptionsFile();
    }
    public getOption(option: string, canReturnAlias?: boolean) {
        // turn aliases to main so they'll still receive I have just sent a reply for that
        option = Object.keys(this.currentOptions).find(i => i.toLowerCase() === option.toLowerCase()) || option;
        if (!canReturnAlias && typeof this.currentOptions[option] === 'string')
            option = this.currentOptions[option] as string;
        return [option, this.currentOptions[option]] as [string, Command];
    }

    public getList(type: 'list' | 'memelist' | 'ocr') {
        const autoresponses = Object.assign({}, type !== 'ocr' ? this.currentOptions : this.currentOcr);
        delete autoresponses.prefix;
        delete autoresponses.roleID;

        const cmds: {
            [key: string]: string[];
        } = {};
        const doNotAdd: string[] = [];
        Object.keys(autoresponses).forEach(key => {
            const param = (typeof autoresponses[key] === 'string' ? autoresponses[key] : key) as string;
            if (doNotAdd.includes(param)) return;
            if (key === param && ((autoresponses[key] as Command).isMeme || false) != (type == 'memelist')) {
                delete cmds[param];
                doNotAdd.push(param);
                return;
            }
            cmds[param] ??= type === 'ocr' ? [param] : [];
            // if its the main command inserts it to the beginning else pushes it :)
            cmds[param][key === param ? 'unshift' : 'push'](key);
        });
        return `Here's a list of available ${
            type == 'ocr' ? 'auto - response texts' : 'auto - response keywords'
        }:\n- ${Object.keys(cmds)
            .sort()
            .map(key => cmds[key].join(' | '))
            .join('\n- ')}`;
    }
    public deleteCommand(command: string) {
        //delete aliases as well since otherwise they'd be pointing to nowhere.
        if (typeof this.currentOptions[command] !== 'string') {
            // Delete aliases for the command
            this.rePointAliases(command);
        }
        delete this.currentOptions[command];
        this.saveOptionsFile();
    }

    public renameCommand(command: string, newCommand: string) {
        this.rePointAliases(command, newCommand);
        delete Object.assign(this.currentOptions, { [newCommand]: this.currentOptions[command] })[command];
        this.saveOptionsFile();
        this.saveOcrFile();
    }

    public rePointAliases(command: string, newCommandOrDelete?: string | undefined) {
        [Object.keys(this.currentOcr), Object.keys(this.currentOptions)].forEach((keys, index) => {
            const currentType = index ? this.currentOptions : this.currentOcr;
            keys.forEach(key => {
                if (currentType[key] === command) {
                    if (newCommandOrDelete === undefined) {
                        delete currentType[key];
                    } else {
                        currentType[key] = newCommandOrDelete;
                    }
                }
            });
        });
    }

    private saveOptionsFile() {
        writeFileSync(this.optionsPath, JSON.stringify(this.currentOptions, null, '\t'), { encoding: 'utf8' });
    }

    private saveOcrFile() {
        writeFileSync(this.ocrPath, JSON.stringify(this.currentOcr, null, '\t'), { encoding: 'utf8' });
    }

    public addOcr(text: string, targetOption: string) {
        this.currentOcr[text.toLowerCase()] = targetOption;
        this.saveOcrFile();
    }

    public deleteOcr(text: string) {
        delete this.currentOcr[text];
        this.saveOcrFile();
    }

    public getOcrResponse(text: string) {
        text = text.toLowerCase();
        for (const ocr of Object.keys(this.currentOcr)) {
            if (text.includes(ocr)) return this.currentOptions[this.currentOcr[ocr]] as Command;
        }
    }
}
