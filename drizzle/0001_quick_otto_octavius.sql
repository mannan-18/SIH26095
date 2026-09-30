CREATE TABLE `assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inspectionId` int NOT NULL,
	`inspectorId` int NOT NULL,
	`state` enum('SEALED','REVEALED','RECUSED') NOT NULL DEFAULT 'SEALED',
	`algorithmVersion` varchar(80) NOT NULL,
	`eligibilitySnapshot` json NOT NULL,
	`sealedAt` timestamp NOT NULL DEFAULT (now()),
	`revealedAt` timestamp,
	CONSTRAINT `assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int,
	`action` varchar(120) NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`entityId` varchar(80) NOT NULL,
	`metadata` json,
	`previousHash` varchar(64),
	`currentHash` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `evidence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inspectionId` int NOT NULL,
	`publicId` varchar(48) NOT NULL,
	`storageKey` varchar(255) NOT NULL,
	`originalFilename` varchar(255) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`byteLength` int NOT NULL,
	`sha256` varchar(64) NOT NULL,
	`status` enum('VERIFIED','REVIEW','TAMPERED') NOT NULL DEFAULT 'REVIEW',
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`capturedAt` timestamp,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `evidence_id` PRIMARY KEY(`id`),
	CONSTRAINT `evidence_publicId_unique` UNIQUE(`publicId`)
);
--> statement-breakpoint
CREATE TABLE `inspections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(48) NOT NULL,
	`instituteId` int NOT NULL,
	`priority` enum('NORMAL','HIGH','CRITICAL') NOT NULL DEFAULT 'NORMAL',
	`status` enum('QUEUED','ASSIGNED','IN_PROGRESS','CLOSED') NOT NULL DEFAULT 'QUEUED',
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inspections_id` PRIMARY KEY(`id`),
	CONSTRAINT `inspections_publicId_unique` UNIQUE(`publicId`)
);
--> statement-breakpoint
CREATE TABLE `inspectors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`displayName` varchar(140) NOT NULL,
	`region` varchar(100) NOT NULL,
	`workload` int NOT NULL DEFAULT 0,
	`active` int NOT NULL DEFAULT 1,
	`conflictDeclaration` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inspectors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `institutes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`address` text NOT NULL,
	`latitude` decimal(10,7) NOT NULL,
	`longitude` decimal(10,7) NOT NULL,
	`geofenceRadiusM` int NOT NULL DEFAULT 250,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `institutes_id` PRIMARY KEY(`id`)
);
