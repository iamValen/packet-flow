import { StatusCodes } from "http-status-codes";
import { prisma } from "../prisma.js";
import { AppError } from "../middleware/errorHandler.js";

class LinkService {
    async getAllLinks(topologyId: string) {
        if (!topologyId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID is required");
        }

        const topology = await prisma.topology.findUnique({
            where: { id: topologyId }
        });

        if (!topology) {
            throw new AppError(StatusCodes.NOT_FOUND, "Topology not found");
        }

        const links = await prisma.link.findMany({
            where: { topologyId },
            include: {
                interfaceA: {
                    select: {
                        id: true,
                        ip: true,
                        mac: true,
                        nodeId: true
                    }
                },
                interfaceB: {
                    select: {
                        id: true,
                        ip: true,
                        mac: true,
                        nodeId: true
                    }
                },
                nodeA: {
                    select: {
                        id: true,
                        name: true,
                        type: true
                    }
                },
                nodeB: {
                    select: {
                        id: true,
                        name: true,
                        type: true
                    }
                }
            },
            orderBy: { createdAt: 'asc' }
        });

        return { topology, links };
    }

    async getLinkById(topologyId: string, linkId: string) {
        if (!topologyId || !linkId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID and Link ID are required");
        }

        const link = await prisma.link.findUnique({
            where: { id: linkId },
            include: {
                interfaceA: true,
                interfaceB: true,
                nodeA: true,
                nodeB: true
            }
        });

        if (!link) {
            throw new AppError(StatusCodes.NOT_FOUND, "Link not found");
        }

        if (link.topologyId !== topologyId) {
            throw new AppError(StatusCodes.NOT_FOUND, "Link not found");
        }

        return link;
    }

    async createLink(topologyId: string, interfaceAId: string, interfaceBId: string) {
        if (!topologyId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID is required");
        }

        if (!interfaceAId || !interfaceBId || interfaceAId === interfaceBId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Both interfaceAId and interfaceBId are required, and cannot be the same");
        }

        const topology = await prisma.topology.findUnique({
            where: { id: topologyId }
        });

        if (!topology) {
            throw new AppError(StatusCodes.NOT_FOUND, "Topology not found");
        }

        const [interfaceA, interfaceB] = await Promise.all([
            prisma.networkInterface.findUnique({
                where: { id: interfaceAId },
                include: {
                    node: {
                        select: {
                            id: true,
                            name: true,
                            type: true,
                            topologyId: true
                        }
                    }
                }
            }),
            prisma.networkInterface.findUnique({
                where: { id: interfaceBId },
                include: {
                    node: {
                        select: {
                            id: true,
                            name: true,
                            type: true,
                            topologyId: true
                        }
                    }
                }
            })
        ]);

        if (!interfaceA || !interfaceB) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Invalid interface IDs");
        }

        if (interfaceA.node.topologyId !== topologyId || interfaceB.node.topologyId !== topologyId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Interfaces must belong to this topology");
        }

        if (interfaceA.node.id === interfaceB.node.id) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Cannot link interfaces on the same node");
        }

        const existingLinks = await prisma.link.findMany({
            where: {
                OR: [
                    { interfaceAId },
                    { interfaceBId },
                    { interfaceAId: interfaceBId },
                    { interfaceBId: interfaceAId }
                ]
            },
            include: {
                nodeA: { select: { name: true } },
                nodeB: { select: { name: true } }
            }
        });

        if (existingLinks.length > 0) {
            throw new AppError(StatusCodes.CONFLICT, "One or both interfaces are already linked");
        }

        const link = await prisma.link.create({
            data: {
                interfaceAId,
                interfaceBId,
                nodeAId: interfaceA.node.id,
                nodeBId: interfaceB.node.id,
                topologyId
            },
            include: {
                interfaceA: {
                    select: {
                        id: true,
                        ip: true,
                        mac: true,
                        nodeId: true
                    }
                },
                interfaceB: {
                    select: {
                        id: true,
                        ip: true,
                        mac: true,
                        nodeId: true
                    }
                },
                nodeA: {
                    select: {
                        id: true,
                        name: true,
                        type: true
                    }
                },
                nodeB: {
                    select: {
                        id: true,
                        name: true,
                        type: true
                    }
                }
            }
        });

        return link;
    }

    async deleteLink(topologyId: string, linkId: string) {
        if (!topologyId || !linkId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID and Link ID are required");
        }

        const link = await prisma.link.findUnique({
            where: { id: linkId },
            include: {
                nodeA: {
                    select: { name: true }
                },
                nodeB: {
                    select: { name: true }
                },
                interfaceA: {
                    select: { ip: true }
                },
                interfaceB: {
                    select: { ip: true }
                }
            }
        });

        if (!link) {
            throw new AppError(StatusCodes.NOT_FOUND, "Link not found");
        }

        if (link.topologyId !== topologyId) {
            throw new AppError(StatusCodes.NOT_FOUND, "Link is not in this topology");
        }

        await prisma.link.delete({
            where: { id: linkId }
        });

        return {
            id: link.id,
            nodeA: link.nodeA.name,
            nodeB: link.nodeB.name,
            interfaceA: link.interfaceA.ip,
            interfaceB: link.interfaceB.ip
        };
    }

    async getLinksForNode(nodeId: string) {
        if (!nodeId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Node ID is required");
        }

        const node = await prisma.node.findUnique({
            where: { id: nodeId },
            include: {
                topology: {
                    select: { id: true, name: true }
                }
            }
        });

        if (!node) {
            throw new AppError(StatusCodes.NOT_FOUND, "Node not found");
        }

        const links = await prisma.link.findMany({
            where: {
                OR: [
                    { nodeAId: nodeId },
                    { nodeBId: nodeId }
                ]
            },
            include: {
                interfaceA: true,
                interfaceB: true,
                nodeA: {
                    select: {
                        id: true,
                        name: true,
                        type: true
                    }
                },
                nodeB: {
                    select: {
                        id: true,
                        name: true,
                        type: true
                    }
                }
            },
            orderBy: { createdAt: 'asc' }
        });

        return { node, links };
    }
}

export default new LinkService();