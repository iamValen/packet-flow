/*
  Warnings:

  - The primary key for the `firewall_rules` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `srcIp` on the `firewall_rules` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(15)`.
  - You are about to alter the column `dstIp` on the `firewall_rules` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(15)`.
  - The `protocol` column on the `firewall_rules` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `links` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `network_interfaces` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `ip` on the `network_interfaces` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(15)`.
  - You are about to alter the column `mask` on the `network_interfaces` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(15)`.
  - You are about to alter the column `cidr` on the `network_interfaces` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `SmallInt`.
  - You are about to alter the column `mac` on the `network_interfaces` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(17)`.
  - The primary key for the `nodes` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `name` on the `nodes` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - The primary key for the `packet_logs` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `srcIp` on the `packet_logs` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(15)`.
  - You are about to alter the column `dstIp` on the `packet_logs` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(15)`.
  - You are about to alter the column `protocol` on the `packet_logs` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(10)`.
  - You are about to alter the column `ttl` on the `packet_logs` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `SmallInt`.
  - You are about to alter the column `status` on the `packet_logs` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - The primary key for the `routing_entries` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `destination` on the `routing_entries` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(15)`.
  - You are about to alter the column `mask` on the `routing_entries` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(15)`.
  - You are about to alter the column `cidr` on the `routing_entries` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `SmallInt`.
  - The primary key for the `simulation_sessions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `name` on the `simulation_sessions` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `status` on the `simulation_sessions` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - The primary key for the `topologies` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `name` on the `topologies` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - Changed the type of `id` on the `firewall_rules` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `action` on the `firewall_rules` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `nodeId` on the `firewall_rules` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `links` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `topologyId` on the `links` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `interfaceAId` on the `links` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `interfaceBId` on the `links` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `nodeAId` on the `links` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `nodeBId` on the `links` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `broadcastAddress` to the `network_interfaces` table without a default value. This is not possible if the table is not empty.
  - Added the required column `networkAddress` to the `network_interfaces` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `id` on the `network_interfaces` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `nodeId` on the `network_interfaces` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `nodes` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `type` on the `nodes` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `topologyId` on the `nodes` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `packet_logs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `simulationId` on the `packet_logs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `routing_entries` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `nodeId` on the `routing_entries` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `nextHopInterfaceId` on the `routing_entries` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `simulation_sessions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `topologyId` on the `simulation_sessions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `topologies` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "NodeType" AS ENUM ('HOST', 'ROUTER', 'SWITCH');

-- CreateEnum
CREATE TYPE "ProtocolType" AS ENUM ('TCP', 'UDP', 'ICMP', 'ARP');

-- CreateEnum
CREATE TYPE "Action" AS ENUM ('ALLOW', 'DROP');

-- DropForeignKey
ALTER TABLE "firewall_rules" DROP CONSTRAINT "firewall_rules_nodeId_fkey";

-- DropForeignKey
ALTER TABLE "links" DROP CONSTRAINT "links_interfaceAId_fkey";

-- DropForeignKey
ALTER TABLE "links" DROP CONSTRAINT "links_interfaceBId_fkey";

-- DropForeignKey
ALTER TABLE "links" DROP CONSTRAINT "links_nodeAId_fkey";

-- DropForeignKey
ALTER TABLE "links" DROP CONSTRAINT "links_nodeBId_fkey";

-- DropForeignKey
ALTER TABLE "links" DROP CONSTRAINT "links_topologyId_fkey";

-- DropForeignKey
ALTER TABLE "network_interfaces" DROP CONSTRAINT "network_interfaces_nodeId_fkey";

-- DropForeignKey
ALTER TABLE "nodes" DROP CONSTRAINT "nodes_topologyId_fkey";

-- DropForeignKey
ALTER TABLE "packet_logs" DROP CONSTRAINT "packet_logs_simulationId_fkey";

-- DropForeignKey
ALTER TABLE "routing_entries" DROP CONSTRAINT "routing_entries_nextHopInterfaceId_fkey";

-- DropForeignKey
ALTER TABLE "routing_entries" DROP CONSTRAINT "routing_entries_nodeId_fkey";

-- DropForeignKey
ALTER TABLE "simulation_sessions" DROP CONSTRAINT "simulation_sessions_topologyId_fkey";

-- AlterTable
ALTER TABLE "firewall_rules" DROP CONSTRAINT "firewall_rules_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "srcIp" SET DATA TYPE VARCHAR(15),
ALTER COLUMN "dstIp" SET DATA TYPE VARCHAR(15),
DROP COLUMN "protocol",
ADD COLUMN     "protocol" "ProtocolType",
DROP COLUMN "action",
ADD COLUMN     "action" "Action" NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ,
DROP COLUMN "nodeId",
ADD COLUMN     "nodeId" UUID NOT NULL,
ADD CONSTRAINT "firewall_rules_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "links" DROP CONSTRAINT "links_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ,
DROP COLUMN "topologyId",
ADD COLUMN     "topologyId" UUID NOT NULL,
DROP COLUMN "interfaceAId",
ADD COLUMN     "interfaceAId" UUID NOT NULL,
DROP COLUMN "interfaceBId",
ADD COLUMN     "interfaceBId" UUID NOT NULL,
DROP COLUMN "nodeAId",
ADD COLUMN     "nodeAId" UUID NOT NULL,
DROP COLUMN "nodeBId",
ADD COLUMN     "nodeBId" UUID NOT NULL,
ADD CONSTRAINT "links_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "network_interfaces" DROP CONSTRAINT "network_interfaces_pkey",
ADD COLUMN     "broadcastAddress" VARCHAR(15) NOT NULL,
ADD COLUMN     "networkAddress" VARCHAR(15) NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "ip" SET DATA TYPE VARCHAR(15),
ALTER COLUMN "mask" SET DATA TYPE VARCHAR(15),
ALTER COLUMN "cidr" SET DATA TYPE SMALLINT,
ALTER COLUMN "mac" SET DATA TYPE VARCHAR(17),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ,
DROP COLUMN "nodeId",
ADD COLUMN     "nodeId" UUID NOT NULL,
ADD CONSTRAINT "network_interfaces_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "nodes" DROP CONSTRAINT "nodes_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "name" SET DATA TYPE VARCHAR(255),
DROP COLUMN "type",
ADD COLUMN     "type" "NodeType" NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ,
DROP COLUMN "topologyId",
ADD COLUMN     "topologyId" UUID NOT NULL,
ADD CONSTRAINT "nodes_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "packet_logs" DROP CONSTRAINT "packet_logs_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "srcIp" SET DATA TYPE VARCHAR(15),
ALTER COLUMN "dstIp" SET DATA TYPE VARCHAR(15),
ALTER COLUMN "protocol" SET DATA TYPE VARCHAR(10),
ALTER COLUMN "ttl" SET DATA TYPE SMALLINT,
ALTER COLUMN "status" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "timestamp" SET DATA TYPE TIMESTAMPTZ,
DROP COLUMN "simulationId",
ADD COLUMN     "simulationId" UUID NOT NULL,
ADD CONSTRAINT "packet_logs_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "routing_entries" DROP CONSTRAINT "routing_entries_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "destination" SET DATA TYPE VARCHAR(15),
ALTER COLUMN "mask" SET DATA TYPE VARCHAR(15),
ALTER COLUMN "cidr" SET DATA TYPE SMALLINT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ,
DROP COLUMN "nodeId",
ADD COLUMN     "nodeId" UUID NOT NULL,
DROP COLUMN "nextHopInterfaceId",
ADD COLUMN     "nextHopInterfaceId" UUID NOT NULL,
ADD CONSTRAINT "routing_entries_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "simulation_sessions" DROP CONSTRAINT "simulation_sessions_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "name" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "status" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ,
DROP COLUMN "topologyId",
ADD COLUMN     "topologyId" UUID NOT NULL,
ADD CONSTRAINT "simulation_sessions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "topologies" DROP CONSTRAINT "topologies_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "name" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ,
ADD CONSTRAINT "topologies_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "firewall_rules_nodeId_idx" ON "firewall_rules"("nodeId");

-- CreateIndex
CREATE INDEX "firewall_rules_priority_idx" ON "firewall_rules"("priority");

-- CreateIndex
CREATE INDEX "links_topologyId_idx" ON "links"("topologyId");

-- CreateIndex
CREATE UNIQUE INDEX "links_interfaceAId_interfaceBId_key" ON "links"("interfaceAId", "interfaceBId");

-- CreateIndex
CREATE INDEX "network_interfaces_nodeId_idx" ON "network_interfaces"("nodeId");

-- CreateIndex
CREATE INDEX "network_interfaces_ip_idx" ON "network_interfaces"("ip");

-- CreateIndex
CREATE INDEX "nodes_topologyId_idx" ON "nodes"("topologyId");

-- CreateIndex
CREATE INDEX "nodes_type_idx" ON "nodes"("type");

-- CreateIndex
CREATE INDEX "packet_logs_simulationId_idx" ON "packet_logs"("simulationId");

-- CreateIndex
CREATE INDEX "packet_logs_status_idx" ON "packet_logs"("status");

-- CreateIndex
CREATE INDEX "packet_logs_timestamp_idx" ON "packet_logs"("timestamp");

-- CreateIndex
CREATE INDEX "routing_entries_nodeId_idx" ON "routing_entries"("nodeId");

-- CreateIndex
CREATE INDEX "routing_entries_isDefault_idx" ON "routing_entries"("isDefault");

-- CreateIndex
CREATE INDEX "simulation_sessions_topologyId_idx" ON "simulation_sessions"("topologyId");

-- CreateIndex
CREATE INDEX "simulation_sessions_status_idx" ON "simulation_sessions"("status");

-- CreateIndex
CREATE INDEX "topologies_createdAt_idx" ON "topologies"("createdAt");

-- AddForeignKey
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_topologyId_fkey" FOREIGN KEY ("topologyId") REFERENCES "topologies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_interfaces" ADD CONSTRAINT "network_interfaces_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "links" ADD CONSTRAINT "links_topologyId_fkey" FOREIGN KEY ("topologyId") REFERENCES "topologies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "links" ADD CONSTRAINT "links_interfaceAId_fkey" FOREIGN KEY ("interfaceAId") REFERENCES "network_interfaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "links" ADD CONSTRAINT "links_interfaceBId_fkey" FOREIGN KEY ("interfaceBId") REFERENCES "network_interfaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "links" ADD CONSTRAINT "links_nodeAId_fkey" FOREIGN KEY ("nodeAId") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "links" ADD CONSTRAINT "links_nodeBId_fkey" FOREIGN KEY ("nodeBId") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_entries" ADD CONSTRAINT "routing_entries_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_entries" ADD CONSTRAINT "routing_entries_nextHopInterfaceId_fkey" FOREIGN KEY ("nextHopInterfaceId") REFERENCES "network_interfaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "firewall_rules" ADD CONSTRAINT "firewall_rules_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_sessions" ADD CONSTRAINT "simulation_sessions_topologyId_fkey" FOREIGN KEY ("topologyId") REFERENCES "topologies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packet_logs" ADD CONSTRAINT "packet_logs_simulationId_fkey" FOREIGN KEY ("simulationId") REFERENCES "simulation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
