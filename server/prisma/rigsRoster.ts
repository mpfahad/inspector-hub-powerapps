/**
 * RIG Inspection (Onshore) HR roster — Cost center 3126000112.
 * Employee No uses Order Number (VEQE…) to align with existing Applus IDs.
 * Termination 31-Dec-99 treated as active (no end date).
 */

export type RigsEmployee = {
  employeeNo: string;
  hrEmployeeNo: string;
  name: string;
  jobTitle: string;
  engagementDate: string; // YYYY-MM-DD
  wbsProjectCode: string;
  costCenter: string;
  /** Provisional QAR day rates until Admin sets real CTC. */
  dailyCostUsd: number;
  dailyBillableUsd: number;
};

function parseHrDate(raw: string): string {
  // e.g. 15-Dec-21 → 2021-12-15
  const m = raw.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
  if (!m) throw new Error(`Bad date: ${raw}`);
  const months: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
  };
  const mon = months[m[2]];
  if (!mon) throw new Error(`Bad month: ${raw}`);
  const yy = Number(m[3]);
  const year = yy >= 70 ? 1900 + yy : 2000 + yy;
  const day = m[1].padStart(2, '0');
  return `${year}-${mon}-${day}`;
}

function row(
  hrEmployeeNo: string,
  name: string,
  jobTitle: string,
  engagement: string,
  wbs: string,
  orderNo: string,
  cost = 150,
  billable = 205
): RigsEmployee {
  return {
    employeeNo: orderNo.trim(),
    hrEmployeeNo,
    name: name.trim(),
    jobTitle: jobTitle.trim(),
    engagementDate: parseHrDate(engagement),
    wbsProjectCode: wbs,
    costCenter: '3126000112',
    dailyCostUsd: cost,
    dailyBillableUsd: billable,
  };
}

/** Rope access / lifting stream — WBS CV-005524-001 */
const WBS_ROPE = 'CV-005524-001';
/** Electrical CompEx stream — WBS CV-006711-001 */
const WBS_EX = 'CV-006711-001';

export const RIGS_EMPLOYEES: RigsEmployee[] = [
  row('E3862', 'Rajesh Kannan', 'Rope Access Level III Supervisor', '15-Dec-21', WBS_ROPE, 'VEQE3862', 200, 275),
  row('E3863', 'Syed Apsardeen Mohamed Sithick', 'Rope Access Level III Supervisor', '25-Oct-21', WBS_ROPE, 'VEQE3863', 200, 275),
  row('E3958', 'Dhilipkumar Ramalingam', 'Multi Disciplined Rope Technician', '15-Dec-21', WBS_ROPE, 'VEQE3958'),
  row('E3959', 'Hari Kumaran Kannan', 'Multi Disciplined Rope Technician', '15-Dec-21', WBS_ROPE, 'VEQE3959'),
  row('E3960', 'Kanthavel Muniyandi', 'Multi Disciplined Rope Technician', '25-Oct-21', WBS_ROPE, 'VEQE3960'),
  row('E3961', 'Maheswaran Arumugam Ganesan', 'Multi Disciplined Rope Technician', '15-Dec-21', WBS_ROPE, 'VEQE3961'),
  row('E3962', 'Murugan Muniyandi', 'Multi Disciplined Rope Technician', '25-Oct-21', WBS_ROPE, 'VEQE3962'),
  row('E3963', 'Satham Hussain Jahir Hussain', 'Multi Disciplined Rope Technician', '15-Dec-21', WBS_ROPE, 'VEQE3963'),
  row('E4127', 'Sivanesan Thirumavalavan', 'Multi Disciplined Gear Inspector', '01-Jan-25', WBS_ROPE, 'VEQE4127'),
  row('E4140', 'Veeramani Murugesan', 'Multi Disciplined Rope Technician', '03-Jul-22', WBS_ROPE, 'VEQE4140'),
  row('E4198', 'Udaya Kumar Paulraj', 'Lifting Inspector', '01-Nov-22', WBS_ROPE, 'VEQE4198'),
  row('E4219', 'Aju Joseph', 'Lifting Equipment Inspection Engineer', '30-Dec-22', WBS_ROPE, 'VEQE4219', 200, 275),
  row('E4385', 'Akshay Viswanath', 'Multi Disciplined Rope Technician', '30-Aug-23', WBS_ROPE, 'VEQE4385'),
  row('E4494', 'Lester Alwyn Pais', 'Project Coordinator', '07-Oct-23', WBS_ROPE, 'VEQE4494', 180, 250),
  row('E4495', 'Vignesh Murugesan', 'Multi Disciplined Rope Technician', '08-Oct-23', WBS_ROPE, 'VEQE4495'),
  row('E4515', 'Akash Magimairaj', 'Multi Disciplined Rope Technician', '23-Oct-23', WBS_ROPE, 'VEQE4515'),
  row('E4527', 'Unnikuttan Gopakumar', 'Multi Disciplined Rope Technician', '02-Nov-23', WBS_ROPE, 'VEQE4527'),
  row('E4532', 'Vishnu Malayamkandathil', 'Multi Disciplined Rope Technician', '07-Nov-23', WBS_ROPE, 'VEQE4532'),
  row('E4533', 'Gokulraj Gopi', 'Multi Disciplined Rope Technician', '08-Nov-23', WBS_ROPE, 'VEQE4533'),
  row('E4596', 'Zerij Naranath', 'Supervisor', '30-Nov-23', WBS_ROPE, 'VEQE4596', 200, 275),
  row('E4603', 'Sanal Kulathumana Ravi', 'Supervisor', '04-Dec-23', WBS_ROPE, 'VEQE4603', 200, 275),
  row('E4678', 'Einstein Jesupatham', 'Multi Disciplined Rope Technician', '19-Dec-23', WBS_ROPE, 'VEQE4678'),
  row('E4679', 'Santhosh Daniel', 'Supervisor', '19-Dec-23', WBS_ROPE, 'VEQE4679', 200, 275),
  row('E4711', 'Joyal Jose', 'Multi Disciplined Rope Technician', '31-Dec-23', WBS_ROPE, 'VEQE4711'),

  row('E2302', 'Shihariraju Yarakaraju', 'Electrical Compex Inspector', '30-Mar-22', WBS_EX, 'VEQE2302'),
  row('E2430', 'Durai Narasimhan', 'Rope Access CompEx Inspector', '13-Jun-22', WBS_EX, 'VEQE2430R'),
  row('E3085', 'Nisha Kaushik Roy', 'Project Coordinator', '01-Feb-21', WBS_EX, 'VEQE3085', 180, 250),
  row('E3956', 'Soe Hlaing', 'Electrical Compex Inspector', '13-Apr-21', WBS_EX, 'VEQE3956'),
  row('E4011', 'Adhinarayanan Raju', 'Electrical Compex Inspector', '18-Jul-21', WBS_EX, 'VEQE4011'),
  row('E4094', 'Pattabhi Rama Rao Saka', 'Electrical Compex Inspector', '08-Jan-22', WBS_EX, 'VEQE4094'),
  row('E4129', 'Sasikumar Rajendran', 'Electrical Compex Inspector', '19-Jun-22', WBS_EX, 'VEQE4129'),
  row('E4182', 'Raghu Rama Raju Nagaraju', 'Electrical Compex Inspector', '20-Oct-22', WBS_EX, 'VEQE4182'),
  row('E4841', 'Vinith Pragash Antony Gerald', 'Electrical Compex Inspector', '21-Oct-24', WBS_EX, 'VEQE4841'),
  row('E4879', 'Sri Rama Chandra Murthy Tatavarthi', 'Electrical Compex Inspector', '16-Nov-24', WBS_EX, 'VEQE4879'),
  row('E4898', 'Jegathesan Muthusamy', 'Electrical Compex Inspector', '28-Nov-24', WBS_EX, 'VEQE4898'),
  row('E4910', 'Abdul Salam Areekattil', 'Ex Onshore Coordinator', '12-Oct-24', WBS_EX, 'VEQE4910', 200, 275),
  row('E4923', 'Asai Thambi Tamilmani', 'Electrical Compex Inspector', '14-Jan-25', WBS_EX, 'VEQE4923'),
  row('E4926', 'Anand Ravi', 'Electrical Compex Inspector', '28-Jan-25', WBS_EX, 'VEQE4926'),
  row('E4933', 'Pringalkumar Anilbhai Patel', 'Electrical Compex Inspector', '06-Feb-25', WBS_EX, 'VEQE4933'),
  row('E4940', 'Adityakumar Sureshbhai Patel', 'Electrical Compex Inspector', '01-Mar-25', WBS_EX, 'VEQE4940'),
  row('E4948', 'Srinivasan Panchamoorthy', 'Electrical Compex Inspector', '26-Mar-25', WBS_EX, 'VEQE4948'),
  row('E5109', 'Sujan Thangaswamy', 'Electrical Compex Inspector', '26-Nov-25', WBS_EX, 'VEQE5109'),
  row('E5111', 'Raja Srinivasan', 'Electrical Compex Inspector', '26-Nov-25', WBS_EX, 'VEQE5111'),
  row('E5117', 'Shibu Sivaprasad', 'Electrical Compex Inspector', '16-Dec-25', WBS_EX, 'VEQE5117'),
  row('E5118', 'Valan Jeyasingh Durai Siluvai Gnana Pragasam', 'Electrical Compex Inspector', '17-Dec-25', WBS_EX, 'VEQE5118'),
  row('E5119', 'Pinalkumar Madhubhai Patel', 'Electrical Compex Inspector', '20-Dec-25', WBS_EX, 'VEQE5119'),
  row('E5127', 'Srinivas Veeray', 'Electrical Compex Inspector', '29-Dec-25', WBS_EX, 'VEQE5127'),
  row('E5128', 'Wesley Gnanaraj Arul Jothi', 'Electrical Compex Inspector', '29-Dec-25', WBS_EX, 'VEQE5128'),
  row('E5129', 'Michael Chinnaraja Gnanapandian', 'Electrical Compex Inspector', '29-Dec-25', WBS_EX, 'VEQE5129'),
  row('E5130', 'Meshak Michael George', 'Electrical Compex Inspector', '29-Dec-25', WBS_EX, 'VEQE5130'),
  row('E5131', 'Pushpanathan Arumugam', 'Electrical Compex Inspector', '29-Dec-25', WBS_EX, 'VEQE5131'),
  row('E5132', 'Vishnu Mohanan', 'Electrical Compex Inspector', '29-Dec-25', WBS_EX, 'VEQE5132'),
  row('E5139', 'Sathish Sankar', 'Electrical Compex Inspector', '29-Jan-26', WBS_EX, 'VEQE5139'),
  row('E5140', 'Manikandan Elumalai', 'Electrical Compex Inspector', '22-Jan-26', WBS_EX, 'VEQE5140'),
  row('E5141', 'Uvaraj Dharmarajan', 'Electrical Compex Inspector', '22-Jan-26', WBS_EX, 'VEQE5141'),
  row('E5142', 'Vishnu Velayudhan', 'Electrical Compex Inspector', '23-Jan-26', WBS_EX, 'VEQE5142'),
  row('E5143', 'Siva Kannan', 'Electrical Compex Inspector', '28-Jan-26', WBS_EX, 'VEQE5143'),
  row('E5144', 'Pardhasaradhi Raju Narasimha', 'Electrical Compex Inspector', '31-Jan-26', WBS_EX, 'VEQE5144'),
];
