import fs from 'fs';
import axios from 'axios';
import cheerio from 'cheerio';
import progress from 'progress';

import { searchCourse } from '../src';

const PREFIXES = [
    "ACCT",
    "ADMN",
    "AMES",
    "AFRI",
    "AFRA",
    "ARE",
    "AGNR",
    "AH",
    "AMST",
    "ANSC",
    "ANTH",
    "ALDS",
    "ART",
    "ARTH",
    "BASC",
    "BME",
    "BIST",
    "BADM",
    "BLAW",
    "CHEG",
    "CHEM",
    "CE",
    "CAMS",
    "CLTR",
    "COGS",
    "COMM",
    "CORG",
    "CLCS",
    "CSE",
    "CHIP",
    "DENT",
    "DMD",
    "DSEL",
    "DRAM",
    "ERTH",
    "EEB",
    "ECON",
    "EGEN",
    "EDCI",
    "EDLR",
    "EPSY",
    "ECE",
    "ENGR",
    "ENGL",
    "ENVE",
    "ES",
    "EMBA",
    "FED",
    "FNCE",
    "FREN",
    "GEOG",
    "GERM",
    "GRAD",
    "HCMI",
    "HEJS",
    "HIST",
    "HBEL",
    "HDFS",
    "HRTS",
    "IS",
    "INDS",
    "IGFP",
    "ISKM",
    "ISG",
    "IMS",
    "IMED",
    "INTS",
    "ILCS",
    "KINS",
    "LLAS",
    "LING",
    "LCL",
    "MENT",
    "MFGE",
    "MARN",
    "MKTG",
    "MSE",
    "MATH",
    "ME",
    "MLSC",
    "MEDS",
    "MCB",
    "MUSI",
    "NRE",
    "NURS",
    "NUSC",
    "OPIM",
    "PATH",
    "PHAR",
    "PHIL",
    "PT",
    "PHYS",
    "PNB",
    "PLSC",
    "POPR",
    "POLS",
    "POLY",
    "PSYC",
    "PUBH",
    "PP",
    "RSCH",
    "ROML",
    "SSW",
    "SWEL",
    "SOCI",
    "SPAN",
    "SPTP",
    "SLHS",
    "STAT",
    "SE",
    "TRST",
    "WGSS"
];

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

type CourseAttributes = {
    lab: boolean;
    writing: boolean;
    quantitative: boolean;
    environmental: boolean;
    contentAreas: ContentArea[];
    graduate: boolean;
}

enum ContentArea {
    CA1 = 'CA1',
    CA2 = 'CA2',
    CA3 = 'CA3',
    CA4 = 'CA4',
    CA4INT = 'CA4INT'
}

(async () => {
    let courses: Course[] = [];
    let results = PREFIXES.map(async prefix =>
        axios
            .get(`https://gradcatalog.uconn.edu/course-descriptions/course/${prefix}/`)
            .then(res => res.data)
            .then(res => ({ prefix, html: cheerio.load(res) }))
            .catch(_ => null));

    let courseNames: string[] = [];
    let catalogNames: string[] = [];
    let category: { prefix: string, html: cheerio.Root }[] = await Promise.all(results);
    for (let { prefix, html: $ } of category) {
        if (!$) continue;
        $('.single-course > h3')
            .each(i => {
                courseNames.push(prefix +
                    $(`.single-course > h3:nth-of-type(${i + 1})`)
                        .text()
                        .split('.')[0]);

                catalogNames.push($('.single-course > h3:nth-of-type(' + (i + 1) + ')')
                    .text()
                    .split('.')[1]
                    .trim());
            });
    }

    console.log(`[*] Ready to generate mappings for ${courseNames.length.toLocaleString()} courses.`);
    let bar = new progress(':course [:bar] :rate/rps :etas (:current/:total) (:percent done)', {
        complete: '=',
        incomplete: ' ',
        width: 20,
        total: courseNames.length
    });

    for (let courseName of courseNames) {
        let payload = await searchCourse(courseName, 'any', false, []);
        if (!payload) {
            console.log(`[!] Could not find course ${courseName}`);
            continue;
        }
        
        let course: Course = {
            name: courseName,
            catalogName: catalogNames[courseNames.indexOf(courseName)],
            catalogNumber: courseName.split(/(\d{3,4})/)[1],
            prerequisites: payload.prereqs ?? 'There are no prerequisites for this course.',
            attributes: {
                lab: false,
                writing: false,
                quantitative: false,
                environmental: false,
                contentAreas: [],
                graduate: true
            },
            credits: parseInt(payload.credits),
            grading: payload.grading,
            description: payload.description ?? 'There is no description for this course.'
        };

        courses.push(course);
        bar.tick({ course: courseName });
    }

    fs.writeFileSync('courses-grad.json', JSON.stringify(courses, null, 3));
    console.log(`[*] Done generating mappings for ${courseNames.length.toLocaleString()} courses.`);
})();