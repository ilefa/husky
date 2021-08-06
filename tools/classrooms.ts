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
import axios from 'axios';
import cheerio from 'cheerio';
import progress from 'progress';

import {
    BoardType,
    CampusType,
    Classroom,
    ClassroomConferenceType,
    LectureCaptureType,
    SeatingType,
    TechType
} from '..';

const remoteLinks = [
    'https://classrooms.uconn.edu/classroom',
    'https://classrooms.hartford.uconn.edu/classroom',
    'https://classrooms.stamford.uconn.edu/classroom',
    'https://classrooms.waterbury.uconn.edu/classroom',
    'https://academicservices.averypoint.uconn.edu/classroom/'
];

const remoteLinkNames: CampusType[] = [
    'storrs',
    'hartford',
    'stamford',
    'waterbury',
    'avery_point'
];

const realRoomCodes = {
    'CHM': 'CHEM',
    'WIDM': 'STRSWW',
    'WOOD': 'WH',
    'WREC': 'RECTORY'
}

const generateClassroomMappings = async () => {
    console.log('[*] Preparing to generate mappings..');
    if (fs.existsSync('./classrooms.json')) {
        let date = Date.now();
        console.log(`[*] Existing mappings saved to [courses-${date}.json]`);
        fs.copyFileSync('./classrooms.json', `./classrooms-${date}.json`);
    }

    let start = Date.now();
    let failed: string[] = [];
    let all = await Promise.all(remoteLinks.map(async (link, i) => {
        let campus = remoteLinkNames[i];
        let $: cheerio.Root = await axios
            .get(link)
            .then(res => res.data)
            .then(res => cheerio.load(res))
            .catch(_ => null);

        if (!$) return console.error('Failed to retrieve data from the web.');

        let links: string[] = [];
        $('.classroom-item')
            .each((i) => links
                .push($(`div.col-sm-3:nth-child(${i + 1}) > div:nth-child(2) > div:nth-child(1) > a:nth-child(1)`)
                .attr('href')));

        let bar = new progress(':room [:bar] :rate/rps :etas (:current/:total) (:percent done)', {
            complete: '=',
            incomplete: ' ',
            width: 20,
            total: links.length
        });

        return await Promise.all(links.map(async (link, i) => {
            let res = await lookup(link, failed, campus);
            bar.tick({
                room: ((i + 1) >= links.length)
                    ? 'done'
                    : links[i]
            });

            return res;
        }));
    }));

    let rooms = [].concat.apply([], all);
    fs.writeFileSync('./classrooms.json', JSON.stringify(rooms, null, 3));
    
    if (failed.length > 0) {
        console.log(`\n[*] Failed to generate ${failed.length} mappings:`);
        failed.forEach(room => console.log(` - ${room}`));
    }

    console.log(`[*] Finished generating mappings for ${rooms.length} classrooms in ${getLatestTimeValue(Date.now() - start)}.`);
}

const lookup = async (link: string, failed: string[], campus: string): Promise<Classroom> => {
    let $: cheerio.Root = await axios
        .get(link)
        .then(res => res.data)
        .then(res => cheerio.load(res))
        .catch(_ => null);

    if (!$) {
        failed.push(link);
        return null;
    }

    let name = $('.classroom-info-title').text();
    let building = $('.classroom-info-building').text();
    let buildingCode = $('.classroom-info-buildingcode > span').text();
    let roomNumber = $('.classroom-info-roomnumber > span').text();
    let techType = $('.classroom-info-techtype > span').text();
    let techDescription = $('.classroom-info-tech > span').text();
    let seatingType = $('.classroom-info-seatingtype > span').text();
    let boardType = $('.classroom-info-boardtype > span').text();
    let covidCapacity = parseInt($('.classroom-info-capacity:nth-of-type(2n) > span').text());
    let regularCapacity = parseInt($('.classroom-info-capacity:nth-of-type(2n + 1) > span').text());
    let byodTesting = $('.classroom-info-byod > span').text();
    let conference = $('.classroom-info-video > span').text();
    let lectureType = $('.classroom-info-lecture > span.lecture_type').text();
    let liveStream = $('span.live-stream > a').attr('href');
    let threeSixty = $('.classroom-info-360viewurl > span > a').attr('href');
    let airConditioning = $('.classroom-info-aircondition > span').text();

    return {
        name: name.replace(/\s/, ''),
        building: {
            name: building,
            code: !buildingCode
                ? name.split(' ')[0]
                : realRoomCodes[buildingCode]
                    || buildingCode,
            campus: campus.toUpperCase(),
        },
        room: roomNumber,
        techType: getEnumKeyByEnumValue(TechType, techType),
        techDescription: techDescription || undefined,
        seatingType: getEnumKeyByEnumValue(SeatingType, seatingType) as keyof typeof SeatingType,
        boardType: getEnumKeyByEnumValue(BoardType, boardType) as keyof typeof BoardType,
        capacity: {
            covid: covidCapacity,
            full: regularCapacity
        },
        byodTesting: byodTesting ? byodTesting.toLowerCase() === 'yes' : false,
        airConditioned: airConditioning ? airConditioning.toLowerCase() === 'yes' : false,
        videoConference: ClassroomConferenceType.fromString(conference),
        lectureCapture: (getEnumKeyByEnumValue(LectureCaptureType, lectureType) || 'NONE') as keyof typeof LectureCaptureType,
        liveStreamUrl: liveStream,
        threeSixtyView: threeSixty,
    };
}

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

export function getEnumKeyByEnumValue(target: any, value: string) {
    let keys = Object.keys(target).filter((x) => target[x] == value);
    return keys.length > 0 ? keys[0] : undefined;
}

generateClassroomMappings();