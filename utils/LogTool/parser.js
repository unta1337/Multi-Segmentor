const fs = require('fs');
const os = require('os');
const {execSync} = require('child_process');
const path = require('path');
const gpuInfo = require('gpu-info');
const {ArgumentParser} = require('argparse');
const {GoogleSpreadsheet} = require('google-spreadsheet');

const parser = new ArgumentParser({
    description: 'Multi-Segmenter Result Parser'
});

parser.add_argument('-f', '--file', {type: 'str', help: 'Result Text File'});
parser.add_argument('-e', '--gsemail', {type: 'str', help: 'Google Spreadsheet email'});
parser.add_argument('-k', '--gskey', {type: 'str', help: 'Google Spreadsheet key'});
parser.add_argument('-d', '--gsdoc', {type: 'str', help: 'Google Spreadsheet doc'});

const args = parser.parse_args();

!async function () {
    const version = execSync('git rev-parse HEAD', {encoding: 'utf-8'}).trim();
    const filePath = args.file;
    const extension = path.extname(filePath);
    const fileName = path.basename(filePath, extension);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const fileContentSplit = fileContent.split('\n');
    const routines = fileContentSplit.map(line => {
        const lineSplit = line.split(':');
        let routine = lineSplit.slice(0, lineSplit.length - 1).join(':').trim();
        routine = routine.replace(/^- /, '');
        const time = parseFloat(lineSplit[lineSplit.length - 1]);
        if (!Number.isNaN(time)) {
            return {routine, time};
        } else {
            return null;
        }
    }).filter(r => r);

    const mode = fileName.match(/(?<=Segmented_)[a-zA-Z]+(?=_)/)[0];
    const model = fileName.match(/(?<=Segmented_.+_\d{1,4}.\d_).+(?=$)/)[0];
    let modelFilePath = filePath.split(/[\\/]/g).slice(0, -1).join('/') + '/' + model + '.obj';
    let modelFileSize = fs.statSync(modelFilePath).size;
    const tolerance = parseFloat(fileName.match(/(?<=Segmented_.+_).+(?=_)/)[0]);

    const cpus = os.cpus();
    const cpu = cpus[0].model.trim();
    const threads = cpus.length;
    const memory = os.totalmem();
    const gpus = (await gpuInfo()).filter(d => d.Status === 'OK').map(d => d.Caption).sort();
    const createdAtRaw = fs.statSync(filePath).birthtime;
    const createdAt = `${createdAtRaw.getFullYear()}-${(createdAtRaw.getMonth() + 1).toString().padStart(2, '0')}-${createdAtRaw.getDate().toString().padStart(2, '0')} ${createdAtRaw.getHours().toString().padStart(2, '0')}:${createdAtRaw.getMinutes().toString().padStart(2, '0')}:${createdAtRaw.getSeconds().toString().padStart(2, '0')}`;

    const data = {
        mode,
        model,
        tolerance,
        routines,
        modelFileSize,
        cpu,
        threads,
        memory,
        gpus,
        createdAt,
        version
    };
    console.log(JSON.stringify(data, null, 4));

    if (args.gsemail && args.gskey && args.gsdoc) {
        const doc = new GoogleSpreadsheet(args.gsdoc);
        await doc.useServiceAccountAuth({
            client_email: args.gsemail,
            private_key: Buffer.from(args.gskey, 'base64').toString('utf8'),
        });
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        await sheet.loadHeaderRow();
        const headers = sheet.headerValues;
        const rows = await sheet.getRows();
        const list = data.routines.map((r, i) => ({
            ...data, ...r,
            routineNumber: i + 1,
            routines: undefined,
            gpu: gpus[0]
        })).map(r => headers.map(k => r[k]));
        await sheet.addRows(list);
    }
}();