import parse from "csv-parse/lib/sync";
import fs = require("fs");
import _ from "lodash";
import { ReportBase } from "./reports/reportBase";

export class ReportsParser {
  private reports: Array<ReportBase>;
  private reportMetas: { [key: string]: any };
  constructor(private readonly file: string) {
    this.loadReportMetadata();
    this.readContents();
  }

  private loadReportMetadata() {
    const files = fs.readdirSync(`${__dirname}\\reports`);
    this.reportMetas = _(files)
      .filter(
        (fileName) =>
          !_.isEmpty(fileName.trim()) && fileName.endsWith("Report.js")
      )
      .map((fileName) => {
        const reportModule = require(`${__dirname}\\reports\\${fileName}`);
        if (!_.isEmpty(reportModule.REPORT_TOKEN)) {
          return {
            key: reportModule.REPORT_TOKEN,
            type: reportModule.default,
          };
        }
      })
      .compact()
      .keyBy("key")
      .mapValues((meta) => meta.type)
      .value();
  }

  private readContents() {
    const input = fs.readFileSync(this.file, {
      encoding: "utf-8",
    });

    const lines = input.split("\n");

    const categories: any = _(lines)
      .filter((line) => !_.isEmpty(line))
      .map((line) => {
        const trimmedLine = line.trim();
        const indexOfFirstDelimiter = trimmedLine.indexOf(",");
        return {
          category: trimmedLine.trim().substr(0, indexOfFirstDelimiter),
          content: trimmedLine.substr(indexOfFirstDelimiter + 1),
        };
      })
      .groupBy((lineInfo) => lineInfo.category)
      .mapValues((categoryInfos) =>
        _.map(categoryInfos, (cInfo) => cInfo.content)
      )
      .value();

    this.reports = _(categories)
      .map((content: any, key: any): ReportBase | undefined => {
        const statement = content.join("\n");
        try {
          const parsedCsv = parse(statement, {
            delimiter: ",",
            columns: true,
            skipEmptyLines: true,
          });
          if (this.reportMetas[key]) {
            return new this.reportMetas[key](key, parsedCsv);
          }
        } catch (e) {
          // We skip out records that are not structured
          // following the pattern:
          // Category (Activity Statement, Trades, MTM, etc)
          //    |
          //    -> CSV Table with records for the current activity
        }
      })
      .compact()
      .value();
  }
}
