/*
 * Copyright (c) 2021 ILEFA Labs
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import fs from 'fs';
import cheerio from 'cheerio';
import progress from 'progress';

import { PAYLOAD } from '../rmpPayloads.test';

export type RmpIds = {
    name: string;
    id: string;
}

let $ = cheerio.load(PAYLOAD);
let rmp: RmpIds[] = [];
let start = Date.now();
let len = parseInt($('.SearchResultsPage__SearchResultsPageHeader-sc-1srop1v-3 > h1:nth-child(1) > b:nth-child(1)').text());
let bar = new progress('[:bar] :rate/rps :etas (:current/:total) (:percent done)', {
    complete: '=',
    incomplete: ' ',
    width: 20,
    total: len
});

$('.TeacherCard__StyledTeacherCard-syjs0d-0').each((i: number) => {
    let name = $(`a.TeacherCard__StyledTeacherCard-syjs0d-0:nth-of-type(${i + 1}) > div:nth-child(1) > div:nth-child(2) > div:nth-child(1)`).text().trim();
    if (!name) {
        console.log(`\nNo name for index ${i}!`);
        return;
    }
    
    let url = $(`.TeacherCard__StyledTeacherCard-syjs0d-0:nth-of-type(${i + 1})`).attr('href');
    rmp.push({
        name: name,
        id: url.split('tid=')[1]
    });

    bar.tick();
});

console.log(`\nGenerated ${rmp.length} records in ${(Date.now() - start).toFixed(2)}ms`);
fs.writeFileSync('rmpIds-payloadName.json', JSON.stringify(rmp, null, 3), { encoding: 'utf8' });