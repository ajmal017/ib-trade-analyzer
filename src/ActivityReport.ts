export class ActivityReport {
    private readonly contents: string;
    constructor(csvContents: string) {
        this.contents = csvContents;
    }
}