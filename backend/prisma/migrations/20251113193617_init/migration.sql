-- CreateTable
CREATE TABLE "topologies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topologies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nodes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "positionX" DOUBLE PRECISION NOT NULL,
    "positionY" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "topologyId" TEXT NOT NULL,

    CONSTRAINT "nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "network_interfaces" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "mask" TEXT NOT NULL,
    "cidr" INTEGER NOT NULL,
    "mac" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nodeId" TEXT NOT NULL,

    CONSTRAINT "network_interfaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "links" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "topologyId" TEXT NOT NULL,
    "interfaceAId" TEXT NOT NULL,
    "interfaceBId" TEXT NOT NULL,
    "nodeAId" TEXT NOT NULL,
    "nodeBId" TEXT NOT NULL,

    CONSTRAINT "links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routing_entries" (
    "id" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "mask" TEXT NOT NULL,
    "cidr" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nodeId" TEXT NOT NULL,
    "nextHopInterfaceId" TEXT NOT NULL,

    CONSTRAINT "routing_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "firewall_rules" (
    "id" TEXT NOT NULL,
    "srcIp" TEXT NOT NULL,
    "dstIp" TEXT NOT NULL,
    "protocol" TEXT,
    "action" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nodeId" TEXT NOT NULL,

    CONSTRAINT "firewall_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_sessions" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "autoPopulateARP" BOOLEAN NOT NULL DEFAULT false,
    "stepDelay" INTEGER NOT NULL DEFAULT 1000,
    "status" TEXT NOT NULL DEFAULT 'IDLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "topologyId" TEXT NOT NULL,

    CONSTRAINT "simulation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packet_logs" (
    "id" TEXT NOT NULL,
    "srcIp" TEXT NOT NULL,
    "dstIp" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "payload" TEXT,
    "ttl" INTEGER NOT NULL,
    "history" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "simulationId" TEXT NOT NULL,

    CONSTRAINT "packet_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "links_interfaceAId_interfaceBId_key" ON "links"("interfaceAId", "interfaceBId");

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
