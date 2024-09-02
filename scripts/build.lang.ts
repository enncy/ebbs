import fs from 'fs';
import path from 'path';
import default_lang from '../src/defaults-plugins/i18n/default';

const output = path.resolve(__dirname, '../languages/default.json');
fs.writeFileSync(output, JSON.stringify(default_lang, null, 4));