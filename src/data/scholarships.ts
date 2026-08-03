import type { Scholarship } from '../types'

const documents = ['CV', 'Personal statement', 'Academic transcript', 'Recommendation letters', 'Passport']

export const scholarships: Scholarship[] = [
  ['chevening','Chevening Scholarship','UK Government','United Kingdom','Any eligible UK university','One-year taught master\'s','Master','All fields','Fully funded','Government','Leadership potential, work experience, and a strong post-study impact plan.','2026-11-03','https://www.chevening.org/scholarships/',96,true],
  ['erasmus-mundus','Erasmus Mundus Joint Masters','European Union','Europe','Partner university consortium','Joint master\'s programs','Master','All fields','Fully funded','International','Bachelor\'s degree and admission eligibility for the selected joint master.','2027-01-15','https://education.ec.europa.eu/','93',true],
  ['australia-awards','Australia Awards Scholarships','Australian Government','Australia','Participating Australian university','Development-focused programs','Master','Public Policy','Fully funded','Government','Citizens of participating countries with relevant experience and development goals.','2027-04-30','https://www.dfat.gov.au/people-to-people/australia-awards',91,true],
  ['fulbright','Fulbright Foreign Student Program','U.S. Department of State','United States','Accredited U.S. university','Graduate study and research','Master','All fields','Fully funded','Government','Academic excellence, leadership, English proficiency, and home-country commitment.','2027-02-18','https://foreign.fulbrightonline.org/',89,true],
  ['daad-epos','DAAD EPOS Scholarship','DAAD','Germany','Selected German universities','Development-related postgraduate courses','Master','Sustainable Development','Fully funded','Government','At least two years of professional experience in a development-related field.','2026-10-31','https://www.daad.de/en/',88,false],
  ['mext','MEXT Research Scholarship','Government of Japan','Japan','Japanese national universities','Research and graduate study','Postgraduate','Research','Fully funded','Government','Research proposal, academic standing, and embassy or university recommendation.','2027-05-10','https://www.studyinjapan.go.jp/en/',86,false],
  ['gates-cambridge','Gates Cambridge Scholarship','Gates Cambridge Trust','United Kingdom','University of Cambridge','Postgraduate degree','Postgraduate','All fields','Fully funded','University','Outstanding intellectual ability, leadership, and commitment to improving lives.','2026-12-03','https://www.gatescambridge.org/',84,false],
  ['orange-tulip','Orange Tulip Scholarship','Nuffic','Netherlands','Participating Dutch institutions','Selected degree programs','Master','Business','Partial funding','International','Nationality and admission requirements vary by participating institution.','2027-03-01','https://www.studyinnl.org/',82,false],
  ['swedish-institute','SI Scholarship for Global Professionals','Swedish Institute','Sweden','Eligible Swedish universities','Eligible master\'s programs','Master','Social Sciences','Fully funded','Government','Documented work and leadership experience from an eligible country.','2027-02-25','https://si.se/en/apply/scholarships/',80,false],
  ['korea-gks','Global Korea Scholarship','NIIED','South Korea','Participating Korean universities','Graduate degree programs','Master','STEM','Fully funded','Government','Strong academic record, age eligibility, and embassy or university nomination.','2027-03-20','https://www.studyinkorea.go.kr/',79,false],
  ['lpdp','LPDP Scholarship','Indonesia Endowment Fund for Education','Indonesia / Global','Approved global universities','Master\'s and doctoral study','Postgraduate','All fields','Fully funded','Government','Indonesian citizens with academic merit, service orientation, and return commitment.','2027-01-31','https://lpdp.kemenkeu.go.id/',95,true],
  ['new-zealand-manaaki','Manaaki New Zealand Scholarship','New Zealand Government','New Zealand','Approved New Zealand institutions','Development priority subjects','Postgraduate','Climate & Environment','Fully funded','Government','Eligible-country citizenship, relevant experience, and development impact potential.','2027-02-28','https://www.nzscholarships.govt.nz/',77,false],
].map((row) => ({
  id: String(row[0]), name: String(row[1]), provider: String(row[2]), country: String(row[3]), university: String(row[4]),
  program: String(row[5]), educationLevel: String(row[6]), fieldOfStudy: String(row[7]), fundingType: String(row[8]),
  scholarshipType: String(row[9]), eligibilitySummary: String(row[10]), deadline: String(row[11]), applicationUrl: String(row[12]),
  requiredDocuments: documents, matchPercentage: Number(row[13]), featured: Boolean(row[14]),
}))

export const getScholarship = (id: string) => scholarships.find((item) => item.id === id)
