CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"body" text NOT NULL
);
