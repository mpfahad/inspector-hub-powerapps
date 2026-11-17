-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "externalSubject" TEXT,
    "identityProvider" TEXT NOT NULL DEFAULT 'local',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserDepartmentAccess" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "departmentId" INTEGER NOT NULL,
    CONSTRAINT "UserDepartmentAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserDepartmentAccess_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Department" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "managerEmail" TEXT
);

-- CreateTable
CREATE TABLE "Client" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "location" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "contact" TEXT,
    "email" TEXT
);

-- CreateTable
CREATE TABLE "Inspector" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "userId" INTEGER,
    "departmentId" INTEGER NOT NULL,
    "baseLocation" TEXT,
    "jobTitle" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "hireDate" DATETIME,
    "yearsExperience" INTEGER NOT NULL DEFAULT 0,
    "weeklyCapacityHrs" REAL NOT NULL DEFAULT 40,
    "dailyCostUsd" REAL,
    "dailyBillableUsd" REAL,
    "qeApproved" BOOLEAN NOT NULL DEFAULT false,
    "highestQualification" TEXT,
    CONSTRAINT "Inspector_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Inspector_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Certification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "validityMonths" INTEGER
);

-- CreateTable
CREATE TABLE "JobType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "departmentId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "defaultPriceUsd" REAL,
    CONSTRAINT "JobType_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PriceChart" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobTypeId" INTEGER,
    "priceUsd" REAL NOT NULL,
    "updatedByEmail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PriceChart_jobTypeId_fkey" FOREIGN KEY ("jobTypeId") REFERENCES "JobType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JobTypeCertRequirement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobTypeId" INTEGER NOT NULL,
    "certificationId" INTEGER NOT NULL,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "JobTypeCertRequirement_jobTypeId_fkey" FOREIGN KEY ("jobTypeId") REFERENCES "JobType" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JobTypeCertRequirement_certificationId_fkey" FOREIGN KEY ("certificationId") REFERENCES "Certification" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InspectorCert" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "inspectorId" INTEGER NOT NULL,
    "certificationId" INTEGER NOT NULL,
    "issuedOn" DATETIME NOT NULL,
    "expiresOn" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Valid',
    CONSTRAINT "InspectorCert_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "Inspector" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InspectorCert_certificationId_fkey" FOREIGN KEY ("certificationId") REFERENCES "Certification" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InspectorCostHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "inspectorId" INTEGER NOT NULL,
    "dailyCostUsd" REAL,
    "dailyBillableUsd" REAL,
    "changedByEmail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InspectorCostHistory_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "Inspector" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Qualification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "body" TEXT,
    "level" TEXT
);

-- CreateTable
CREATE TABLE "Job" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ref" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "jobTypeId" INTEGER,
    "scope" TEXT,
    "location" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "priority" TEXT NOT NULL DEFAULT 'Normal',
    "estimatedHours" REAL NOT NULL DEFAULT 40,
    "requiredInspectorCount" INTEGER NOT NULL DEFAULT 1,
    "autoCompleteOnEndDate" BOOLEAN NOT NULL DEFAULT true,
    "rateBasis" TEXT NOT NULL DEFAULT 'day',
    "requiresQeApproval" BOOLEAN NOT NULL DEFAULT false,
    "latitude" REAL,
    "longitude" REAL,
    "agreedPriceUsd" REAL,
    "closingComments" TEXT,
    "completedAt" DATETIME,
    "completedByEmail" TEXT,
    "managerApprovalComment" TEXT,
    "approvedAt" DATETIME,
    "approvedByEmail" TEXT,
    "createdByEmail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Job_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Job_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Job_jobTypeId_fkey" FOREIGN KEY ("jobTypeId") REFERENCES "JobType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JobCertRequirement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobId" INTEGER NOT NULL,
    "certificationId" INTEGER NOT NULL,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "JobCertRequirement_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JobCertRequirement_certificationId_fkey" FOREIGN KEY ("certificationId") REFERENCES "Certification" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssignmentProposal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobId" INTEGER NOT NULL,
    "inspectorId" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "blockReasons" TEXT,
    "warnings" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssignmentProposal_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssignmentProposal_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "Inspector" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobId" INTEGER NOT NULL,
    "inspectorId" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Lead',
    "allocatedHours" REAL NOT NULL DEFAULT 40,
    "status" TEXT NOT NULL DEFAULT 'Proposed',
    "rejectReason" TEXT,
    "createdByEmail" TEXT,
    "decidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mobDate" DATETIME,
    "demobDate" DATETIME,
    "dailyCostUsd" REAL,
    "dailyBillableUsd" REAL,
    CONSTRAINT "Assignment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Assignment_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "Inspector" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssignmentResponse" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "assignmentId" INTEGER NOT NULL,
    "accepted" BOOLEAN NOT NULL,
    "reason" TEXT,
    "respondedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userEmail" TEXT,
    CONSTRAINT "AssignmentResponse_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobId" INTEGER NOT NULL,
    "inspectorId" INTEGER NOT NULL,
    "logDate" DATETIME NOT NULL,
    "hours" REAL NOT NULL,
    "productiveHours" REAL NOT NULL,
    "narrative" TEXT,
    "qualityScore" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActivityLog_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "Inspector" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "inspectorId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "reason" TEXT,
    "createdByEmail" TEXT,
    "updatedByEmail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeaveRequest_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "Inspector" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Timesheet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ref" TEXT NOT NULL,
    "jobId" INTEGER,
    "inspectorId" INTEGER NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Submitted',
    "generatedByEmail" TEXT,
    "inspectorComments" TEXT,
    "totalHours" REAL NOT NULL DEFAULT 0,
    "totalProductiveHours" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Timesheet_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Timesheet_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "Inspector" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimesheetLine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timesheetId" INTEGER NOT NULL,
    "logDate" DATETIME NOT NULL,
    "hours" REAL NOT NULL,
    "productiveHours" REAL NOT NULL,
    "description" TEXT,
    CONSTRAINT "TimesheetLine_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JobStatusHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobId" INTEGER NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "note" TEXT,
    "userEmail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobStatusHistory_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER,
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userEmail" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_externalSubject_key" ON "User"("externalSubject");

-- CreateIndex
CREATE INDEX "UserDepartmentAccess_userId_idx" ON "UserDepartmentAccess"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserDepartmentAccess_userId_departmentId_key" ON "UserDepartmentAccess"("userId", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Inspector_employeeNo_key" ON "Inspector"("employeeNo");

-- CreateIndex
CREATE UNIQUE INDEX "Inspector_userId_key" ON "Inspector"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Certification_code_key" ON "Certification"("code");

-- CreateIndex
CREATE INDEX "JobType_departmentId_idx" ON "JobType"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "JobType_departmentId_code_key" ON "JobType"("departmentId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "PriceChart_jobTypeId_key" ON "PriceChart"("jobTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "Job_ref_key" ON "Job"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "Timesheet_ref_key" ON "Timesheet"("ref");

