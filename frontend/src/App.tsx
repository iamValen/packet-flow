import { useCallback, useRef, useState, useEffect } from "react";
import ReactFlow, { ReactFlowProvider, useNodesState, useEdgesState, useReactFlow, Background, Controls, type Node, type Edge } from "reactflow";
import "reactflow/dist/style.css";

import Sidebar from "./components/Sidebar";
import CustomNode from "./components/CustomNode";
import NodeMenu from "./components/NodeMenu";
import LinkMenu from "./components/LinkMenu";
import SendPacketMenu from "./components/SendPacketMenu";
import ActionPanel from "./components/ActionPanel";
import { useSimulation, LogPanel } from "./components/SimulationPanel";
import { api } from "./api";
import { type Topology, type NetworkNode, NodeType } from "./types";
import "./App.css";

const nodeTypes = { custom: CustomNode };

/**
 * Main app component - manages topology, canvas, simulation, and menus
 */
function Flow() {
    const wrapper = useRef<HTMLDivElement>(null);
    const { screenToFlowPosition } = useReactFlow();

    // topology state
    const [topologies, setTopologies] = useState<Topology[]>([]);
    const [topo, setTopo] = useState<Topology | null>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    // menu visibility
    const [nodeMenuOpen, setNodeMenuOpen] = useState(false);
    const [linkMenuOpen, setLinkMenuOpen] = useState(false);
    const [sendMenuOpen, setSendMenuOpen] = useState(false);

    // node creation/editing state
    const [pendingType, setPendingType] = useState<NodeType>(NodeType.HOST);
    const [pendingPos, setPendingPos] = useState({ x: 0, y: 0 });
    const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);

    // simulation
    const { simulating, log, sendPacket, clearLog, resetSimulation } = useSimulation({
        topologyId: topo?.id || null
    });

    // load topologies on mount
    useEffect(() => {
        api.getTopologies().then(res => setTopologies(res.topologies || []));
    }, []);

    // close all menus and clear selection
    const closeAllMenus = useCallback(() => {
        setNodeMenuOpen(false);
        setLinkMenuOpen(false);
        setSendMenuOpen(false);
        setSelectedNode(null);
    }, []);

    // convert topology to reactflow format
    const updateFlow = useCallback((t: Topology | null, highlightId?: string) => {
        if (!t) { setNodes([]); setEdges([]); return; }

        setNodes(t.nodes.map(n => ({
            id: n.id,
            type: "custom",
            position: { x: n.positionX, y: n.positionY },
            data: { name: n.name, type: n.type, ip: n.interfaces[0]?.ip, selected: n.id === highlightId }
        })));

        setEdges(t.links.map(l => ({
            id: l.id,
            source: l.nodeAId,
            target: l.nodeBId,
            style: { stroke: "#959595ff", strokeWidth: 2 }
        })));
    }, [setNodes, setEdges]);

    // load topology - also closes menus and resets simulation
    const loadTopo = useCallback(async (id: string) => {
        closeAllMenus();
        
        if (!id) { 
            setTopo(null); 
            resetSimulation(); 
            updateFlow(null); 
            return; 
        }
        
        const res = await api.getTopology(id);
        setTopo(res.topology);
        resetSimulation();
        updateFlow(res.topology);
    }, [updateFlow, resetSimulation, closeAllMenus]);

    const createTopo = async (name: string) => {
        const res = await api.createTopology(name);
        setTopologies([...topologies, res.topology]);
        loadTopo(res.topology.id);
    };

    const refresh = useCallback(() => { if (topo) loadTopo(topo.id); }, [topo, loadTopo]);

    // drag device from sidebar to canvas
    const onDragStart = (e: React.DragEvent, type: NodeType) => {
        e.dataTransfer.setData("type", type);
    };

    const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); }, []);

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (!topo) return;
        
        const type = e.dataTransfer.getData("type") as NodeType;
        if (!type) return;
        
        setPendingType(type);
        setPendingPos(screenToFlowPosition({ x: e.clientX, y: e.clientY }));
        setSelectedNode(null);
        setNodeMenuOpen(true);
    }, [topo, screenToFlowPosition]);

    // node click - select and sync position from reactflow
    const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
        const found = topo?.nodes.find(n => n.id === node.id);
        if (!found || !topo) return;

        // merge current reactflow position into node data
        const updatedNode = { ...found, positionX: node.position.x, positionY: node.position.y };
        setSelectedNode(updatedNode);

        // sync position to topo state to prevent stale data
        const updatedTopo = {
            ...topo,
            nodes: topo.nodes.map(n => n.id === node.id ? updatedNode : n)
        };
        setTopo(updatedTopo);
        updateFlow(updatedTopo, node.id);
    }, [topo, updateFlow]);

    const onPaneClick = useCallback(() => {
        setSelectedNode(null);
        if (topo) updateFlow(topo);
    }, [topo, updateFlow]);

    // after drag, save position to backend and update local state
    const onNodeDragStop = useCallback(async (_: React.MouseEvent, node: Node) => {
        if (!topo) return;

        await api.updateNodePos(topo.id, node.id, node.position.x, node.position.y);

        // update local state to prevent position reset on next click
        const updatedTopo = {
            ...topo,
            nodes: topo.nodes.map(n =>
                n.id === node.id ? { ...n, positionX: node.position.x, positionY: node.position.y } : n
            )
        };
        setTopo(updatedTopo);

        // also update selected node if it was dragged
        if (selectedNode?.id === node.id) {
            setSelectedNode({ ...selectedNode, positionX: node.position.x, positionY: node.position.y });
        }
    }, [topo, selectedNode]);

    const onEdgeClick = useCallback(async (_: React.MouseEvent, edge: Edge) => {
        if (!topo) return;
        if (confirm("Delete link?")) {
            await api.deleteLink(topo.id, edge.id);
            refresh();
        }
    }, [topo, refresh]);

    // create or update node
    const handleNodeSubmit = async (data: { name: string; gateway?: string; interfaces: { ip: string; cidr: string }[] }) => {
        if (!topo) return;
        
        try {
            if (selectedNode) {
                // update existing
                await api.updateNode(topo.id, selectedNode.id, { name: data.name, defaultGateway: data.gateway });
                
                // sync interfaces: delete removed, add new
                const newIps = new Set(data.interfaces.map(i => i.ip));
                const oldIps = new Set(selectedNode.interfaces.map(i => i.ip));
                
                for (const iface of selectedNode.interfaces) {
                    if (!newIps.has(iface.ip)) await api.deleteInterface(selectedNode.id, iface.id);
                }
                for (const iface of data.interfaces) {
                    if (!oldIps.has(iface.ip)) await api.createInterface(selectedNode.id, `${iface.ip}/${iface.cidr}`);
                }
            } else {
                // create new
                const res = await api.createNode(topo.id, {
                    name: data.name,
                    type: pendingType,
                    positionX: pendingPos.x,
                    positionY: pendingPos.y,
                    defaultGateway: data.gateway
                });
                for (const iface of data.interfaces) {
                    await api.createInterface(res.node.id, `${iface.ip}/${iface.cidr}`);
                }
            }
            
            setNodeMenuOpen(false);
            setSelectedNode(null);
            refresh();
        } catch (err) {
            alert("Error saving node");
        }
    };

    const handleNodeDelete = async () => {
        if (!topo || !selectedNode) return;
        await api.deleteNode(topo.id, selectedNode.id);
        setNodeMenuOpen(false);
        setSelectedNode(null);
        refresh();
    };

    const handleCreateLink = async (ifaceA: string, ifaceB: string) => {
        if (!topo) return;
        await api.createLink(topo.id, ifaceA, ifaceB);
        refresh();
    };

    const handleSendPacket = async (dstIp: string, protocol: string, payload?: string) => {
        if (!selectedNode) return;
        setSendMenuOpen(false);
        await sendPacket(selectedNode, dstIp, protocol as any, payload);
    };

    return (
        <div className="app">
            <Sidebar
                topologies={topologies}
                currentId={topo?.id || null}
                onSelect={loadTopo}
                onCreate={createTopo}
                onDragStart={onDragStart}
                onLinkMode={() => setLinkMenuOpen(true)}
            />

            <div className="canvas" ref={wrapper}>
                {topo ? (
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onNodeClick={onNodeClick}
                        onEdgeClick={onEdgeClick}
                        onNodeDragStop={onNodeDragStop}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        onPaneClick={onPaneClick}
                        nodeTypes={nodeTypes}
                        fitView
                    >
                        <Background color="#333" gap={20} />
                        <Controls />
                    </ReactFlow>
                ) : (
                    <div className="empty"><h2>No Topology</h2><p>Select or create one</p></div>
                )}

                {/* action panel - shows when node selected and no menu open */}
                {selectedNode && !nodeMenuOpen && !sendMenuOpen && (
                    <ActionPanel
                        node={selectedNode}
                        onClose={() => { setSelectedNode(null); if (topo) updateFlow(topo); }}
                        onEdit={() => { setPendingType(selectedNode.type); setNodeMenuOpen(true); }}
                        onSendPacket={() => setSendMenuOpen(true)}
                    />
                )}

                {simulating && <div className="sim-status"><span className="pulse" /> Running...</div>}
                <LogPanel log={log} onClear={clearLog} />
            </div>

            {/* menus */}
            <NodeMenu
                isOpen={nodeMenuOpen}
                nodeType={pendingType}
                existingNode={selectedNode}
                onClose={() => { setNodeMenuOpen(false); setSelectedNode(null); }}
                onSubmit={handleNodeSubmit}
                onDelete={selectedNode ? handleNodeDelete : undefined}
            />
            <LinkMenu
                isOpen={linkMenuOpen}
                nodes={topo?.nodes || []}
                links={topo?.links || []}
                onClose={() => setLinkMenuOpen(false)}
                onCreateLink={handleCreateLink}
            />
            <SendPacketMenu
                isOpen={sendMenuOpen}
                sourceNode={selectedNode}
                allNodes={topo?.nodes || []}
                onClose={() => setSendMenuOpen(false)}
                onSend={handleSendPacket}
            />
        </div>
    );
}

export default function App() {
    return <ReactFlowProvider><Flow /></ReactFlowProvider>;
}