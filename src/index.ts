/*
 * Copyright (c) 2024 ILEFA Labs
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

import qs from 'qs';
import axios from 'axios';
import moment from 'moment';
import cheerio from 'cheerio';
import tableparse from 'cheerio-tableparser';

import Classrooms from '../classrooms.json';
import CourseMappings from '../courses.json';

import { decode as decodeEntity } from 'html-entities';

import {
    CampusType,
    Classroom,
    CourseMapping,
    CoursePayload,
    EnrollmentPayload,
    ProfessorData,
    RateMyProfessorResponse,
    RmpReport,
    SearchParts,
    SectionData,
    SectionLocationData,
    SectionPayload,
    UConnService,
    UConnServiceReport,
    UConnServiceStatus,
    detectCampusBySection,
    getCatalogUrl
} from './util';

export * from './util';

export const COURSE_IDENTIFIER = /^[a-zA-Z]{2,4}\d{3,4}(Q|E|W)*$/;
export const SECTION_IDENTIFIER = /^(H|Z|W|N)*\d{2,3}(L|D|X)*$/;

const DEFAULT_PREREQS = 'There are no prerequisites for this course.';
const DEFAULT_DESC = 'There is no description provided for this course.';
const DEFAULT_SEARCH_PARTS = [SearchParts.SECTIONS, SearchParts.PROFESSORS];

/**
 * Attempts to retrieve data regarding
 * a specific UConn course, and returns
 * all sections, metadata, and other related
 * data about it.
 * 
 * Using ``useMappings`` as true will only return
 * the base course information, and will always
 * omit professors and sections from the result.
 * 
 * Do note that if the mapping does not exist,
 * it will fallback to querying the catalog.
 * 
 * Also do note that {@link SearchParts.PROFESSORS} is contingent
 * upon {@link SearchParts.SECTIONS} being included, so if it is
 * not, you will not get professors data.
 * 
 * @param identifier a valid course identifier
 * @param campus a valid campus type
 * @param useMappings whether or not to use offline mappings first, and if not found then query catalog
 * @param include overrides what parts are included in the CoursePayload, omit parameter to include all parts
 */
export const searchCourse = async (identifier: string, campus: CampusType = 'any', useMappings: boolean = false, include: SearchParts[] = DEFAULT_SEARCH_PARTS): Promise<CoursePayload> => {
    if (!COURSE_IDENTIFIER.test(identifier))
        return null;
    
    let prefix = identifier.split(/[0-9]/)[0].toUpperCase();
    let number = identifier.split(/[a-zA-Z]{2,4}/)[1];

    if (useMappings) {
        let mapping = (CourseMappings as any).find(ent => ent.name === identifier);
        if (!mapping) return await searchCourse(identifier, campus, false, []);
        let marker = moment().isBefore(new Date().setHours(6))
            ? moment(new Date().setHours(-6))
            : moment(new Date().setHours(0));

        return {
            name: mapping.name,
            grading: mapping.grading,
            credits: mapping.credits.toString(),
            prereqs: mapping.prerequisites,
            lastDataMarker: marker.toDate(),
            description: mapping.description,
            sections: [],
            professors: []
        }
    }

    let target = getCatalogUrl(prefix, number);
    let res = await axios
        .get(target)
        .then(res => res.data)
        .catch(_ => null);

    if (!res)
        return null;

    let $ = cheerio.load(res);
    tableparse($);
        
    let name = $('.single-course > h3:nth-child(2)')
        .text()
        .split(/\d{4}(?:Q|E|W)*\.\s/)[1];
        
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

    let lastDataRaw = $('.last-refresh').text() || moment().format('DD-MMM-YY h.mm.ss.[123456] a').toUpperCase();
    if (lastDataRaw.includes('.')) lastDataRaw = replaceAll(lastDataRaw, '.', ':');

    let lastDataMarker = new Date(lastDataRaw.split(/:\d{6}/).join(''));
    let description = $('.description').text() || DEFAULT_DESC;
    if (!include.includes(SearchParts.SECTIONS)) return {
        name, grading, credits,
        prereqs, lastDataMarker,
        description,
        sections: [],
        professors: []
    };

    let sections: SectionData[] = [];
    let data: string[][] = ($('.tablesorter') as any).parsetable();
    if (!data[0]) return {
        name, grading, credits,
        prereqs, lastDataMarker,
        description,
        sections: [],
        professors: []
    };

    let grad = target.includes('gradcatalog');
    let sectionCount = data[0].length - 1;

    for (let i = 0; i < sectionCount + 1; i++) {
        let internalData = cheerio.load(data[0][i].trim());
        let term = data[1][i];
        let campus = decodeEntity(data[grad ? 3 : 2][i]);
        let mode = decodeEntity(data[grad ? 4 : 3][i]);
        let instructor = data[grad ? 5 : 4][i]
            .replace(/\&nbsp;/g, ' ')
            .replace(/<br\s*\/*>/g, ' | ')
            .split(' | ')
            .map(ent => ent
                .split(', ')
                .reverse()
                .join(' '))
            .join(' & ');

        let section = data[grad ? 6 : 5][i];
        let session = data[grad ? 7 : 6][i].split('</a>')[0].split('>')[1];
        let schedule = data[grad ? 8 : 7][i];
        schedule = schedule.substring(0, schedule.length - 4);

        let location: string | any = data[grad ? 10 : 8][i];
        let locations: SectionLocationData[] = [];
        if (location?.includes('classrooms.uconn.edu')) {
            location = cheerio.load(location);
            if (!location.html().includes('<br>')) {
                let locationPayload: SectionLocationData = { name: location('a').text(), url: location('a').attr('href') };
                locations.push(locationPayload);
            } else {
                location('a').each((_, el) => {
                    let locationPayload: SectionLocationData = { name: $(el).text(), url: $(el).attr('href') };
                    locations.push(locationPayload);
                });
            }
        } else {
            let locationPayload: SectionLocationData = { name: location };
            locations.push(locationPayload);
        }

        let enrollment = data[9][i];
        let enrollmentPayload = {} as any;
        let spaces = enrollment.split('<')[0];
        let current = spaces.split('/')[0];
        let seats = spaces.split('/')[1];

        enrollmentPayload.max = seats;
        enrollmentPayload.current = current;
        enrollmentPayload.full = current >= seats;
        enrollmentPayload.waitlist = enrollment.includes('Waitlist Spaces:') 
            ? enrollment.split('Waitlist Spaces: ')[1] 
            : null;

        let notes = data[grad ? 13 : 10][i];
        
        let virtual: SectionData = {
            internal: {
                termCode: internalData('span.term-code').text(),
                classNumber: internalData('span.class-number').text(),
                classSection: internalData('span.class-section').text(),
                sessionCode: internalData('span.session-code').text(),
            },
            term,
            mode,
            campus,
            instructor,
            section,
            session,
            schedule,
            location: locations
                .filter((ent, i) => locations.findIndex(ent2 => ent2.name === ent.name) === i)
                .filter(ent => ent.name),
            enrollment: enrollmentPayload,
            notes
        }

        if (virtual.campus.toLowerCase() === 'off-campus')
            continue;

        sections.push(virtual);
    }

    if (campus !== 'any') {
        sections = sections.filter(section => 
            section
                .campus
                .replace(' ', '_')
                .toLowerCase() === campus.toLowerCase());
        sectionCount = sections.length;
    }
    
    let professors: ProfessorData[] = [];
    sections = sections.slice(1, sections.length);

    if (!include.includes(SearchParts.PROFESSORS)) return {
        name, grading, credits,
        prereqs, lastDataMarker,
        description, sections,
        professors: []
    }

    for (let section of sections) {
        let profs = section.instructor.split(' & ');
        for (let prof of profs) {        
            if (professors.some(p => p.name === prof))
                continue;
            
            let rmp = await searchRMP(prof);
            let teaching = sections
                .filter(section => section.instructor.split(' & ').includes(prof))
                .sort((a, b) => a.section.localeCompare(b.section));
    
            prof = decodeEntity(replaceAll(prof, '<br>', ' '));
    
            if (!rmp) {
                professors.push({
                    name: prof,
                    sections: teaching,
                    rmpIds: []
                });
                continue;
            }
    
            professors.push({
                name: prof,
                sections: teaching,
                rmpIds: rmp.rmpIds
            });
        }
    }

    professors = professors.filter(prof => !!prof.name.trim())

    return {
        name, grading, credits,
        prereqs, lastDataMarker,
        description, sections,
        professors
    }
}

/**
 * Attempts to retrieve information about
 * the given section of a course in the form
 * of a SectionData object.
 * 
 * @param identifier the course identifier
 * @param section the course section to query
 */
export const searchBySection = async (identifier: string, section: string): Promise<SectionPayload> => {
    let res = await searchCourse(identifier, detectCampusBySection(section) || 'any');
    if (!res)
        return null;

    let data = res
        .sections
        .find(({ section: sec }) => sec.toLowerCase() === section.toLowerCase());

    if (!data)
        return null;

    return {
        name: res.name,
        grading: res.grading,
        credits: res.credits,
        prereqs: res.prereqs,
        lastDataMarker: res.lastDataMarker,
        description: res.description,
        section: data
    }
}

/**
 * Returns all Course Mappings from the `courses.json`
 * file in the root of this project.
 */
export const getMappings = (): CourseMapping[] => CourseMappings as any;

/**
 * Returns a single CourseMapping object by some attribute.
 * 
 * @param key the key to search on
 * @param val the value to search for
 */
export const getMappingByAttribute = <K extends keyof CourseMapping>(key: K, val: CourseMapping[K]): CourseMapping => getMappings().find(ent => ent[key] === val);

/**
 * Returns all CourseMappings that match a some attribute.
 * 
 * @param key the key to search on
 * @param filter the filtering function to match results
 */
export const getMappingMatches = <K extends keyof CourseMapping>(key: K, filter: (val: CourseMapping[K]) => boolean): CourseMapping[] => getMappings().filter(ent => filter(ent[key]));

/**
 * Returns all Classroom Mappings from the `classrooms.json`
 * file in the root of this project.
 */
export const getClassrooms = (): Classroom[] => Classrooms as any;

/**
 * Returns all classrooms that match a specific building.
 * 
 * @param key the building attribute key to search on 
 * @param val the value to search for
 */
export const getClassroomsForBuilding = <K extends keyof Classroom['building']>(key: K, val: Classroom['building'][K]): Classroom[] => getClassrooms().filter(ent => ent.building[key] === val);

/**
 * Returns a single Classroom object by some attribute.
 * 
 * @param key the key to search on
 * @param val the value to search for
 */
export const getClassroomByAttribute = <K extends keyof Classroom>(key: K, val: Classroom[K]): Classroom => getClassrooms().find(ent => ent[key] === val);

/**
 * Returns all Classroom objects matching the filtering criteria.
 * 
 * @param key the key to search on
 * @param filter the filtering function to match results
 */
export const getClassroomMatches = <K extends keyof Classroom>(key: K, filter: (val: Classroom[K]) => boolean): Classroom[] => getClassrooms().filter(ent => filter(ent[key]));

/**
 * Attempts to locate entries on RMP
 * for a specified professor.
 * 
 * @param instructor the instructor to search for
 * @author Noah Struck <https://github.com/Struck713/eagle>
 */
export const searchRMP = async (instructor: string): Promise<RateMyProfessorResponse> => {
    let res = await axios
        .post(`https://www.ratemyprofessors.com/graphql`, 
            {
                query: `
                    query AutocompleteSearchQuery {
                        autocomplete(query: "${instructor}") {
                            teachers {
                                edges {
                                    node {
                                        id
                                        school {
                                            name
                                            id
                                        }
                                    }
                                }
                            }
                        }
                    }
                `
            },
            {
                headers: {
                    "Authorization": "Basic dGVzdDp0ZXN0"
                }
            }
        )
        .then(res => res.data.data)
        .catch(_ => null);
        
    if (!res || !res.autocomplete?.teachers?.edges) return {
        name: instructor,
        rmpIds: []
    }

    let rmp: string[] = res
        .autocomplete
        .teachers
        .edges
        .filter(e => e.node.school.name.toLowerCase().includes('university of connecticut'))
        .map(e => e.node.id);

    return {
        name: instructor,
        rmpIds: rmp
    }
}

/**
 * Attempts to create a report based
 * off of RMP data available for a
 * specified professor's RMP ID.
 * 
 * @param id the instructor's RMP id
 * @author Noah Struck <https://github.com/Struck713/eagle>
 */
export const getRmpReport = async (id: string): Promise<RmpReport> => {
    let res = await axios
        .post(`https://www.ratemyprofessors.com/graphql`, 
            {
                query: `
                    query Node {
                        node(id: "${id}") {
                            ... on Teacher {
                                avgRating
                                avgDifficultyRounded
                                wouldTakeAgainPercent
                                numRatings
                                teacherRatingTags {
                                    tagName
                                }
                                courseCodes {
                                    courseName
                                    courseCount
                                }
                                firstName
                                lastName
                                ratings(first: 1000) {
                                    edges {
                                        node {
                                            id
                                            legacyId
                                            class
                                            comment
                                            date
                                            difficultyRating
                                            helpfulRating
                                            clarityRating
                                            thumbsUpTotal
                                            thumbsDownTotal
                                            wouldTakeAgain
                                            attendanceMandatory
                                            grade
                                            isForCredit
                                            isForOnlineClass
                                            ratingTags
                                        }
                                    }
                                }
                            }
                        }
                    }
                `
            },
            {
                headers: {
                    "Authorization": "Basic dGVzdDp0ZXN0"
                }
            }
        )
        .then(res => res.data)
        .catch(_ => null);
    
    if (!res) return null;
    return { ...res.data.node };
}

/**
 * Attempts to query enrollment data from the
 * course catalog enrollment API.
 * 
 * Returns an unformatted string of #/# which
 * represents the current available seats and
 * capacity of the requested class.
 * 
 * @param term the term id of the current term
 * @param classNumber the class number for the requested class
 * @param section the requested section
 */
export const getRawEnrollment = async (term: string, classNumber: string, section: string): Promise<EnrollmentPayload> => await axios
    .post('https://catalog.uconn.edu/wp-content/plugins/uc-courses/soap.php', qs.stringify({
        action: 'get_latest_enrollment',
        term: term,
        classNbr: classNumber,
        sessionCode: 1,
        classSection: section
    }))
    .then(res => res.data)
    .then(async res => {
        if (!res.success)
            throw new Error('Request failed');

        let seats: string[] = res.data.split('/');
        let available = parseInt(seats[0]);
        let total = parseInt(seats[1]);
        let overfill = available >= total;

        return {
            course: {
                term,
                section,
                classNumber
            },
            available,
            total,
            overfill,
            percent: Number((available / total).toFixed(2))
        }
    })
    .catch(_ => null);

/**
 * Attempts to lookup service statuses from
 * the [UConn IT Status page](https://itstatus.uconn.edu)
 * and return them as UConnServiceReport objects.
 * 
 * @param services [optional] the services to lookup
 */
export const getServiceStatus = async (...include: UConnService[]): Promise<UConnServiceReport[]> => {
    let data = await axios
        .get('https://itstatus.uconn.edu')
        .then(res => res.data)
        .catch(_ => null);

    if (!data)
        return null;

    if (include.includes(UConnService.UNKNOWN))
        include = include.filter(srv => srv !== UConnService.UNKNOWN);

    let $ = cheerio.load(data);
    let services: UConnServiceReport[] = [];

    $('.list-group > li').each(i => {
        let selector = `li.list-group-item:nth-child(${i + 1})`;
        let name = $(`${selector} > p.box-1200`).text();
        let status = determineStatusFromHTML($(selector).html());

        services.push({
            service: UConnService[replaceAll(name.toUpperCase(), ' ', '_')] || UConnService.UNKNOWN,
            status: status,
            time: Date.now()
        });
    });

    if (include && include.length)
        services = services.filter(srv => include.includes(srv.service));

    if (services.some(srv => srv.service === UConnService.UNKNOWN))
        services = services.filter(srv => srv.service !== UConnService.UNKNOWN);

    return services;
}

const determineStatusFromHTML = (listItemSelector: string) => {
    if (listItemSelector.includes('text-success')) return UConnServiceStatus.OPERATIONAL;
    if (listItemSelector.includes('text-info')) return UConnServiceStatus.REPORTING;
    if (listItemSelector.includes('text-warning')) return UConnServiceStatus.DEGRADED;
    if (listItemSelector.includes('text-danger')) return UConnServiceStatus.OUTAGE;

    return UConnServiceStatus.UNKNOWN;
}

const replaceAll = (input: string, search: string, replace: string) => {
    let copy = String(input);
    if (!copy.includes(search)) {
        return copy;
    }

    while (copy.includes(search)) {
        copy = copy.replace(search, replace);
    }

    return copy;
}