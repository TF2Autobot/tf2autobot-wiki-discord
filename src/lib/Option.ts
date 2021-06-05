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

    public handleOption(option: string, value: string): void {
        this.currentOptions[option] = value;
        writeFileSync(this.optionsPath, JSON.stringify(this.currentOptions, null, 4), { encoding: 'utf8' });
    }

    public deleteCommand(command: string) {
        delete this.currentOptions[command];
        writeFileSync(this.optionsPath, JSON.stringify(this.currentOptions, null, 4), { encoding: 'utf8' });
    }
}
