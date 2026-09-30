CREATE TABLE `domain_records` (
	`recordKey` varchar(160) NOT NULL,
	`entity` varchar(48) NOT NULL,
	`recordId` varchar(96) NOT NULL,
	`payload` json NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `domain_records_recordKey` PRIMARY KEY(`recordKey`)
);
