import fs from 'fs';
import path from 'path';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import ExcelJS from 'exceljs';
import { getStorageRootPath } from '../utils/config';
import { logger } from '../utils/logger';

export async function createEmptyDocx(fileName?: string): Promise<string> {
  const storagePath = getStorageRootPath();
  const filesDir = path.join(storagePath, 'files');
  if (!fs.existsSync(filesDir)) {
    fs.mkdirSync(filesDir, { recursive: true });
  }

  const name = fileName || `文档_${Date.now()}.docx`;
  const filePath = path.join(filesDir, name);

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [new TextRun({ text: '' })],
        }),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(filePath, buffer);

  logger.info(`创建空白 Word 文件: ${filePath}`);
  return filePath;
}

export async function createEmptyXlsx(fileName?: string): Promise<string> {
  const storagePath = getStorageRootPath();
  const filesDir = path.join(storagePath, 'files');
  if (!fs.existsSync(filesDir)) {
    fs.mkdirSync(filesDir, { recursive: true });
  }

  const name = fileName || `表格_${Date.now()}.xlsx`;
  const filePath = path.join(filesDir, name);

  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Sheet1');
  await workbook.xlsx.writeFile(filePath);

  logger.info(`创建空白 Excel 文件: ${filePath}`);
  return filePath;
}

export async function createEmptyMd(fileName?: string): Promise<string> {
  const storagePath = getStorageRootPath();
  const filesDir = path.join(storagePath, 'files');
  if (!fs.existsSync(filesDir)) {
    fs.mkdirSync(filesDir, { recursive: true });
  }

  const name = fileName || `笔记_${Date.now()}.md`;
  const filePath = path.join(filesDir, name);

  fs.writeFileSync(filePath, '', 'utf-8');

  logger.info(`创建空白 Markdown 文件: ${filePath}`);
  return filePath;
}

export function readFileAsBuffer(filePath: string): Buffer {
  return fs.readFileSync(filePath);
}

export async function readExcelData(filePath: string): Promise<{
  sheets: Array<{ name: string; headers: string[]; rows: string[][] }>;
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheets: Array<{ name: string; headers: string[]; rows: string[][] }> = [];

  workbook.eachSheet((worksheet) => {
    const headers: string[] = [];
    const rows: string[][] = [];

    const headerRow = worksheet.getRow(1);
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers.push(cell.text || `列${colNumber}`);
    });

    for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);
      const rowData: string[] = [];
      let hasData = false;

      for (let colNum = 1; colNum <= headers.length; colNum++) {
        const cell = row.getCell(colNum);
        const text = cell.text || '';
        rowData.push(text);
        if (text) hasData = true;
      }

      if (hasData) {
        rows.push(rowData);
      }
    }

    sheets.push({ name: worksheet.name, headers, rows });
  });

  return { sheets };
}

export function writeFileContent(filePath: string, content: string): void {
  fs.writeFileSync(filePath, content, 'utf-8');
  logger.info(`文件内容已写入: ${filePath}`);
}
