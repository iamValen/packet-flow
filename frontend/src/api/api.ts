const API_BASE = 'http://localhost:3000/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Request failed');
  return data;
}

export const api = {
  // Topologies
  getTopologies: () => request<{ topologies: any[] }>('/topologies'),
  
  getTopology: (id: string) => request<{ topology: any }>(`/topologies/${id}`),
  
  createTopology: (name: string) => 
    request<{ topology: any }>('/topologies', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

    
  // Nodes
  createNode: (topologyId: string, data: {
    name: string;
    type: string;
    positionX: number;
    positionY: number;
    defaultGateway?: string;
  }) => request<{ node: any }>(`/topologies/${topologyId}/nodes`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  updateNode: (topologyId: string, nodeId: string, data: {
    name?: string;
    defaultGateway?: string;
  }) => request<{ node: any }>(`/topologies/${topologyId}/nodes/${nodeId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  updateNodePosition: (topologyId: string, nodeId: string, positionX: number, positionY: number) =>
    request<{ node: any }>(`/topologies/${topologyId}/nodes/${nodeId}/position`, {
      method: 'PUT',
      body: JSON.stringify({ positionX, positionY }),
    }),

  deleteNode: (topologyId: string, nodeId: string) =>
    request<{ deleted: any }>(`/topologies/${topologyId}/nodes/${nodeId}`, {
      method: 'DELETE',
    }),


  // Interfaces
  createInterface: (nodeId: string, cidr: string, mac?: string) =>
    request<{ interface: any }>(`/nodes/${nodeId}/interfaces`, {
      method: 'POST',
      body: JSON.stringify({ cidr, mac }),
    }),

  updateInterface: (nodeId: string, interfaceId: string, cidr: string) =>
    request<{ interface: any }>(`/nodes/${nodeId}/interfaces/${interfaceId}`, {
      method: 'PUT',
      body: JSON.stringify({ cidr }),
    }),

  deleteInterface: (nodeId: string, interfaceId: string) =>
    request<{ deleted: any }>(`/nodes/${nodeId}/interfaces/${interfaceId}`, {
      method: 'DELETE',
    }),


  // Links
  createLink: (topologyId: string, interfaceAId: string, interfaceBId: string) =>
    request<{ link: any }>(`/topologies/${topologyId}/links`, {
      method: 'POST',
      body: JSON.stringify({ interfaceAId, interfaceBId }),
    }),

  deleteLink: (topologyId: string, linkId: string) =>
    request<{ deleted: any }>(`/topologies/${topologyId}/links/${linkId}`, {
      method: 'DELETE',
    }),
};