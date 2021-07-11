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
import yn from 'yesno';
import axios from 'axios';
import cheerio from 'cheerio';
import progress from 'progress';
import tableparse from 'cheerio-tableparser';

type Course = {
    name: string;
    catalogName: string;
    catalogNumber: string;
    prerequisites: string;
    attributes: CourseAttributes; 
    credits: number;
    grading: string;
    description: string;
}

type CoursePayload = {
    href: string;
    subject: string;
    number: string;
    name: string;
    attrib: string[];
}

type CourseAttributes = {
    lab: boolean;
    writing: boolean;
    quantitative: boolean;
    environmental: boolean;
    contentAreas: ContentArea[];
}

enum ContentArea {
    CA1 = 'CA1',
    CA2 = 'CA2',
    CA3 = 'CA3',
    CA4 = 'CA4',
    CA4INT = 'CA4INT'
}

const DEFAULT_PREREQS = 'There are no prerequisites for this course.';
const DEFAULT_DESC = 'There is no description provided for this course.';

const generateCourseMappings = async () => {
    console.log('[*] Preparing to generate mappings..');
    let start = Date.now();
    let $ = await axios
        .get('https://catalog.uconn.edu/course-search/')
        .then(res => res.data)
        .then(res => cheerio.load(res))
        .catch(_ => null);

    if (!$)
        return console.error('Failed to retrieve data from the web.');

    tableparse($);

    let courses: Course[] = [];
    let table: string[][] = ($('.tablesorter') as any).parsetable();

    if (fs.existsSync('./courses.json')) {
        let existing = JSON.parse(fs.readFileSync('./courses.json', { encoding: 'utf8' }));
        if (table[3].length === existing.length) {
            const cont = await yn({ question: '[*] Catalog response has the same amount of entries as your existing mappings, continue?' });
            if (!cont) return;
        }
        
        let date = Date.now();
        console.log(`[*] Existing mappings saved to [courses-${date}.json]`);
        console.log(`[*] Origin: ${table[3].length}, local: ${existing.length}, delta: ${table[3].length - existing.length}`);
        fs.copyFileSync('./courses.json', `./courses-${date}.json`);
    }

    console.log(`[*] Ready to generate mappings for ${table[3].length.toLocaleString()} courses.`);
    let bar = new progress(':course [:bar] :rate/rps :etas (:current/:total) (:percent done)', {
        complete: '=',
        incomplete: ' ',
        width: 20,
        total: table[3].length
    });

    for (let i = 1; i < table[3].length; i++) {
        let row = assembleRow(table, i);
        let res = await lookup(row.subject, row.number.toString());
        if (!res) {
            res = {
                credits: NaN.toString(),
                desc: 'Unavailable',
                grading: 'Unavailable',
                prereqs: 'Unavailable'
            }
        }

        let course: Course = {
            name: row.subject + row.number,
            catalogName: row.name,
            catalogNumber: row.number,
            prerequisites: res.prereqs,
            attributes: {
                lab: hasCompetency(row, 'CA3LAB'),
                writing: hasCompetency(row, 'COMPW'),
                quantitative: hasCompetency(row, 'COMPQ'),
                environmental: hasCompetency(row, 'COMPE'),
                contentAreas: row
                    .attrib
                    .map(attrib => attrib === 'CA3LAB'
                        ? 'CA3'
                        : attrib)
                    .filter(attrib => attrib.startsWith('CA'))
                    .map(attrib => ContentArea[attrib.toUpperCase()])
            },
            credits: parseInt(res.credits),
            grading: res.grading,
            description: res.desc,
        }

        bar.tick({
            course: ((i + 1) >= table[3].length)
                ? 'done'
                : table[3][i + 1] + table[4][i + 1]
        });

        courses.push(course);
    }

    fs.writeFileSync('./courses.json', JSON.stringify(courses, null, 3));
    console.log(`\n[*] Finished generating mappings for ${courses.length} courses in ${getLatestTimeValue(Date.now() - start)}.`);
}

const lookup = async (prefix: string, number: string) => {
    let target = `https://catalog.uconn.edu/directory-of-courses/course/${prefix}/${number}/`;
    let res = await axios
        .get(target)
        .then(res => res.data)
        .catch(_ => null);

    if (!res) {
        return null;
    }

    let $ = cheerio.load(res);

    let grading = $('.grading-basis')
        .text()
        .trim()
        .split('Grading Basis: ')[1] || 'Graded';

    let credits = $('.credits')
        .text()
        .trim()
        .split(' ')[0] || 'Unknown Credits';

    let prereqs = $('.prerequisites').text() || DEFAULT_PREREQS;
    if (prereqs && prereqs !== DEFAULT_PREREQS) {
        let parts = prereqs
            .trim()
            .split(/Prerequisite(?:s){0,1}\:\s/);

        prereqs = parts.length === 1 ? parts[0] : parts[1];
        
        if (prereqs.includes('None.'))
            prereqs = DEFAULT_PREREQS;
        
        if (prereqs.includes('Recommended Preparation'))
            prereqs = prereqs.split('Recommended Preparation')[0].trim()
    }

    let desc = $('.description').text() || DEFAULT_DESC;
    return { grading, credits, prereqs, desc };
}

const hasCompetency = (row: CoursePayload, competency: string) =>
    row
        .attrib
        .some(attrib => attrib === competency.toUpperCase());

const assembleRow = (res: string[][], index: number) => {
    let payload: CoursePayload = {} as any;
    let filtered = [
        {
            index: 1,
            name: 'href',
            apply: (raw: string) => cheerio
                .load(raw.trim())('a')
                .attr('href')
        },
        {
            index: 3,
            name: 'subject'
        },
        {
            index: 4,
            name: 'number',
        },
        {
            index: 5,
            name: 'name'
        },
        {
            index: 6,
            name: 'attrib',
            apply: (raw: string) => {
                let $ = cheerio.load(raw);
                let k = '';

                $('a').each((i) => {
                    k += $(`a:nth-child(${i + 1})`).text() + ' ';
                });

                return (k && k.length)
                    ? k.trim().split(' ')
                    : [];
            }
        }
    ];
    
    filtered.forEach(ent => payload[ent.name] = ent.apply
        ? ent.apply(res[ent.index][index])
        : res[ent.index][index]);

    return payload;
};

const getLatestTimeValue = (time: number) => {
    let sec = Math.trunc(time / 1000) % 60;
    let min = Math.trunc(time / 60000 % 60);
    let hrs = Math.trunc(time / 3600000 % 24);
    let days = Math.trunc(time / 86400000 % 30.4368);
    let mon = Math.trunc(time / 2.6297424E9 % 12.0);
    let yrs = Math.trunc(time / 3.15569088E10);

    let y = `${yrs}y`;
    let mo = `${mon}mo`;
    let d = `${days}d`;
    let h = `${hrs}h`;
    let m = `${min}m`;
    let s = `${sec}s`;

    let result = '';
    if (yrs !== 0) result += `${y}, `;
    if (mon !== 0) result += `${mo}, `;
    if (days !== 0) result += `${d}, `;
    if (hrs !== 0) result += `${h}, `;
    if (min !== 0) result += `${m}, `;
    
    result = result.substring(0, Math.max(0, result.length - 2));
    if ((yrs !== 0 || mon !== 0 || days !== 0 || min !== 0 || hrs !== 0) && sec !== 0) {
        result += ', ' + s;
    }

    if (yrs === 0 && mon === 0 && days === 0 && hrs === 0 && min === 0) {
        result += s;
    }

    return result.trim();
}

generateCourseMappings();