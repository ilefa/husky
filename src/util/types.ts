export type CompleteCoursePayload = {
    name: string;
    catalogName: string;
    catalogNumber: string;
    attributes: CourseAttributes;
    grading: string;
    credits: number;
    prerequisites: string;
    description: string;
    sections: SectionData[];
    professors: ProfessorData[];
}

export type CourseAttributes = {
    lab: boolean;
    writing: boolean;
    quantitative: boolean;
    environmental: boolean;
    contentAreas: ContentArea[];
}

export type CourseMapping = {
    name: string;
    catalogName: string;
    catalogNumber: string;
    prerequisites: string;
    attributes: CourseAttributes & { graduate: boolean }; 
    credits: number;
    grading: string;
    description: string;
}

export enum ContentArea {
    CA1 = 'CA1',
    CA2 = 'CA2',
    CA3 = 'CA3',
    CA4 = 'CA4',
    CA4INT = 'CA4INT'
}

export enum ContentAreaNames {
    CA1 = 'Arts and Humanities',
    CA2 = 'Social Sciences',
    CA3 = 'Science and Technology',
    CA4 = 'Diversity and Multiculturalism',
    CA4INT = 'Diversity and Multiculturalism (International)'
}

export enum GradingTypeNames {
    GRADED = 'Graded',
    SATISFACTORY_UNSATISFACTORY = 'S/U',
    HONORS_CREDIT = 'Honors',
    REGISTERED = 'Registered'
}

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
    session: string;
    schedule: string;
    location: SectionLocationData[];
    enrollment: {
        max: number;
        current: number;
        waitlist?: number;
        full: boolean;
    }
    notes: string;
}

export type SectionLocationData = {
    name: string;
    url?: string;
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

export type RmpGraphQlEdge<T> = {
    edges: Array<{ node: T }>;
}

export type RmpReport = {
    avgRating: number;
    avgDifficultyRounded: number;
    wouldTakeAgainPercent: number;
    numRatings: number;
    teacherRatingTags: Array<{ tagName: string }>;
    courseCodes: Array<{ courseName: string, courseCount: number }>;
    firstName: string;
    lastName: string;
    ratings: RmpGraphQlEdge<RmpRating>;
}

export type RmpRating = {
    attendanceMandatory: string;
    clarityRating: number;
    class: string;
    comment: string;
    date: string;
    difficultyRating: number;
    grade: string;
    helpfulRating: number;
    id: string;
    isForCredit: boolean;
    isForOnlineClass: boolean;
    legacyId: number;
    ratingTags: string;
    thumbsDownTotal: number;
    thumbsUpTotal: number;
    wouldTakeAgain: number;
}

export enum UConnService {
    AURORA = 'Aurora',
    EMAIL = 'Email',
    HUSKYCT = 'HuskyCT',
    KFS = 'KFS',
    NETID = 'NetID',
    NETWORK = 'Network',
    ONEDRIVE = 'OneDrive/SharePoint',
    STUDENT_ADMIN = 'Student Admin',
    TEAMS = 'Teams',
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
        campus: string;
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
