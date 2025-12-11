--
-- PostgreSQL database dump
--

\restrict lBgvA1vclj66WeNxi8lyGbgScGBeXbTu2STjfbSvR97nEfN1hhZO6frceyet36p

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: admin
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO admin;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: admin
--

COMMENT ON SCHEMA public IS '';


--
-- Name: Action; Type: TYPE; Schema: public; Owner: admin
--

CREATE TYPE public."Action" AS ENUM (
    'ALLOW',
    'DROP'
);


ALTER TYPE public."Action" OWNER TO admin;

--
-- Name: NodeType; Type: TYPE; Schema: public; Owner: admin
--

CREATE TYPE public."NodeType" AS ENUM (
    'HOST',
    'ROUTER',
    'SWITCH'
);


ALTER TYPE public."NodeType" OWNER TO admin;

--
-- Name: ProtocolType; Type: TYPE; Schema: public; Owner: admin
--

CREATE TYPE public."ProtocolType" AS ENUM (
    'TCP',
    'UDP',
    'ICMP',
    'ARP'
);


ALTER TYPE public."ProtocolType" OWNER TO admin;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO admin;

--
-- Name: firewall_rules; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.firewall_rules (
    "srcIp" character varying(15) NOT NULL,
    "dstIp" character varying(15) NOT NULL,
    priority integer NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    id uuid NOT NULL,
    protocol public."ProtocolType",
    action public."Action" NOT NULL,
    "nodeId" uuid NOT NULL
);


ALTER TABLE public.firewall_rules OWNER TO admin;

--
-- Name: links; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.links (
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    id uuid NOT NULL,
    "topologyId" uuid NOT NULL,
    "interfaceAId" uuid NOT NULL,
    "interfaceBId" uuid NOT NULL,
    "nodeAId" uuid NOT NULL,
    "nodeBId" uuid NOT NULL
);


ALTER TABLE public.links OWNER TO admin;

--
-- Name: network_interfaces; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.network_interfaces (
    ip character varying(15) NOT NULL,
    mask character varying(15) NOT NULL,
    cidr smallint NOT NULL,
    mac character varying(17) NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "broadcastAddress" character varying(15) NOT NULL,
    "networkAddress" character varying(15) NOT NULL,
    id uuid NOT NULL,
    "nodeId" uuid NOT NULL
);


ALTER TABLE public.network_interfaces OWNER TO admin;

--
-- Name: nodes; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.nodes (
    name character varying(255) NOT NULL,
    "positionX" double precision NOT NULL,
    "positionY" double precision NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    id uuid NOT NULL,
    type public."NodeType" NOT NULL,
    "topologyId" uuid NOT NULL,
    "defaultGateway" text
);


ALTER TABLE public.nodes OWNER TO admin;

--
-- Name: packet_logs; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.packet_logs (
    "srcIp" character varying(15) NOT NULL,
    "dstIp" character varying(15) NOT NULL,
    protocol character varying(10) NOT NULL,
    payload text,
    ttl smallint NOT NULL,
    history text NOT NULL,
    status character varying(20) NOT NULL,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    id uuid NOT NULL,
    "simulationId" uuid NOT NULL
);


ALTER TABLE public.packet_logs OWNER TO admin;

--
-- Name: routing_entries; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.routing_entries (
    destination character varying(15) NOT NULL,
    mask character varying(15) NOT NULL,
    cidr smallint NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    id uuid NOT NULL,
    "nodeId" uuid NOT NULL,
    "nextHopInterfaceId" uuid NOT NULL
);


ALTER TABLE public.routing_entries OWNER TO admin;

--
-- Name: simulation_sessions; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.simulation_sessions (
    name character varying(255),
    "autoPopulateARP" boolean DEFAULT false NOT NULL,
    "stepDelay" integer DEFAULT 1000 NOT NULL,
    status character varying(20) DEFAULT 'IDLE'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    id uuid NOT NULL,
    "topologyId" uuid NOT NULL
);


ALTER TABLE public.simulation_sessions OWNER TO admin;

--
-- Name: topologies; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.topologies (
    name character varying(255) NOT NULL,
    description text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    id uuid NOT NULL
);


ALTER TABLE public.topologies OWNER TO admin;

--
-- Name: users; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    password character varying(255) NOT NULL,
    email character varying(255) NOT NULL
);


ALTER TABLE public.users OWNER TO admin;

--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
5f910dac-ef12-4fa7-8293-6e40236d47d3	c662b5b5fc89de9e06797f5963d7ee98a37beda1dc7c07608e5ec7cb75888ef2	2025-11-23 21:23:43.970461+00	20251113193617_init	\N	\N	2025-11-23 21:23:43.940215+00	1
59705745-10ba-4078-bc37-6f8987629558	4b0f81cff7114e024d8b8bce0d5475390d9888cb0a9432dd9f30530132b3ea51	2025-11-23 21:23:44.028673+00	20251114231248_add_network_broadcast_addresses	\N	\N	2025-11-23 21:23:43.971397+00	1
901c7785-6e86-409c-a72e-acc15c3feea6	de9d9b3eca82d9f465c491f3f804cb7b1fc3c70cdfeec6dabbc38d8d5e4c264b	2025-11-23 21:23:44.033545+00	20251114231617_add_network_broadcast_addresses	\N	\N	2025-11-23 21:23:44.02921+00	1
0c1bff63-2be8-4e32-87c7-f510a8d46c69	c088904d2a88f977b0cea63e6e7f506cb9199c482858356c299078eee54da876	2025-11-23 21:23:44.039695+00	20251118194110_updated_user	\N	\N	2025-11-23 21:23:44.034112+00	1
\.


--
-- Data for Name: firewall_rules; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.firewall_rules ("srcIp", "dstIp", priority, "createdAt", id, protocol, action, "nodeId") FROM stdin;
\.


--
-- Data for Name: links; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.links ("createdAt", id, "topologyId", "interfaceAId", "interfaceBId", "nodeAId", "nodeBId") FROM stdin;
2025-12-10 23:41:24.907+00	031bd65c-3fc6-481e-8fa7-5254979a5cab	18172397-39c3-4148-aea0-c82271403dad	e2374cb7-d94e-43fa-8875-e487827a9698	b81d7e10-0d1c-4663-847f-b6948e28940d	0f701025-8280-4560-8090-a5390ea42e54	cf522103-18e6-46a8-abf9-9615a4122d38
2025-12-10 23:42:43.257+00	549f6177-a544-4c50-8def-2202a40daba7	18172397-39c3-4148-aea0-c82271403dad	f29c65b6-002b-4526-b22e-75fab4090d7b	a57ae043-40a6-4ba1-97f0-029450dd76bb	cf522103-18e6-46a8-abf9-9615a4122d38	eab0796f-85af-4711-8ae0-05ac6d18d8fa
2025-12-10 23:43:09.496+00	6c22fda9-9847-4d42-a930-f6028912c207	18172397-39c3-4148-aea0-c82271403dad	c8f4cda0-128d-498b-ada2-06d29dbcb445	16b66959-d167-4d18-a8de-f538bcbd4090	cf522103-18e6-46a8-abf9-9615a4122d38	facb6526-7f3d-4ffd-8ae3-e27b99239371
2025-12-10 23:43:42.778+00	8a35443d-95c8-4780-9512-cf9223ea836a	18172397-39c3-4148-aea0-c82271403dad	6b6af702-a279-4224-a3b9-42f941dd6de0	31b7a235-283c-4047-9f87-5dbc0206ebeb	cf522103-18e6-46a8-abf9-9615a4122d38	51a0853b-090c-427e-b02b-9aea601c1764
2025-12-11 01:43:22.381+00	17e7c17e-83b4-451c-a2c9-6d68a0ff00ea	0154693d-6b89-4d63-8604-f572f9299975	e4aafffb-d55b-456d-be12-0c5eb70c8ede	ea489971-d54c-497c-a576-ac932bb06bc5	c216143a-19ff-423d-aacd-75e13394a9ae	3fb7ffb0-d2a1-4425-8dde-27c05aa4dcd5
2025-12-11 01:43:34.898+00	a28ed260-a757-43ec-89ec-7f7529f01e4a	0154693d-6b89-4d63-8604-f572f9299975	5b140fdf-de6f-4013-8fe2-fabaa8dbe0c7	c12eaac4-ed72-4c4b-8a57-77fbf4aa0e68	c216143a-19ff-423d-aacd-75e13394a9ae	6332e544-8902-47df-a91e-c3758e844b18
2025-12-11 01:44:15.369+00	80c5b9dc-5495-42ff-a9c9-fdee780eff2e	0154693d-6b89-4d63-8604-f572f9299975	fc399801-5676-47a6-bfe7-250af5e5c066	96717def-18cf-46e0-869c-1bfa6484d4b6	3fb7ffb0-d2a1-4425-8dde-27c05aa4dcd5	3cc1915a-869c-4864-9077-c9329eb6eb7e
2025-12-11 01:44:27.482+00	2c95f262-1c8b-4a81-9c38-a1a7fb398414	0154693d-6b89-4d63-8604-f572f9299975	c276811c-d3e1-4efa-a362-d4157ecdbd47	31c9c406-c1dd-4372-b04c-994d1f50a4f1	3fb7ffb0-d2a1-4425-8dde-27c05aa4dcd5	eb986946-ad71-414a-8ca8-6c288d4952e1
2025-12-11 01:44:37.787+00	0238d1aa-365a-4882-a0a7-8d77b2cab66b	0154693d-6b89-4d63-8604-f572f9299975	507b59ce-f3d0-45a8-88a8-9d4516b20d46	81b3bf51-cccb-4e3a-9ceb-27b4f1252b10	3fb7ffb0-d2a1-4425-8dde-27c05aa4dcd5	fa48aec2-7ce0-4b9f-a7dd-620adec241f9
2025-12-11 01:45:09.268+00	5745126f-004f-4ff6-97c9-54a926889991	0154693d-6b89-4d63-8604-f572f9299975	5e5d19be-2f75-4c9f-a360-dd548da11c52	061d5177-93cf-4722-983a-5878d7be48d3	6332e544-8902-47df-a91e-c3758e844b18	2aadcc84-e063-4cb4-abcc-7e2b4e129671
2025-12-11 01:45:20.683+00	3c9c9233-7355-4771-8cef-12915e146011	0154693d-6b89-4d63-8604-f572f9299975	b50d1293-2510-4888-ba2a-73023e556d03	4813a7b8-573b-454b-93ed-5134193eb064	6332e544-8902-47df-a91e-c3758e844b18	e09ea110-751f-494e-abc0-ee0ff14ec920
2025-12-11 01:45:30.229+00	ffb3ad91-7af5-4b05-acf3-e664366fa314	0154693d-6b89-4d63-8604-f572f9299975	6b24c333-9caf-4f7d-ba8d-c57e1eba4809	d1102543-6fb1-49d7-9453-8626b4bd33f0	6332e544-8902-47df-a91e-c3758e844b18	29980c7c-144b-41b4-b39d-f831b7d2964b
2025-12-11 02:25:10.194+00	a18b3626-e124-42c3-922f-ba763093cbc6	fe77d2b4-3222-4c1c-9866-5048050f4d7e	2938fb9d-2d26-4ed7-8d96-e01fafb4399c	8e7ee566-55ac-4c1b-83c8-73c29b5443a9	99a962fa-5e94-493e-a5cb-b0e4f24a3bc5	a4f31938-a8e8-40cc-ad03-9a10b197d1a0
2025-12-11 02:27:49.152+00	ff91716e-64fb-428e-b600-59695debab0b	fe77d2b4-3222-4c1c-9866-5048050f4d7e	c7200795-4454-4f5b-9b8e-6f8c06b8cdf9	b7818c73-9759-4ba5-a9e4-7835709185a7	a4f31938-a8e8-40cc-ad03-9a10b197d1a0	024f5d7c-ce6e-439e-adbf-c0a409e32ad3
2025-12-11 02:27:59.879+00	eb87372a-116a-4374-83d1-ba75abe5db8c	fe77d2b4-3222-4c1c-9866-5048050f4d7e	319106c3-ca3a-41b6-bb74-26be9c754b7d	ab841872-9a28-4590-92ac-ed5333a496f1	a4f31938-a8e8-40cc-ad03-9a10b197d1a0	b4cbb059-305d-443f-ab51-515d47bb4851
2025-12-11 02:28:08.097+00	e71b274f-4c59-4f83-b817-a410ee497b35	fe77d2b4-3222-4c1c-9866-5048050f4d7e	4c0d4725-4a21-4123-9289-edda47dfe52a	06a5bffc-db8e-490c-a826-c4850190fb8b	a4f31938-a8e8-40cc-ad03-9a10b197d1a0	4188526a-f0c6-48d5-aef6-db7123723236
2025-12-11 02:28:54.728+00	a339c020-8632-4ed3-9d3f-ba6d3cbf9cc3	fe77d2b4-3222-4c1c-9866-5048050f4d7e	03695d75-ab88-451d-908c-b8276e296664	2bb3ed65-c806-4c00-be7e-10915f729bb3	a4f31938-a8e8-40cc-ad03-9a10b197d1a0	82f13f20-741d-4249-87fb-299642ca2cce
2025-12-11 02:29:53.279+00	3c54905e-b655-41c7-9f8f-175219b89107	fe77d2b4-3222-4c1c-9866-5048050f4d7e	c9bb6c7f-be81-4f26-a7ba-8dabfacb5449	638b7262-2004-4e76-baab-0641551cd349	82f13f20-741d-4249-87fb-299642ca2cce	0f9b8001-ca46-46b2-802d-70563bf2d87a
2025-12-11 02:36:06.319+00	93394ac8-ed02-46df-9fc8-19d08862f4f3	fe77d2b4-3222-4c1c-9866-5048050f4d7e	53fee481-f736-40b1-b8b5-0e7127ed280d	2b122056-073b-406e-a0f0-10d7b0b43d50	82f13f20-741d-4249-87fb-299642ca2cce	49d1ddc6-e49b-4508-be12-26eac7e23d33
2025-12-11 02:39:40.126+00	8b0238be-dd80-4f56-a844-fa13b57a85ba	fe77d2b4-3222-4c1c-9866-5048050f4d7e	2c0b4a50-1135-4ffe-81b8-d8d4dd60463d	e7c7ba2f-fcd8-4813-b745-6c6f18fc203e	0f9b8001-ca46-46b2-802d-70563bf2d87a	140db659-92b1-489e-a931-4cead37948a8
2025-12-11 02:39:51.019+00	847ffe36-f679-425a-b41d-0933fb7a71d3	fe77d2b4-3222-4c1c-9866-5048050f4d7e	5b0a1f63-33dc-4197-84d8-a3991b3c6684	15f2237a-8efc-4fd5-96ee-6381a526e3b4	0f9b8001-ca46-46b2-802d-70563bf2d87a	c08cef80-a910-4c01-a1c9-de71f65672db
2025-12-11 02:40:00.271+00	e02eba93-b73d-46f0-86e9-e2130b2ff24f	fe77d2b4-3222-4c1c-9866-5048050f4d7e	1c13ea33-13e0-40e9-b353-1632d953b559	38b9a4c4-706c-4a21-bcb9-914c9bf6e69c	0f9b8001-ca46-46b2-802d-70563bf2d87a	c02ba1e0-4ab5-4030-8742-1c766ca843b5
2025-12-11 02:40:26.838+00	87e7466c-a1a1-45e1-96f8-02ce955eca85	fe77d2b4-3222-4c1c-9866-5048050f4d7e	348a9655-9816-410a-b06f-bb37a756a9be	746cf51c-61e8-44dc-85a0-c0570778d004	49d1ddc6-e49b-4508-be12-26eac7e23d33	4de52b10-b9b0-4f60-92d6-d5808db26bd7
2025-12-11 02:40:40.838+00	097b6b48-768f-49ca-8f0b-192f8c428ea3	fe77d2b4-3222-4c1c-9866-5048050f4d7e	f4f66e21-9e11-4763-9bb1-d79a823cdaf4	458e65e5-629b-4670-a282-5124f28c8814	49d1ddc6-e49b-4508-be12-26eac7e23d33	dd57ba29-3818-4f50-a609-8b5ec32b32f7
2025-12-11 02:40:50.136+00	28fd23f4-aac7-4194-b613-8f366137cc09	fe77d2b4-3222-4c1c-9866-5048050f4d7e	e29b8d8e-3706-4daa-9df3-85e4fb0fba72	a61505b9-1de4-48b4-8ebf-8e546df13db9	49d1ddc6-e49b-4508-be12-26eac7e23d33	7710e884-81ee-43f9-9ab5-3e60cf0d75ae
\.


--
-- Data for Name: network_interfaces; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.network_interfaces (ip, mask, cidr, mac, "createdAt", "updatedAt", "broadcastAddress", "networkAddress", id, "nodeId") FROM stdin;
192.168.1.10	255.255.255.0	24	E9:FE:37:B9:5B:1B	2025-12-10 23:37:30.109+00	2025-12-10 23:37:30.109+00	192.168.1.255	192.168.1.0	31b7a235-283c-4047-9f87-5dbc0206ebeb	51a0853b-090c-427e-b02b-9aea601c1764
192.168.1.11	255.255.255.0	24	C7:3A:E0:4B:D0:25	2025-12-10 23:38:05.265+00	2025-12-10 23:38:05.265+00	192.168.1.255	192.168.1.0	16b66959-d167-4d18-a8de-f538bcbd4090	facb6526-7f3d-4ffd-8ae3-e27b99239371
192.168.1.12	255.255.255.0	24	FC:F9:2A:42:F6:75	2025-12-10 23:38:44.218+00	2025-12-10 23:38:44.218+00	192.168.1.255	192.168.1.0	a57ae043-40a6-4ba1-97f0-029450dd76bb	eab0796f-85af-4711-8ae0-05ac6d18d8fa
0.0.0.1	255.255.255.255	32	8A:E3:BB:29:C8:63	2025-12-10 23:39:41.024+00	2025-12-10 23:39:41.024+00	0.0.0.1	0.0.0.1	b81d7e10-0d1c-4663-847f-b6948e28940d	cf522103-18e6-46a8-abf9-9615a4122d38
0.0.0.2	255.255.255.255	32	B9:45:0C:95:2A:3B	2025-12-10 23:39:41.775+00	2025-12-10 23:39:41.775+00	0.0.0.2	0.0.0.2	6b6af702-a279-4224-a3b9-42f941dd6de0	cf522103-18e6-46a8-abf9-9615a4122d38
0.0.0.4	255.255.255.255	32	B9:83:08:41:54:E6	2025-12-10 23:39:43.294+00	2025-12-10 23:39:43.294+00	0.0.0.4	0.0.0.4	f29c65b6-002b-4526-b22e-75fab4090d7b	cf522103-18e6-46a8-abf9-9615a4122d38
0.0.0.3	255.255.255.255	32	A0:0F:C2:6E:A6:67	2025-12-10 23:40:40.006+00	2025-12-10 23:40:40.006+00	0.0.0.3	0.0.0.3	c8f4cda0-128d-498b-ada2-06d29dbcb445	cf522103-18e6-46a8-abf9-9615a4122d38
192.168.1.1	255.255.255.0	24	D4:57:CF:25:B3:4D	2025-12-10 23:41:11.021+00	2025-12-10 23:41:11.021+00	192.168.1.255	192.168.1.0	e2374cb7-d94e-43fa-8875-e487827a9698	0f701025-8280-4560-8090-a5390ea42e54
10.0.10.1	255.255.255.0	24	33:32:18:E4:86:D1	2025-12-11 01:30:28.642+00	2025-12-11 01:30:28.642+00	10.0.10.255	10.0.10.0	e4aafffb-d55b-456d-be12-0c5eb70c8ede	c216143a-19ff-423d-aacd-75e13394a9ae
10.0.20.1	255.255.255.0	24	D8:C0:D9:E8:57:2E	2025-12-11 01:30:28.658+00	2025-12-11 01:30:28.658+00	10.0.20.255	10.0.20.0	5b140fdf-de6f-4013-8fe2-fabaa8dbe0c7	c216143a-19ff-423d-aacd-75e13394a9ae
0.0.0.1	255.255.255.0	24	E0:24:9F:7D:EF:B4	2025-12-11 01:31:33.372+00	2025-12-11 01:31:33.372+00	0.0.0.255	0.0.0.0	ea489971-d54c-497c-a576-ac932bb06bc5	3fb7ffb0-d2a1-4425-8dde-27c05aa4dcd5
0.0.0.2	255.255.255.0	24	3D:69:FA:2E:74:95	2025-12-11 01:31:33.702+00	2025-12-11 01:31:33.702+00	0.0.0.255	0.0.0.0	fc399801-5676-47a6-bfe7-250af5e5c066	3fb7ffb0-d2a1-4425-8dde-27c05aa4dcd5
0.0.0.3	255.255.255.0	24	CC:87:0A:0D:35:3D	2025-12-11 01:31:34.465+00	2025-12-11 01:31:34.465+00	0.0.0.255	0.0.0.0	c276811c-d3e1-4efa-a362-d4157ecdbd47	3fb7ffb0-d2a1-4425-8dde-27c05aa4dcd5
0.0.0.4	255.255.255.0	24	8C:16:B3:97:A4:82	2025-12-11 01:31:35.227+00	2025-12-11 01:31:35.227+00	0.0.0.255	0.0.0.0	507b59ce-f3d0-45a8-88a8-9d4516b20d46	3fb7ffb0-d2a1-4425-8dde-27c05aa4dcd5
0.0.1.1	255.255.255.0	24	7F:35:F6:18:FB:52	2025-12-11 01:32:54.38+00	2025-12-11 01:32:54.38+00	0.0.1.255	0.0.1.0	c12eaac4-ed72-4c4b-8a57-77fbf4aa0e68	6332e544-8902-47df-a91e-c3758e844b18
0.0.1.2	255.255.255.0	24	B2:F3:CE:BF:70:78	2025-12-11 01:32:54.414+00	2025-12-11 01:32:54.414+00	0.0.1.255	0.0.1.0	5e5d19be-2f75-4c9f-a360-dd548da11c52	6332e544-8902-47df-a91e-c3758e844b18
0.0.1.3	255.255.255.0	24	F3:C9:5F:1D:62:D1	2025-12-11 01:32:54.447+00	2025-12-11 01:32:54.447+00	0.0.1.255	0.0.1.0	b50d1293-2510-4888-ba2a-73023e556d03	6332e544-8902-47df-a91e-c3758e844b18
0.0.1.4	255.255.255.0	24	94:30:AD:13:DB:6E	2025-12-11 01:32:54.496+00	2025-12-11 01:32:54.496+00	0.0.1.255	0.0.1.0	6b24c333-9caf-4f7d-ba8d-c57e1eba4809	6332e544-8902-47df-a91e-c3758e844b18
10.0.10.10	255.255.255.0	24	99:50:A1:3D:9F:02	2025-12-11 01:37:09.453+00	2025-12-11 01:37:09.453+00	10.0.10.255	10.0.10.0	31c9c406-c1dd-4372-b04c-994d1f50a4f1	eb986946-ad71-414a-8ca8-6c288d4952e1
10.0.10.20	255.255.255.0	24	86:91:56:49:50:1E	2025-12-11 01:39:17.717+00	2025-12-11 01:39:17.717+00	10.0.10.255	10.0.10.0	96717def-18cf-46e0-869c-1bfa6484d4b6	3cc1915a-869c-4864-9077-c9329eb6eb7e
10.0.10.30	255.255.255.0	24	29:DD:94:47:4A:D2	2025-12-11 01:39:57.17+00	2025-12-11 01:39:57.17+00	10.0.10.255	10.0.10.0	81b3bf51-cccb-4e3a-9ceb-27b4f1252b10	fa48aec2-7ce0-4b9f-a7dd-620adec241f9
10.0.20.10	255.255.255.0	24	7B:88:CA:E9:F9:D2	2025-12-11 01:40:34.955+00	2025-12-11 01:40:34.955+00	10.0.20.255	10.0.20.0	d1102543-6fb1-49d7-9453-8626b4bd33f0	29980c7c-144b-41b4-b39d-f831b7d2964b
10.0.20.20	255.255.255.0	24	4A:99:98:6B:DF:3E	2025-12-11 01:40:54.961+00	2025-12-11 01:40:54.961+00	10.0.20.255	10.0.20.0	4813a7b8-573b-454b-93ed-5134193eb064	e09ea110-751f-494e-abc0-ee0ff14ec920
10.0.20.30	255.255.255.0	24	65:77:65:7F:5A:27	2025-12-11 01:42:48.366+00	2025-12-11 01:42:48.366+00	10.0.20.255	10.0.20.0	061d5177-93cf-4722-983a-5878d7be48d3	2aadcc84-e063-4cb4-abcc-7e2b4e129671
172.16.0.1	255.255.255.0	24	60:9B:72:6B:E0:72	2025-12-11 02:09:26.618+00	2025-12-11 02:09:26.618+00	172.16.0.255	172.16.0.0	2938fb9d-2d26-4ed7-8d96-e01fafb4399c	99a962fa-5e94-493e-a5cb-b0e4f24a3bc5
172.16.0.254	255.255.255.0	24	9E:85:4D:41:98:BC	2025-12-11 02:10:36.918+00	2025-12-11 02:10:36.918+00	172.16.0.255	172.16.0.0	2bb3ed65-c806-4c00-be7e-10915f729bb3	82f13f20-741d-4249-87fb-299642ca2cce
10.10.0.1	255.255.255.0	24	A1:18:B1:CE:17:8A	2025-12-11 02:10:36.953+00	2025-12-11 02:10:36.953+00	10.10.0.255	10.10.0.0	c9bb6c7f-be81-4f26-a7ba-8dabfacb5449	82f13f20-741d-4249-87fb-299642ca2cce
10.20.0.1	255.255.255.0	24	61:11:27:70:FA:71	2025-12-11 02:10:37.002+00	2025-12-11 02:10:37.002+00	10.20.0.255	10.20.0.0	53fee481-f736-40b1-b8b5-0e7127ed280d	82f13f20-741d-4249-87fb-299642ca2cce
0.0.0.1	255.255.255.0	24	E7:0D:4C:46:D5:AF	2025-12-11 02:12:28.207+00	2025-12-11 02:12:28.207+00	0.0.0.255	0.0.0.0	8e7ee566-55ac-4c1b-83c8-73c29b5443a9	a4f31938-a8e8-40cc-ad03-9a10b197d1a0
172.16.0.10	255.255.255.0	24	AB:67:CD:46:B8:08	2025-12-11 02:14:49.825+00	2025-12-11 02:14:49.825+00	172.16.0.255	172.16.0.0	b7818c73-9759-4ba5-a9e4-7835709185a7	024f5d7c-ce6e-439e-adbf-c0a409e32ad3
172.16.0.20	255.255.255.0	24	DA:C6:C8:9D:8D:3E	2025-12-11 02:15:08.899+00	2025-12-11 02:15:08.899+00	172.16.0.255	172.16.0.0	ab841872-9a28-4590-92ac-ed5333a496f1	b4cbb059-305d-443f-ab51-515d47bb4851
172.16.0.30	255.255.255.0	24	CA:56:00:D9:A6:B0	2025-12-11 02:15:27.286+00	2025-12-11 02:15:27.286+00	172.16.0.255	172.16.0.0	06a5bffc-db8e-490c-a826-c4850190fb8b	4188526a-f0c6-48d5-aef6-db7123723236
10.10.0.10	255.255.255.0	24	49:B5:64:9F:90:80	2025-12-11 02:19:08.493+00	2025-12-11 02:19:08.493+00	10.10.0.255	10.10.0.0	e7c7ba2f-fcd8-4813-b745-6c6f18fc203e	140db659-92b1-489e-a931-4cead37948a8
10.10.0.20	255.255.255.0	24	C0:22:B7:F8:1B:28	2025-12-11 02:19:55.691+00	2025-12-11 02:19:55.691+00	10.10.0.255	10.10.0.0	15f2237a-8efc-4fd5-96ee-6381a526e3b4	c08cef80-a910-4c01-a1c9-de71f65672db
10.10.0.30	255.255.255.0	24	37:8A:6C:15:FF:6C	2025-12-11 02:20:06.501+00	2025-12-11 02:20:06.501+00	10.10.0.255	10.10.0.0	38b9a4c4-706c-4a21-bcb9-914c9bf6e69c	c02ba1e0-4ab5-4030-8742-1c766ca843b5
10.20.0.10	255.255.255.0	24	10:90:67:38:61:9B	2025-12-11 02:20:49.125+00	2025-12-11 02:20:49.125+00	10.20.0.255	10.20.0.0	458e65e5-629b-4670-a282-5124f28c8814	dd57ba29-3818-4f50-a609-8b5ec32b32f7
10.20.0.20	255.255.255.0	24	EE:A5:36:0D:6E:23	2025-12-11 02:21:26.349+00	2025-12-11 02:21:26.349+00	10.20.0.255	10.20.0.0	a61505b9-1de4-48b4-8ebf-8e546df13db9	7710e884-81ee-43f9-9ab5-3e60cf0d75ae
10.20.0.30	255.255.255.0	24	AF:F7:ED:91:34:5F	2025-12-11 02:21:49.977+00	2025-12-11 02:21:49.977+00	10.20.0.255	10.20.0.0	746cf51c-61e8-44dc-85a0-c0570778d004	4de52b10-b9b0-4f60-92d6-d5808db26bd7
0.0.1.1	255.255.255.255	32	C7:29:66:37:0B:25	2025-12-11 02:26:00.478+00	2025-12-11 02:26:00.478+00	0.0.1.1	0.0.1.1	638b7262-2004-4e76-baab-0641551cd349	0f9b8001-ca46-46b2-802d-70563bf2d87a
0.0.1.2	255.255.255.255	32	D9:93:B2:F9:C5:9E	2025-12-11 02:26:21.425+00	2025-12-11 02:26:21.425+00	0.0.1.2	0.0.1.2	2c0b4a50-1135-4ffe-81b8-d8d4dd60463d	0f9b8001-ca46-46b2-802d-70563bf2d87a
0.0.1.3	255.255.255.255	32	9A:72:1A:6B:EA:AF	2025-12-11 02:26:22.195+00	2025-12-11 02:26:22.195+00	0.0.1.3	0.0.1.3	5b0a1f63-33dc-4197-84d8-a3991b3c6684	0f9b8001-ca46-46b2-802d-70563bf2d87a
0.0.1.4	255.255.255.255	32	35:01:E7:D2:09:25	2025-12-11 02:26:22.711+00	2025-12-11 02:26:22.711+00	0.0.1.4	0.0.1.4	1c13ea33-13e0-40e9-b353-1632d953b559	0f9b8001-ca46-46b2-802d-70563bf2d87a
0.0.2.1	255.255.255.255	32	EF:AC:C6:46:88:FF	2025-12-11 02:26:49.572+00	2025-12-11 02:26:49.572+00	0.0.2.1	0.0.2.1	2b122056-073b-406e-a0f0-10d7b0b43d50	49d1ddc6-e49b-4508-be12-26eac7e23d33
0.0.2.2	255.255.255.255	32	5B:5B:2E:F9:F1:0F	2025-12-11 02:26:49.605+00	2025-12-11 02:26:49.605+00	0.0.2.2	0.0.2.2	348a9655-9816-410a-b06f-bb37a756a9be	49d1ddc6-e49b-4508-be12-26eac7e23d33
0.0.2.3	255.255.255.255	32	2A:D0:17:EE:F8:C0	2025-12-11 02:26:49.638+00	2025-12-11 02:26:49.638+00	0.0.2.3	0.0.2.3	f4f66e21-9e11-4763-9bb1-d79a823cdaf4	49d1ddc6-e49b-4508-be12-26eac7e23d33
0.0.2.4	255.255.255.255	32	56:A4:39:43:CA:0B	2025-12-11 02:26:49.711+00	2025-12-11 02:26:49.711+00	0.0.2.4	0.0.2.4	e29b8d8e-3706-4daa-9df3-85e4fb0fba72	49d1ddc6-e49b-4508-be12-26eac7e23d33
0.0.0.2	255.255.255.255	32	46:FF:9F:0F:44:70	2025-12-11 02:27:08.458+00	2025-12-11 02:27:08.458+00	0.0.0.2	0.0.0.2	c7200795-4454-4f5b-9b8e-6f8c06b8cdf9	a4f31938-a8e8-40cc-ad03-9a10b197d1a0
0.0.0.3	255.255.255.255	32	E1:2B:12:A3:6D:D7	2025-12-11 02:27:08.49+00	2025-12-11 02:27:08.49+00	0.0.0.3	0.0.0.3	319106c3-ca3a-41b6-bb74-26be9c754b7d	a4f31938-a8e8-40cc-ad03-9a10b197d1a0
0.0.0.4	255.255.255.255	32	61:2C:98:84:22:6F	2025-12-11 02:27:08.556+00	2025-12-11 02:27:08.556+00	0.0.0.4	0.0.0.4	4c0d4725-4a21-4123-9289-edda47dfe52a	a4f31938-a8e8-40cc-ad03-9a10b197d1a0
0.0.0.5	255.255.255.255	32	54:69:D1:01:0C:6F	2025-12-11 02:28:18.56+00	2025-12-11 02:28:18.56+00	0.0.0.5	0.0.0.5	03695d75-ab88-451d-908c-b8276e296664	a4f31938-a8e8-40cc-ad03-9a10b197d1a0
\.


--
-- Data for Name: nodes; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.nodes (name, "positionX", "positionY", "createdAt", "updatedAt", id, type, "topologyId", "defaultGateway") FROM stdin;
Router	-149.0461451284314	-81.53611831847283	2025-12-08 23:22:19.489+00	2025-12-11 01:14:25.954+00	0f701025-8280-4560-8090-a5390ea42e54	ROUTER	18172397-39c3-4148-aea0-c82271403dad	\N
Phone	-485.8822510505207	373.1399005246241	2025-12-10 23:38:29.05+00	2025-12-11 01:14:26.804+00	eab0796f-85af-4711-8ae0-05ac6d18d8fa	HOST	18172397-39c3-4148-aea0-c82271403dad	192.168.1.1
switch	-141.6772716681683	132.3053976413188	2025-12-02 15:45:02.521+00	2025-12-11 01:14:28.792+00	cf522103-18e6-46a8-abf9-9615a4122d38	SWITCH	18172397-39c3-4148-aea0-c82271403dad	\N
edge router	-187.0230010523115	-933.5204748949044	2025-12-11 02:09:26.537+00	2025-12-11 02:19:14.411+00	99a962fa-5e94-493e-a5cb-b0e4f24a3bc5	ROUTER	fe77d2b4-3222-4c1c-9866-5048050f4d7e	\N
backend	362.4661678238007	-251.2697662286387	2025-12-11 01:42:47.838+00	2025-12-11 01:51:28.416+00	2aadcc84-e063-4cb4-abcc-7e2b4e129671	HOST	0154693d-6b89-4d63-8604-f572f9299975	10.0.20.1
admin 2	-273.2942387108445	-245.6043433585103	2025-12-11 01:39:57.037+00	2025-12-11 01:51:33.035+00	fa48aec2-7ce0-4b9f-a7dd-620adec241f9	HOST	0154693d-6b89-4d63-8604-f572f9299975	10.0.10.1
sw sv	171.74174894434	-441.818741577222	2025-12-11 01:32:54.296+00	2025-12-11 01:52:40.205+00	6332e544-8902-47df-a91e-c3758e844b18	SWITCH	0154693d-6b89-4d63-8604-f572f9299975	\N
web	4.183898867288462	-247.073419913357	2025-12-11 01:40:34.933+00	2025-12-11 01:52:45.461+00	29980c7c-144b-41b4-b39d-f831b7d2964b	HOST	0154693d-6b89-4d63-8604-f572f9299975	10.0.20.1
vpn	-48.91268599905931	-605.8830827355074	2025-12-11 02:15:26.017+00	2025-12-11 02:19:18.597+00	4188526a-f0c6-48d5-aef6-db7123723236	HOST	fe77d2b4-3222-4c1c-9866-5048050f4d7e	172.16.0.1
user2	-351.9195060741239	-91.97520662251239	2025-12-11 02:19:54.402+00	2025-12-11 04:32:03.961+00	c08cef80-a910-4c01-a1c9-de71f65672db	HOST	fe77d2b4-3222-4c1c-9866-5048050f4d7e	10.10.0.1
user1	-246.1261124590901	-89.93908071343544	2025-12-11 02:19:07.185+00	2025-12-11 04:36:54.287+00	140db659-92b1-489e-a931-4cead37948a8	HOST	fe77d2b4-3222-4c1c-9866-5048050f4d7e	10.10.0.1
web sv	-294.8653238119998	-609.3353951908103	2025-12-11 02:14:48.557+00	2025-12-11 02:24:41.003+00	024f5d7c-ce6e-439e-adbf-c0a409e32ad3	HOST	fe77d2b4-3222-4c1c-9866-5048050f4d7e	172.16.0.1
mail sv	-425.9242195681836	-611.2361480756124	2025-12-11 02:15:08.518+00	2025-12-11 02:24:41.855+00	b4cbb059-305d-443f-ab51-515d47bb4851	HOST	fe77d2b4-3222-4c1c-9866-5048050f4d7e	172.16.0.1
core router	-190.6391749514794	-448.0055505759387	2025-12-11 02:10:36.869+00	2025-12-11 04:37:49.783+00	82f13f20-741d-4249-87fb-299642ca2cce	ROUTER	fe77d2b4-3222-4c1c-9866-5048050f4d7e	\N
NAS	-592.3470003075371	-239.5314647600404	2025-12-11 01:39:16.434+00	2025-12-11 01:41:52.607+00	3cc1915a-869c-4864-9077-c9329eb6eb7e	HOST	0154693d-6b89-4d63-8604-f572f9299975	10.0.10.1
admin	-434.2576673479512	-175.9017845974963	2025-12-11 01:37:08.577+00	2025-12-11 04:38:46.591+00	eb986946-ad71-414a-8ca8-6c288d4952e1	HOST	0154693d-6b89-4d63-8604-f572f9299975	10.0.10.1
main router	-145.0340480383576	-644.3071792539744	2025-12-11 01:30:28.597+00	2025-12-11 04:39:22.152+00	c216143a-19ff-423d-aacd-75e13394a9ae	ROUTER	0154693d-6b89-4d63-8604-f572f9299975	\N
PC	-151.0149832282857	398.5247302712027	2025-12-08 01:15:49.193+00	2025-12-11 04:39:59.084+00	51a0853b-090c-427e-b02b-9aea601c1764	HOST	18172397-39c3-4148-aea0-c82271403dad	192.168.1.1
sw mgmt	-427.1375862029267	-451.2694529941823	2025-12-11 01:31:32.109+00	2025-12-11 01:41:58.977+00	3fb7ffb0-d2a1-4425-8dde-27c05aa4dcd5	SWITCH	0154693d-6b89-4d63-8604-f572f9299975	\N
db	-139.4896959105434	-88.29310176339067	2025-12-11 02:20:47.852+00	2025-12-11 02:49:40.717+00	dd57ba29-3818-4f50-a609-8b5ec32b32f7	HOST	fe77d2b4-3222-4c1c-9866-5048050f4d7e	10.20.0.1
Laptop	195.9658970098543	357.5987624404439	2025-12-08 22:45:03.772+00	2025-12-11 04:40:07.286+00	facb6526-7f3d-4ffd-8ae3-e27b99239371	HOST	18172397-39c3-4148-aea0-c82271403dad	192.168.1.1
priv sv	75.325009685792	-89.17515903165882	2025-12-11 02:21:48.717+00	2025-12-11 03:32:11.896+00	4de52b10-b9b0-4f60-92d6-d5808db26bd7	HOST	fe77d2b4-3222-4c1c-9866-5048050f4d7e	10.20.0.1
nas	-29.96692264021664	-90.44730186249714	2025-12-11 02:21:26.282+00	2025-12-11 03:36:57.582+00	7710e884-81ee-43f9-9ab5-3e60cf0d75ae	HOST	fe77d2b4-3222-4c1c-9866-5048050f4d7e	10.20.0.1
sw dmz	-178.4676478590454	-771.6749187101062	2025-12-11 02:12:27.458+00	2025-12-11 02:28:21.147+00	a4f31938-a8e8-40cc-ad03-9a10b197d1a0	SWITCH	fe77d2b4-3222-4c1c-9866-5048050f4d7e	\N
db	171.8367356679197	-179.471830141043	2025-12-11 01:40:54.617+00	2025-12-11 01:45:37.026+00	e09ea110-751f-494e-abc0-ee0ff14ec920	HOST	0154693d-6b89-4d63-8604-f572f9299975	10.0.20.1
user3	-467.6004608952837	-90.0775323582063	2025-12-11 02:20:05.237+00	2025-12-11 03:45:28.762+00	c02ba1e0-4ab5-4030-8742-1c766ca843b5	HOST	fe77d2b4-3222-4c1c-9866-5048050f4d7e	10.10.0.1
sw lan	-265.0447370061324	-264.4947787339941	2025-12-11 02:13:06.453+00	2025-12-11 02:39:29.31+00	0f9b8001-ca46-46b2-802d-70563bf2d87a	SWITCH	fe77d2b4-3222-4c1c-9866-5048050f4d7e	\N
sw sv	-100.7026325279824	-254.4770409651641	2025-12-11 02:13:26.989+00	2025-12-11 02:40:01.467+00	49d1ddc6-e49b-4508-be12-26eac7e23d33	SWITCH	fe77d2b4-3222-4c1c-9866-5048050f4d7e	\N
\.


--
-- Data for Name: packet_logs; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.packet_logs ("srcIp", "dstIp", protocol, payload, ttl, history, status, "timestamp", id, "simulationId") FROM stdin;
\.


--
-- Data for Name: routing_entries; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.routing_entries (destination, mask, cidr, "isDefault", "createdAt", id, "nodeId", "nextHopInterfaceId") FROM stdin;
\.


--
-- Data for Name: simulation_sessions; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.simulation_sessions (name, "autoPopulateARP", "stepDelay", status, "createdAt", "updatedAt", id, "topologyId") FROM stdin;
Test Simulation 1	t	1000	IDLE	2025-11-24 17:46:22.521+00	2025-11-24 17:46:22.521+00	21e54c7e-f811-4f98-a105-7451b690d973	0154693d-6b89-4d63-8604-f572f9299975
Sim-1765236455324	t	1000	IDLE	2025-12-08 23:27:35.374+00	2025-12-08 23:27:35.374+00	0332ba66-7a2d-4563-87c1-5982c4a03f4e	18172397-39c3-4148-aea0-c82271403dad
Sim-1765241035052	t	1000	IDLE	2025-12-09 00:43:55.086+00	2025-12-09 00:43:55.086+00	6aa565e5-53db-44c8-9ac8-138b804aec36	18172397-39c3-4148-aea0-c82271403dad
Sim-1765297616176	t	1000	IDLE	2025-12-09 16:26:56.199+00	2025-12-09 16:26:56.199+00	a538b637-cd9e-42be-af59-201a85f451fa	18172397-39c3-4148-aea0-c82271403dad
Sim-1765297899762	t	1000	IDLE	2025-12-09 16:31:39.81+00	2025-12-09 16:31:39.81+00	9c840df1-75a4-49f4-997a-17db1f4a00ac	18172397-39c3-4148-aea0-c82271403dad
Sim-1765299336498	t	1000	IDLE	2025-12-09 16:55:36.551+00	2025-12-09 16:55:36.551+00	634e7729-06b6-4ece-a5ba-51368e098ba1	18172397-39c3-4148-aea0-c82271403dad
Sim-1765332258063	t	1000	IDLE	2025-12-10 02:04:18.123+00	2025-12-10 02:04:18.123+00	5418b24b-6c3b-4270-b244-2bbaa135b8cd	18172397-39c3-4148-aea0-c82271403dad
Sim-1765410391556	t	1000	IDLE	2025-12-10 23:46:31.57+00	2025-12-10 23:46:31.57+00	95488107-3352-4e48-bae0-7fbff1f397d6	18172397-39c3-4148-aea0-c82271403dad
Sim-1765412368526	t	1000	IDLE	2025-12-11 00:19:28.581+00	2025-12-11 00:19:28.581+00	17721de9-dd92-45bb-b981-dc4c334b64ff	18172397-39c3-4148-aea0-c82271403dad
Sim-1765412662369	t	1000	IDLE	2025-12-11 00:24:22.419+00	2025-12-11 00:24:22.419+00	38c1a81b-ab41-408b-9f68-76a957848e68	18172397-39c3-4148-aea0-c82271403dad
Sim-1765412791988	t	1000	IDLE	2025-12-11 00:26:32.039+00	2025-12-11 00:26:32.039+00	6c86bda0-6014-430c-820c-be9f85701189	18172397-39c3-4148-aea0-c82271403dad
Sim-1765412957552	t	1000	IDLE	2025-12-11 00:29:17.744+00	2025-12-11 00:29:17.744+00	e3511393-70b8-4739-91a3-5df0bb678b4c	18172397-39c3-4148-aea0-c82271403dad
Sim-1765413233522	t	1000	IDLE	2025-12-11 00:33:54.286+00	2025-12-11 00:33:54.286+00	1cb94905-5ac3-4e31-8d8d-b1ace4ff388a	18172397-39c3-4148-aea0-c82271403dad
Sim-1765415433287	t	1000	IDLE	2025-12-11 01:10:33.316+00	2025-12-11 01:10:33.316+00	571f2c8c-4e5b-407e-af5a-f9a8367102fd	18172397-39c3-4148-aea0-c82271403dad
Sim-1765417597220	t	1000	IDLE	2025-12-11 01:46:38.01+00	2025-12-11 01:46:38.01+00	12470406-1c7b-42ee-bd7c-81269f6d6297	0154693d-6b89-4d63-8604-f572f9299975
Sim-1765417798550	f	1000	IDLE	2025-12-11 01:49:59.345+00	2025-12-11 01:49:59.345+00	99c27b70-8b32-43d7-b33b-63afdfba5eab	0154693d-6b89-4d63-8604-f572f9299975
Sim-1765417908745	t	1000	IDLE	2025-12-11 01:51:49.519+00	2025-12-11 01:51:49.519+00	99b13bf0-20c6-4199-b0da-31fc4d0de00d	0154693d-6b89-4d63-8604-f572f9299975
Sim-1765420915429	t	1000	IDLE	2025-12-11 02:41:55.482+00	2025-12-11 02:41:55.482+00	aa4e7390-b7a0-4ed3-812a-83e40cdbbf4e	fe77d2b4-3222-4c1c-9866-5048050f4d7e
Sim-1765421391450	t	1000	IDLE	2025-12-11 02:49:52.244+00	2025-12-11 02:49:52.244+00	2c72daa5-e08c-436b-8a6c-2e17bb5c7cf5	fe77d2b4-3222-4c1c-9866-5048050f4d7e
Sim-1765423941077	f	1000	IDLE	2025-12-11 03:32:21.13+00	2025-12-11 03:32:21.13+00	9bf72d9a-e482-4e47-ab06-87b256fbd42a	fe77d2b4-3222-4c1c-9866-5048050f4d7e
Sim-1765424226779	f	1000	IDLE	2025-12-11 03:37:06.834+00	2025-12-11 03:37:06.834+00	3521c019-408d-476f-9aca-7058468cb57d	fe77d2b4-3222-4c1c-9866-5048050f4d7e
Sim-1765424435317	f	1000	IDLE	2025-12-11 03:40:35.355+00	2025-12-11 03:40:35.355+00	91cc53b2-77a3-4fba-969f-e99ebed8696d	fe77d2b4-3222-4c1c-9866-5048050f4d7e
Sim-1765424463249	f	1000	IDLE	2025-12-11 03:41:03.305+00	2025-12-11 03:41:03.305+00	b69366d5-3bd8-41fb-b19f-9e6b6744a08f	fe77d2b4-3222-4c1c-9866-5048050f4d7e
Sim-1765424733689	f	1000	IDLE	2025-12-11 03:45:33.743+00	2025-12-11 03:45:33.743+00	32f11797-3521-40ab-b104-ec431a6553a9	fe77d2b4-3222-4c1c-9866-5048050f4d7e
Sim-1765425632268	f	1000	IDLE	2025-12-11 04:00:33.037+00	2025-12-11 04:00:33.037+00	d952af47-e182-4bf9-94f6-8d2696b94892	fe77d2b4-3222-4c1c-9866-5048050f4d7e
Sim-1765426764865	f	1000	IDLE	2025-12-11 04:19:25.624+00	2025-12-11 04:19:25.624+00	24efacad-5ad8-40be-95e8-804260cb672b	fe77d2b4-3222-4c1c-9866-5048050f4d7e
Sim-1765426956622	f	1000	IDLE	2025-12-11 04:22:36.801+00	2025-12-11 04:22:36.801+00	805547a7-9c98-4b67-850b-35f4e14c7c8a	fe77d2b4-3222-4c1c-9866-5048050f4d7e
Sim-1765427402566	f	1000	IDLE	2025-12-11 04:30:03.185+00	2025-12-11 04:30:03.185+00	044d3fc2-6031-401f-93fb-926312926142	fe77d2b4-3222-4c1c-9866-5048050f4d7e
Sim-1765427554818	t	1000	IDLE	2025-12-11 04:32:34.861+00	2025-12-11 04:32:34.861+00	71095c7f-6262-439b-add4-42425e453ba4	fe77d2b4-3222-4c1c-9866-5048050f4d7e
Sim-1765427819563	f	1000	IDLE	2025-12-11 04:36:59.615+00	2025-12-11 04:36:59.615+00	9123acd0-dd5c-4abc-9355-7bedd9910c22	fe77d2b4-3222-4c1c-9866-5048050f4d7e
Sim-1765427936053	f	1000	IDLE	2025-12-11 04:38:56.1+00	2025-12-11 04:38:56.1+00	d468acbf-b072-4dd2-951f-ba6604d6ac31	0154693d-6b89-4d63-8604-f572f9299975
Sim-1765428014094	f	1000	IDLE	2025-12-11 04:40:14.135+00	2025-12-11 04:40:14.135+00	793234ac-b6f4-4aa3-aedc-989ed10fa448	18172397-39c3-4148-aea0-c82271403dad
\.


--
-- Data for Name: topologies; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.topologies (name, description, "createdAt", "updatedAt", id) FROM stdin;
tp1	Topology Test	2025-11-24 10:27:25.685+00	2025-11-24 10:27:25.685+00	0154693d-6b89-4d63-8604-f572f9299975
tp2	\N	2025-12-01 18:58:56+00	2025-12-01 18:58:56+00	18172397-39c3-4148-aea0-c82271403dad
tp3	\N	2025-12-07 14:26:37.575+00	2025-12-07 14:26:37.575+00	fe77d2b4-3222-4c1c-9866-5048050f4d7e
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.users (id, password, email) FROM stdin;
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: firewall_rules firewall_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.firewall_rules
    ADD CONSTRAINT firewall_rules_pkey PRIMARY KEY (id);


--
-- Name: links links_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.links
    ADD CONSTRAINT links_pkey PRIMARY KEY (id);


--
-- Name: network_interfaces network_interfaces_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.network_interfaces
    ADD CONSTRAINT network_interfaces_pkey PRIMARY KEY (id);


--
-- Name: nodes nodes_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.nodes
    ADD CONSTRAINT nodes_pkey PRIMARY KEY (id);


--
-- Name: packet_logs packet_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.packet_logs
    ADD CONSTRAINT packet_logs_pkey PRIMARY KEY (id);


--
-- Name: routing_entries routing_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.routing_entries
    ADD CONSTRAINT routing_entries_pkey PRIMARY KEY (id);


--
-- Name: simulation_sessions simulation_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.simulation_sessions
    ADD CONSTRAINT simulation_sessions_pkey PRIMARY KEY (id);


--
-- Name: topologies topologies_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.topologies
    ADD CONSTRAINT topologies_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: firewall_rules_nodeId_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "firewall_rules_nodeId_idx" ON public.firewall_rules USING btree ("nodeId");


--
-- Name: firewall_rules_priority_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX firewall_rules_priority_idx ON public.firewall_rules USING btree (priority);


--
-- Name: links_interfaceAId_interfaceBId_key; Type: INDEX; Schema: public; Owner: admin
--

CREATE UNIQUE INDEX "links_interfaceAId_interfaceBId_key" ON public.links USING btree ("interfaceAId", "interfaceBId");


--
-- Name: links_topologyId_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "links_topologyId_idx" ON public.links USING btree ("topologyId");


--
-- Name: network_interfaces_ip_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX network_interfaces_ip_idx ON public.network_interfaces USING btree (ip);


--
-- Name: network_interfaces_nodeId_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "network_interfaces_nodeId_idx" ON public.network_interfaces USING btree ("nodeId");


--
-- Name: nodes_topologyId_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "nodes_topologyId_idx" ON public.nodes USING btree ("topologyId");


--
-- Name: nodes_type_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX nodes_type_idx ON public.nodes USING btree (type);


--
-- Name: packet_logs_simulationId_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "packet_logs_simulationId_idx" ON public.packet_logs USING btree ("simulationId");


--
-- Name: packet_logs_status_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX packet_logs_status_idx ON public.packet_logs USING btree (status);


--
-- Name: packet_logs_timestamp_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX packet_logs_timestamp_idx ON public.packet_logs USING btree ("timestamp");


--
-- Name: routing_entries_isDefault_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "routing_entries_isDefault_idx" ON public.routing_entries USING btree ("isDefault");


--
-- Name: routing_entries_nodeId_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "routing_entries_nodeId_idx" ON public.routing_entries USING btree ("nodeId");


--
-- Name: simulation_sessions_status_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX simulation_sessions_status_idx ON public.simulation_sessions USING btree (status);


--
-- Name: simulation_sessions_topologyId_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "simulation_sessions_topologyId_idx" ON public.simulation_sessions USING btree ("topologyId");


--
-- Name: topologies_createdAt_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "topologies_createdAt_idx" ON public.topologies USING btree ("createdAt");


--
-- Name: users_id_key; Type: INDEX; Schema: public; Owner: admin
--

CREATE UNIQUE INDEX users_id_key ON public.users USING btree (id);


--
-- Name: firewall_rules firewall_rules_nodeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.firewall_rules
    ADD CONSTRAINT "firewall_rules_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES public.nodes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: links links_interfaceAId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.links
    ADD CONSTRAINT "links_interfaceAId_fkey" FOREIGN KEY ("interfaceAId") REFERENCES public.network_interfaces(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: links links_interfaceBId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.links
    ADD CONSTRAINT "links_interfaceBId_fkey" FOREIGN KEY ("interfaceBId") REFERENCES public.network_interfaces(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: links links_nodeAId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.links
    ADD CONSTRAINT "links_nodeAId_fkey" FOREIGN KEY ("nodeAId") REFERENCES public.nodes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: links links_nodeBId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.links
    ADD CONSTRAINT "links_nodeBId_fkey" FOREIGN KEY ("nodeBId") REFERENCES public.nodes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: links links_topologyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.links
    ADD CONSTRAINT "links_topologyId_fkey" FOREIGN KEY ("topologyId") REFERENCES public.topologies(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: network_interfaces network_interfaces_nodeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.network_interfaces
    ADD CONSTRAINT "network_interfaces_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES public.nodes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: nodes nodes_topologyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.nodes
    ADD CONSTRAINT "nodes_topologyId_fkey" FOREIGN KEY ("topologyId") REFERENCES public.topologies(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: packet_logs packet_logs_simulationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.packet_logs
    ADD CONSTRAINT "packet_logs_simulationId_fkey" FOREIGN KEY ("simulationId") REFERENCES public.simulation_sessions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: routing_entries routing_entries_nextHopInterfaceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.routing_entries
    ADD CONSTRAINT "routing_entries_nextHopInterfaceId_fkey" FOREIGN KEY ("nextHopInterfaceId") REFERENCES public.network_interfaces(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: routing_entries routing_entries_nodeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.routing_entries
    ADD CONSTRAINT "routing_entries_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES public.nodes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: simulation_sessions simulation_sessions_topologyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.simulation_sessions
    ADD CONSTRAINT "simulation_sessions_topologyId_fkey" FOREIGN KEY ("topologyId") REFERENCES public.topologies(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: admin
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict lBgvA1vclj66WeNxi8lyGbgScGBeXbTu2STjfbSvR97nEfN1hhZO6frceyet36p

