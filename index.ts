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

import qs from 'qs';
import axios from 'axios';
import moment from 'moment';
import cheerio from 'cheerio';
import RmpIds from './rmpIds.json';
import similarity from 'string-similarity';
import CourseMappings from './courses.json';
import tableparse from 'cheerio-tableparser';

import { decode as decodeEntity } from 'html-entities';

export const COURSE_IDENTIFIER = /^[a-zA-Z]{2,4}\d{4}(Q|E|W)*$/;
export const SECTION_IDENTIFIER = /^(H|Z|W|N)*\d{2,3}(L|D|X)*$/;

export type CoursePayload = {
    name: string;
    grading: string;
    credits: string;
    prereqs: string;
    lastDataMarker: Date;
    description: string;
    sections: SectionData[];
    professors: ProfessorData[];
}

export type SectionPayload = {
    name: string;
    grading: string;
    credits: string;
    prereqs: string;
    lastDataMarker: Date;
    description: string;
    section: SectionData;
}

export type SectionData = {
    internal: {
        termCode: string;
        classNumber: string;
        classSection: string;
        sessionCode: string;
    }
    term: string;
    mode: string;
    campus: string;
    instructor: string;
    section: string;
    schedule: string;
    location: {
        name: string;
        url?: string;
    };
    enrollment: {
        max: number;
        current: number;
        waitlist?: number;
        full: boolean;
    }
    notes: string;
}

export type ProfessorData = {
    name: string;
    sections: SectionData[];
    rmpIds: string[];
}

export type RateMyProfessorResponse = {
    name: string;
    rmpIds: string[];
}

export type RateMyProfessorReport = {
    name: string;
    average: number;
    ratings: number;
    takeAgain: number;
    difficulty: number;
    tags: string[];
}

export enum UConnService {
    AURORA = 'Aurora',
    EMAIL = 'Email',
    HUSKYCT = 'HuskyCT',
    KFS = 'KFS',
    NETID = 'NetID',
    NETWORK = 'Network',
    STUDENT_ADMIN = 'Student Admin',
    WEBEX = 'Webex',
    UNKNOWN = 'Unknown'
}

export enum UConnServiceStatus {
    OPERATIONAL = 'Operational',
    REPORTING = 'Reporting',
    DEGRADED = 'Degraded',
    OUTAGE = 'Outage',
    UNKNOWN = 'Unknown'
}

export type UConnServiceReport = {
    service: UConnService;
    status: UConnServiceStatus;
    time: number;
}

export type Classroom = {
    name: string;
    building: {
        name: string;
        code: string;
    };
    room: string;
    techType: string;
    techDescription?: string;
    seatingType: keyof typeof SeatingType;
    boardType: keyof typeof BoardType;
    capacity: {
        covid: number;
        full: number;
    };
    byodTesting?: boolean;
    airConditioned?: boolean;
    videoConference: ClassroomConferenceType;
    lectureCapture: keyof typeof LectureCaptureType;
    liveStreamUrl?: string;
    threeSixtyView: string;
}

export type ConferenceTypeCapabilities = {
    shareContent: boolean;
    instructorFacingCamera: boolean;
    studentFacingCamera: boolean;
    presentMediaFrontOfRoom: boolean;
    presentMediaBackOfRoom: boolean;
    instructorMicrophone: boolean;
    studentMicrophone: boolean;
    connectToWebex: boolean;
}

export class ClassroomConferenceType {

    static readonly FULL = new ClassroomConferenceType('FULL', 'Full Video Conference', {
        shareContent: true,
        instructorFacingCamera: true,
        studentFacingCamera: true,
        presentMediaFrontOfRoom: true,
        presentMediaBackOfRoom: true,
        instructorMicrophone: true,
        studentMicrophone: true,
        connectToWebex: true
    });
    
    static readonly TEACH_FROM = new ClassroomConferenceType('TEACH_FROM', 'Teach From Video Conference', {
        shareContent: true,
        instructorFacingCamera: true,
        studentFacingCamera: false,
        presentMediaFrontOfRoom: false,
        presentMediaBackOfRoom: true,
        instructorMicrophone: true,
        studentMicrophone: false,
        connectToWebex: true    
    });
    
    static readonly SEMINAR = new ClassroomConferenceType('SEMINAR', 'Seminar Video Conference', {
        shareContent: true,
        instructorFacingCamera: true,
        studentFacingCamera: false,
        presentMediaFrontOfRoom: true,
        presentMediaBackOfRoom: false,
        instructorMicrophone: true,
        studentMicrophone: true,
        connectToWebex: true
    });
    
    static readonly NONE = new ClassroomConferenceType('NONE', 'None', {
        shareContent: false,
        instructorFacingCamera: false,
        studentFacingCamera: false,
        presentMediaFrontOfRoom: false,
        presentMediaBackOfRoom: false,
        instructorMicrophone: false,
        studentMicrophone: false,
        connectToWebex: false
    });

    private constructor(private readonly key: string, public readonly name: string, public readonly attributes: ConferenceTypeCapabilities) {}

    static fromString = (input: string) => {
        let valid = ['FULL', 'TEACH_FROM', 'SEMINAR'];
        if (valid.some(v => input.toLowerCase() === v))
            return ClassroomConferenceType[input.toUpperCase()];

        return valid
            .map(v => ClassroomConferenceType[v])
            .map(ent => {
                let k = ent as ClassroomConferenceType;
                if (k.name.toLowerCase() === input.toLowerCase())
                    return k;
            })
            .filter(ent => !!ent)
            .map(({ name, attributes }) => ({ name, attributes }))[0];
    }

    toString = () => this.key;

}

export enum SeatingType {
    TABLES = 'Tables',
    TABLES_AND_ARMCHAIRS = 'Tables and Tablet Armchairs',
    TABLET_ARMCHAIRS = 'Tablet Armchairs',
    FIXED_AUDITORIUM = 'Fixed/Auditorium',
    FIXED_TABLES = 'Fixed Seating Tables',
    FIXED_LEVELED_TABLES = 'Fixed Tier Leveled Tables',
    LAB_TABLES = 'Lab Tables and Chairs',
    ACTIVE = 'Active Learning',
    UNKNOWN = 'Unknown'
}

export enum TechType {
    FULL = 'Full Hi-Tech',
    BASIC = 'Basic Hi-Tech',
    UNKNOWN = 'Unknown',
}

export enum BoardType {
    NONE = 'None',
    WHITEBOARD = 'Whiteboard',
    CHALKBOARD = 'Chalkboard',
    UNKNOWN = 'Unknown'
}

export enum LectureCaptureType {
    ALL = 'All',
    NONE = 'None',
    SELF_SERVICE_RECORDING = 'Self Service Recording'
}

export enum BuildingCode {
    ABL = 'Agricultural Biotechnology Laboratory',
    ACS = 'Art Ceramic Studio',
    ADC = 'Art Design Building',
    AES = 'Architectural and Engineering Services',
    APS = 'Art Printshop',
    ARJ = 'Jamie Homero Arjona Building',
    ARTB = 'Art Building',
    ATWR = 'Wilbur O. Atwater Laboratory',
    AUST = 'Philip E. Austin Building',
    B1 = 'Biobehavioral Science #1',
    B3 = 'Biobehavioral Science #3',
    B4_A = 'Biobehavioral Science #4 and Annex',
    B5 = 'Biobehavioral Science #5',
    BCH = 'Charles Lewis Beach Hall',
    BISH = 'Bishop',
    BOUS = 'W.A. Bousfield – Psychology',
    BPB = 'Biology/Physics Building',
    BRON = 'A.B. Bronwell',
    BUSN = 'School of Business',
    CAST = 'F.L. Castleman',
    CHEM = 'Chemistry Building',
    CRU = 'Cattle Resource Center',
    DODD = 'Thomas.J. Dodd Center',
    DRMU = 'Drama/Music Building',
    E2 = 'Engineering II',
    FG = 'Floriculture – Greenhouse',
    FSB = 'Family Studies Building',
    GAMP = 'Gampel Pavilion Sports Center',
    GANT = 'Gant Central Building',
    GC = 'Gant Central Building',
    GENT = 'C.B. Gentry – Education',
    GN = 'Gant North Building',
    GRE = 'Greer Field House',
    GS = 'Gant South Building',
    GW = 'Gant West Building',
    HALL = 'Hall Dorm',
    HAWL = 'Willis Nichols Hawley Armory',
    HBL = 'Homer Babbidge Library',
    HDC = 'Human Development Center',
    HEW = 'H.G. Hewitt – Pharmacy',
    HH = 'Honors House',
    HJT = 'Harriet Jorgensen Theatre',
    HU1 = 'Horse Unit 1',
    HU2 = 'Horse Unit 2',
    IMS = 'Gant North',
    ITE = 'Information Technology Engineering',
    JONS = 'RE. Jones – Nutritional Sciences',
    JRB = 'J. Ray Ryan Building',
    KEL = 'Kellogg Dairy Center',
    KLIN = 'M.S. Klinck – Agriculture',
    KNS = 'Koons Hall',
    LAFA = 'Lafayette',
    LH = 'Lawrence D. McHugh Hall',
    LSA = 'Life Science Annex',
    LOR = 'Lorentzon Stables',
    LU1 = 'Livestock Unit 1 (Beef Barn)',
    LU2 = 'Livestock Unit 2 (Swine Barn)',
    MAN = 'Manchester Hall',
    MCHU = 'Lawrence D. McHugh Hall',
    MONT = 'H.R. Monteith – Social Science',
    MSB = 'Gant South Building',
    MUSB = 'Music Building',
    MLIB = 'Music Library',
    OAK = 'Oak Hall',
    PB = 'Gant West Building',
    PBB = 'Pharmacy/Biology Building',
    PCSB = 'D.C. Phillips – Communication Sciences',
    PR = 'Putnam Refectory',
    PU1 = 'Poultry Farm Unit 1',
    RHBA = 'Ratcliffe Hicks Building and Arena',
    ROWE = 'John W. Rowe Center for Undergraduate Education',
    SCHN = 'Andre Schenker',
    SHA = 'Storrs Hall Annex',
    SPRH = 'Shipee Hall',
    SRH = 'Sprague Hall',
    STRS = 'Storrs Hall',
    TLS = 'Torrey Life Sciences',
    TSK = 'Tasker Building',
    UTEB = 'United Technologies Building',
    VARC = 'Visual Arts Resource Center',
    VDM = 'J. Louis von der Mehden Recital Hall',
    WCB = 'Wilbur Cross Building',
    WGC = 'Nathan L. Whetten Graduate Center',
    WIDM = 'Carolyn Ladd Widmer Wing',
    WITE = 'George C. White Building',
    WOOD = 'Walter Childs Wood Hall',
    WSH = 'Williams Student Health',
    WSRH = 'Wilson South Residence Hall',
    YNG = 'W.B. Young'
}

export type CampusType = 'any' 
                | 'storrs' 
                | 'hartford' 
                | 'stamford' 
                | 'waterbury' 
                | 'avery_point';

export enum SearchParts {
    SECTIONS,
    PROFESSORS
}

export type EnrollmentPayload = {
    course: {
        term: string;
        classNumber: string;
        section: string;
    };
    available: number;
    total: number;
    overfill: boolean;
    percent: number;
}

export enum RmpCampusIds {
    STORRS = '1091',
    HARTFORD = '5015',
    STAMFORD = '4543',
    WATERBURY = '4955',
    AVERY_POINT = '4650'
}

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
        let mapping = CourseMappings.find(ent => ent.name === identifier);
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

    let target = `https://catalog.uconn.edu/directory-of-courses/course/${prefix}/${number}/`;
    let res = await axios
        .get(target)
        .then(res => res.data)
        .catch(_ => null);

    if (!res) {
        return null;
    }

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
    if (lastDataRaw.includes('.')) {
        lastDataRaw = replaceAll(lastDataRaw, '.', ':');
    }

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

    let sectionCount = data[0].length - 1;
    for (let i = 0; i < sectionCount + 1; i++) {
        let internalData = cheerio.load(data[0][i].trim());
        let term = data[1][i];
        let campus = decodeEntity(data[2][i]);
        let mode = decodeEntity(data[3][i]);
        let instructor = data[4][i]
            .replace('&nbsp;', ' ')
            .split(', ')
            .reverse()
            .join(' ');

        let section = data[5][i];
        let schedule = data[7][i];
        schedule = schedule.substring(0, schedule.length - 4);

        let location: string | any = data[8][i];
        let locationPayload = {} as any;
        if (location?.includes('classrooms.uconn.edu')) {
            location = cheerio.load(location);
            locationPayload.name = location('a').text();
            locationPayload.url = location('a').attr('href');
        } else {
            locationPayload.name = location;
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

        let notes = data[10][i];
        
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
            schedule,
            location: locationPayload,
            enrollment: enrollmentPayload,
            notes
        }

        if (virtual.campus.toLowerCase() === 'off-campus') {
            continue;
        }

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
        let prof = section.instructor;
        if (professors.some(p => p.name === prof)) {
            continue;
        }

        let rmp = await searchRMP(prof);
        let teaching = sections
            .filter(section => section.instructor === prof)
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
 * Attempts to locate entries on RMP
 * for a specified professor.
 * 
 * @param instructor the instructor to search for
 */
export const searchRMP = async (instructor: string): Promise<RateMyProfessorResponse> => {
    let local = RmpIds.find(ent => ent.name.toLowerCase() === instructor.toLowerCase());
    if (local) return {
        name: instructor,
        rmpIds: local.rmpIds
    }

    let similar = RmpIds
        .map(entry => ({ ...entry, similarity: similarity.compareTwoStrings(instructor, entry.name) }))
        .sort((a, b) => b.similarity - a.similarity)
        .filter(entry => entry.similarity > 0.70);

    if (similar.length) return {
        name: similar[0].name,
        rmpIds: similar[0].rmpIds  
    }

    if (!instructor.trim() || instructor.split(',').length)
        return null;

    let $: cheerio.Root = await axios.get(`https://www.ratemyprofessors.com/search.jsp?queryoption=HEADER&queryBy=teacherName&schoolName=University+of+Connecticut=&query=${instructor.replace(' ', '+')}`)
        .then(res => res.data)
        .then(data => cheerio.load(data))
        .catch(_ => null);

    instructor = decodeEntity(replaceAll(instructor, '<br>', ' '));

    if (!$) return {
        name: instructor,
        rmpIds: []
    }

    let rmp: string[] = [];

    $('.TeacherCard__StyledTeacherCard-syjs0d-0').each((i: number) => {
        let school = $(`.TeacherCard__StyledTeacherCard-syjs0d-0:nth-child(${i + 1}) > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) > div:nth-child(2)`).text();
        if (!school.includes('University of Connecticut')) {
            return;
        }

        let name = $(`.CardName__StyledCardName-sc-1gyrgim-0:nth-child(${i + 1})`).text();
        let s1 = instructor.toLowerCase().split(' ');
        let s2 = name.toLowerCase().split(' ');
        let sim = similarity.compareTwoStrings(s1.join(' '), s2.join(' '));

        if (!s1.every(ent => s2.includes(ent)))
            if (sim < 0.7) return;

        rmp.push($(`.TeacherCard__StyledTeacherCard-syjs0d-0:nth-child(${i + 1})`)
            .attr('href')
            .split('tid=')[1]);
    });

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
 * @param id the instructor's ratemyprofessors' id
 */
export const getRmpReport = async (id: string): Promise<RateMyProfessorReport> => {
    let $: cheerio.Root = await axios.get(`https://www.ratemyprofessors.com/ShowRatings.jsp?tid=${id}`)
        .then(res => res.data)
        .then(data => cheerio.load(data))
        .catch(_ => null);

    if (!$) return null;

    let name = $('.NameTitle__Name-dowf0z-0 > span:nth-child(1)').text().trim() + ' ' + $('.NameTitle__LastNameWrapper-dowf0z-2').text().trim();
    let average = parseFloat($('.RatingValue__Numerator-qw8sqy-2').text());
    let ratings = parseInt($('.RatingValue__NumRatings-qw8sqy-0 > div:nth-child(1) > a:nth-child(1)').text().split(' ')[0]);
    let takeAgain = NaN;
    let difficulty = NaN;
    let tags = [];

    $('.FeedbackItem__StyledFeedbackItem-uof32n-0').each((i: number) => {
        let ent = $(`div.FeedbackItem__StyledFeedbackItem-uof32n-0:nth-child(${i + 1})`);
        if (i == 0) takeAgain = parseFloat(ent.text().split('%')[0]);
        if (i == 1) difficulty = parseFloat(ent.text());
    })
    
    $('.Tag-bs9vf4-0').each((i: number) => {
        tags.push($(`.TeacherTags__TagsContainer-sc-16vmh1y-0 > span:nth-child(${i + 1})`).text());
    });

    return {
        name, average, ratings,
        takeAgain, difficulty,
        tags: tags.filter(tag => !!tag)
    }
}

/**
 * Attempts to guess what campus a certain
 * section is being taught at.
 * 
 * Notice: This method will not always work,
 * as off-campus courses and Storrs courses
 * both do not have alphabetic prefixes, and
 * just start with a the section number.
 * 
 * @param section the section name
 */
export const detectCampusBySection = (section: string): CampusType => {
    switch (section.substring(0, 1).toLowerCase()) {
        case 'h':
            return 'hartford';
        case 'z':
            return 'stamford';
        case 'w':
            return 'waterbury';
        case 'n':
            return 'avery_point';
        default:
            return 'storrs';
    }
}

/**
 * Returns whether or not the provided campus
 * is a valid member of the {@link CampusType} type.
 * 
 * @param input the inputted campus
 */
export const isCampusType = (input: string): input is CampusType => {
    let lower = input.toLowerCase();
    return lower === 'any'
        || lower === 'storrs'
        || lower === 'hartford'
        || lower === 'stamford'
        || lower === 'waterbury'
        || lower === 'avery_point'
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
 * the UConn IT Status page (https://itstatus.uconn.edu)
 * and return them as UConnServiceReport objects.
 * 
 * @param services [optional] the services to lookup
 */
export const getServiceStatus = async (...include: UConnService[]): Promise<UConnServiceReport[]> => {
    let data = await axios
        .get('https://itstatus.uconn.edu')
        .then(res => res.data)
        .catch(_ => null);

    if (!data) {
        return null;
    }

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
    