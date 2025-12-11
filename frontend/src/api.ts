// simple api wrapper

const API = "http://localhost:3000/api";

async function get(path: string) {
    const res = await fetch(`${API}${path}`);
    return res.json();
}

async function post(path: string, body?: any) {
    const res = await fetch(`${API}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined
    });
    return res.json();
}

async function put(path: string, body: any) {
    const res = await fetch(`${API}${path}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    return res.json();
}

async function del(path: string) {
    const res = await fetch(`${API}${path}`, { method: "DELETE" });
    return res.json();
}

export const api = {
    // topologies
    getTopologies: () => get("/topologies"),
    getTopology: (id: string) => get(`/topologies/${id}`),
    createTopology: (name: string) => post("/topologies", { name }),

    // nodes
    createNode: (topoId: string, data: any) => post(`/topologies/${topoId}/nodes`, data),
    updateNode: (topoId: string, nodeId: string, data: any) => put(`/topologies/${topoId}/nodes/${nodeId}`, data),
    updateNodePos: (topoId: string, nodeId: string, x: number, y: number) =>
        put(`/topologies/${topoId}/nodes/${nodeId}/position`, { positionX: x, positionY: y }),
    deleteNode: (topoId: string, nodeId: string) => del(`/topologies/${topoId}/nodes/${nodeId}`),

    // interfaces
    createInterface: (nodeId: string, cidr: string) => post(`/nodes/${nodeId}/interfaces`, { cidr }),
    deleteInterface: (nodeId: string, ifaceId: string) => del(`/nodes/${nodeId}/interfaces/${ifaceId}`),

    // links
    createLink: (topoId: string, ifaceA: string, ifaceB: string) =>
        post(`/topologies/${topoId}/links`, { interfaceAId: ifaceA, interfaceBId: ifaceB }),
    deleteLink: (topoId: string, linkId: string) => del(`/topologies/${topoId}/links/${linkId}`),

    // simulations
    createSim: (topoId: string, name?: string) =>
        post(`/topologies/${topoId}/simulations`, { name, autoPopulateARP: false }),
    sendPacket: (topoId: string, simId: string, nodeId: string, dstIp: string, protocol: string, payload?: string) =>
        post(`/topologies/${topoId}/simulations/${simId}/send-packet`, {
            sourceNodeId: nodeId, destinationIp: dstIp, protocol, payload
        }),
    simStep: (topoId: string, simId: string) => post(`/topologies/${topoId}/simulations/${simId}/step`)
};