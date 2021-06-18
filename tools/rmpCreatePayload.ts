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

import averyPoint from '../rmpIds-avery_point.json';
import hartford from '../rmpIds-hartford.json';
import law from '../rmpIds-law.json';
import stamford from '../rmpIds-stamford.json';
import storrs from '../rmpIds-storrs.json';
import torrington from '../rmpIds-torrington.json';
import waterbury from '../rmpIds-waterbury.json';

let data = []
    .concat(averyPoint, hartford, law, stamford, storrs, torrington, waterbury)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(ent => ({ ...ent, id: [ent.id] }));

const count = data.reduce((a, e) => {
    a[e.name] = ++a[e.name] || 0;
    return a;
}, {});

data
    .filter(({ name }) => count[name])
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(duplicate => {
        let matches = data
            .filter(ent => ent.name === duplicate.name)
            .map(ent => ({ ...ent, index: data.indexOf(ent) }));

        if (!matches || !matches.length) return;
        let firstIndex = Math.min(...matches.map(ent => ent.index));
        let entry = data[firstIndex];
        
        entry.id = [].concat.apply([], matches.map(ent => ent.id));
        data[firstIndex] = entry;
        matches
            .filter(match => match.index !== firstIndex)
            .forEach(match => data.splice(match.index, 1));
    });

data = data
    .filter(ent => !!ent)
    .map(ent => ({ name: ent.name, rmpIds: ent.id }));
    
fs.writeFileSync('rmpIds.json', JSON.stringify(data, null, 3), { encoding: 'utf8' });