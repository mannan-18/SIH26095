CREATE TABLE `assignment_claims` (
	`inspectionId` varchar(96) NOT NULL,
	`claimId` varchar(96) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assignment_claims_inspectionId` PRIMARY KEY(`inspectionId`),
	CONSTRAINT `assignment_claims_claimId_unique` UNIQUE(`claimId`)
);
