import _ from "lodash";
import { Interface } from "readline";
import { CommandInfo } from "./commandInfo";
import { table } from 'table';

export interface TableOptions {
  columns: string[];
  customOptions?: any;
}

export abstract class CommandProcessor {
  private console: Interface;
  constructor(protected consoleInterface: Interface) {
    this.console = consoleInterface;
  }

  protected get Console(): Interface {
    return this.console;
  }

  protected get Prototype(): any {
    return CommandProcessor.prototype;
  }

  protected abstract getHelp(command: string): string;

  private generateHelp() {
    const thisArg: any = this;
    for (const member of Object.getOwnPropertyNames(this.Prototype)) {
      if (_.isFunction(thisArg[member]) && member.endsWith("Command")) {
        const commandToken = member.replace("Command", "");
        this.consoleInterface.write(`-- ${commandToken} - ${this.getHelp(commandToken)}\n`);
      }
    }
  }

  protected resolveArgument(argument: string, args: string) {
    let value = undefined;

    for (const argTuple of _.split(args, " ")) {
      if (argTuple.indexOf(argument) > -1) {
        const tupleElements = _.split(argTuple, ":");
        if (_.size(tupleElements) > 1) {
          value = tupleElements[1];
          break;
        } else {
          throw new Error(`Invalid argument: ${argTuple}`);
        }

      }
    }

    return value;
  }

  protected buildTable(rows: any[], tableOptions?: TableOptions): string {
    const tableSource = [];
    if (_.size(rows) > 0) {
      const availableColumns: string[] = Object.keys(_.first(rows));
      let selectedColumns = availableColumns;

      if (!_.isUndefined(tableOptions) && _.size(tableOptions.columns) > 0) {
        selectedColumns = tableOptions.columns;
      }

      const headerItem: string[] = _.filter<string>(availableColumns, (column: string) => _.indexOf(selectedColumns, column) > -1);
      tableSource.push(headerItem);
      const rowsSize = _.size(rows);
      for (let rowIndex = 0; rowIndex < rowsSize; rowIndex++) {
        tableSource.push(_.values(_.pick(rows[rowIndex], headerItem)));
      }
      return table(tableSource, tableOptions && tableOptions.customOptions);
    }

    return "No data";
  }

  public get commandToken(): string | undefined {
    return undefined;
  }

  public get processorDescription(): string {
    return "";
  }

  public startListening() {
    const thisArg = this;
    this.console.question("", (command: string) => {
      const commandInfo = new CommandInfo(command);

      try {
        if (thisArg.handle(commandInfo)) {
          thisArg.startListening();
        } else {
          thisArg.console.write(`Unrecognized command: ${command}\n`);
          thisArg.startListening();
        }
      }
      catch (e) {
        this.consoleInterface.write(`${e}\n`);
        thisArg.startListening();
      }
    });
  }

  public handle(command: CommandInfo): boolean {
    if (this.canHandle(command)) {
      this.execute(command);
      return true;
    } else {
      const childProcessors = this.getChildProcessors();
      for (const processor of childProcessors) {
        if (processor.commandToken === command.Command) {
          if (processor.handle(new CommandInfo(command.ArgsString))) {
            return true;
          }
        }
      }
      return false;
    }
  }

  protected abstract getChildProcessors(): CommandProcessor[];

  protected execute(command: CommandInfo) {
    const thisArg: any = this;
    thisArg[`${command.Command}Command`](command.ArgsString);
  }

  private canHandle(command: CommandInfo): boolean {
    const { Command: rootCommand } = command;
    if (!_.isUndefined(rootCommand)) {
      const thisArg: any = this;
      return _.isFunction(thisArg[`${rootCommand}Command`]);
    }
    return false;
  }

  public helpCommand() {
    this.generateHelp();
  }
}
