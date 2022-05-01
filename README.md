# FriendGroup
Group Posts by tags and control who can see them

How to Run:

1. Unzip and place both folders alongside eachother in the same directory
2. Create a .env file if one doesn't already exist with the given information This zip will have them all:

PG_HOST=localhost
PORT=5432
PG_DATABASE=friendgrouptestdb
PG_USERNAME=postgres
PG_PASS=ReiAyanami01
PG_POST_LIMIT=10
PG_POST_OFFSET=0

3. Go to pgadmin and run the following scripts in descending order:
-- Database: friendgrouptestdb

-- DROP DATABASE friendgrouptestdb;

CREATE DATABASE friendgrouptestdb
    WITH 
    OWNER = postgres
    ENCODING = 'UTF8'
    LC_COLLATE = 'English_United States.1252'
    LC_CTYPE = 'English_United States.1252'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1;

COMMENT ON DATABASE friendgrouptestdb
    IS 'friendgroup app test db';

---------------------------------------------------------

-- Table: public.fellowrequests

-- DROP TABLE public.fellowrequests;

CREATE TABLE public.fellowrequests
(
    id integer NOT NULL DEFAULT nextval('fellowrequests_id_seq'::regclass),
    "publisherId" character varying(64) COLLATE pg_catalog."default" NOT NULL,
    "subscriberId" character varying(64) COLLATE pg_catalog."default" NOT NULL,
    "dateTimeCreated" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT fellowrequests_pkey PRIMARY KEY (id)
)

TABLESPACE pg_default;

ALTER TABLE public.fellowrequests
    OWNER to postgres;

---------------------------------------------------------

-- Table: public.fellowships

-- DROP TABLE public.fellowships;

CREATE TABLE public.fellowships
(
    id integer NOT NULL DEFAULT nextval('fellowships_id_seq'::regclass),
    "publisherId" character varying(64) COLLATE pg_catalog."default" NOT NULL,
    "subscriberId" character varying(64) COLLATE pg_catalog."default" NOT NULL,
    "tagId" character varying(64) COLLATE pg_catalog."default" NOT NULL,
    "dateTimeCreated" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT fellowships_pkey PRIMARY KEY (id)
)

TABLESPACE pg_default;

ALTER TABLE public.fellowships
    OWNER to postgres;

---------------------------------------------------------

-- Table: public.images

-- DROP TABLE public.images;

CREATE TABLE public.images
(
    id character varying(64) COLLATE pg_catalog."default" NOT NULL,
    "userId" character varying(64) COLLATE pg_catalog."default" NOT NULL,
    "postId" character varying(64) COLLATE pg_catalog."default",
    "fileName" character varying(64) COLLATE pg_catalog."default" NOT NULL,
    "filePath" character varying(64) COLLATE pg_catalog."default" NOT NULL,
    "isProfilePicture" boolean NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT images_pkey PRIMARY KEY (id),
    CONSTRAINT "images_fileName_key" UNIQUE ("fileName")
)

TABLESPACE pg_default;

ALTER TABLE public.images
    OWNER to postgres;

---------------------------------------------------------

-- Table: public.posts

-- DROP TABLE public.posts;

CREATE TABLE public.posts
(
    id character varying(64) COLLATE pg_catalog."default" NOT NULL,
    "userId" character varying(64) COLLATE pg_catalog."default" NOT NULL,
    "dateTimePosted" timestamp with time zone NOT NULL,
    "dateTimeDeleted" timestamp with time zone,
    "isDeleted" boolean NOT NULL,
    content character varying(256) COLLATE pg_catalog."default" NOT NULL,
    tags text[] COLLATE pg_catalog."default" NOT NULL DEFAULT ARRAY[]::text[],
    cheers integer NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT posts_pkey PRIMARY KEY (id)
)

TABLESPACE pg_default;

ALTER TABLE public.posts
    OWNER to postgres;

---------------------------------------------------------

-- Table: public.tags

-- DROP TABLE public.tags;

CREATE TABLE public.tags
(
    id character varying(64) COLLATE pg_catalog."default" NOT NULL,
    name character varying(64) COLLATE pg_catalog."default" NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT tags_pkey PRIMARY KEY (id)
)

TABLESPACE pg_default;

ALTER TABLE public.tags
    OWNER to postgres;

---------------------------------------------------------

INSERT INTO public.tags(
	id, name, "createdAt", "updatedAt")
	VALUES (1,'Me',NOW(),NOW()),(
2,'Personal',NOW(),NOW()),(
3,'Friends',NOW(),NOW()),(
4,'Medical',NOW(),NOW()),(
5,'Fitness',NOW(),NOW()),(
6,'Educational',NOW(),NOW()),(
7,'Recreational',NOW(),NOW()),(
8,'Work',NOW(),NOW()),(
9,'Gaming',NOW(),NOW()),(
10,'Film',NOW(),NOW()),(
11,'Recovery',NOW(),NOW()),(
12,'Public',NOW(),NOW());

---------------------------------------------------------

-- Table: public.tokens

-- DROP TABLE public.tokens;

CREATE TABLE public.tokens
(
    id character varying(128) COLLATE pg_catalog."default" NOT NULL,
    "userId" character varying(64) COLLATE pg_catalog."default" NOT NULL,
    creation timestamp with time zone NOT NULL,
    expiration integer NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT tokens_pkey PRIMARY KEY (id),
    CONSTRAINT tokens_creation_key UNIQUE (creation)
)

TABLESPACE pg_default;

ALTER TABLE public.tokens
    OWNER to postgres;

---------------------------------------------------------

-- Table: public.users

-- DROP TABLE public.users;

CREATE TABLE public.users
(
    id character varying(64) COLLATE pg_catalog."default" NOT NULL,
    username character varying(64) COLLATE pg_catalog."default" NOT NULL,
    password character varying(64) COLLATE pg_catalog."default" NOT NULL,
    email character varying(64) COLLATE pg_catalog."default" NOT NULL,
    "dateTimeCreated" timestamp with time zone NOT NULL,
    friends text[] COLLATE pg_catalog."default" NOT NULL DEFAULT ARRAY[]::text[],
    tags text[] COLLATE pg_catalog."default" NOT NULL DEFAULT ARRAY[]::text[],
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    searchable boolean DEFAULT true,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_key UNIQUE (email),
    CONSTRAINT users_username_key UNIQUE (username)
)

TABLESPACE pg_default;

ALTER TABLE public.users
    OWNER to postgres;